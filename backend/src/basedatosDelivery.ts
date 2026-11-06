import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 5 * 1024 * 1024;
const MARK = "[[basedatos-state]]";

const CIERRE: Record<string, { iso: string; texto: string }> = {
  "301": {
    iso: "2026-11-06T15:00:00-06:00",
    texto: "El archivo solo se puede subir hasta las 3:00 p. m. de hoy.",
  },
  "302": {
    iso: "2026-11-06T13:00:00-06:00",
    texto: "El archivo solo se puede subir hasta la 1:00 p. m. de hoy.",
  },
};

function cierreDeGrupo(code?: string | null, now = Date.now()) {
  const item = code ? CIERRE[code.trim()] : undefined;
  if (!item) return null;
  return { texto: item.texto, until: item.iso, open: now < new Date(item.iso).getTime() };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_MAX_BYTES },
});

function isPdf(file: Express.Multer.File) {
  const name = file.originalname.toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();
  const header = file.buffer.subarray(0, 5).toString("utf8");
  return (name.endsWith(".pdf") || mime === "application/pdf") && header.startsWith("%PDF");
}

function safeFileName(name: string) {
  const clean = name.replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]+/g, "_").slice(0, 120);
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

async function activityReleased(groupId: string) {
  const announcements = await prisma.announcement.findMany({
    where: { groupId, title: "La base de datos" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { body: true },
  });
  for (const item of announcements) {
    const idx = item.body.indexOf(MARK);
    if (idx < 0) continue;
    try {
      const parsed = JSON.parse(item.body.slice(idx + MARK.length).trim()) as { released?: boolean };
      if (parsed?.released) return true;
    } catch {
      /* el aviso siguiente puede sí tener el estado */
    }
  }
  return false;
}

async function studentTeam(studentId: string) {
  const member = await prisma.projectTeamMember.findUnique({
    where: { studentId },
    include: {
      student: { select: { id: true, groupId: true, displayName: true } },
      team: { select: { id: true, name: true, groupId: true } },
    },
  });
  if (!member?.student.groupId || member.team.groupId !== member.student.groupId) return null;
  const group = await prisma.classGroup.findUnique({
    where: { id: member.student.groupId },
    select: { code: true },
  });
  return {
    groupId: member.student.groupId,
    groupCode: group?.code ?? "",
    teamKey: `project:${member.team.id}`,
    teamName: member.team.name,
    studentName: member.student.displayName,
  };
}

function publicDelivery(row: {
  teamKey: string;
  teamName: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedById: string;
}, uploadedByName: string) {
  return {
    teamKey: row.teamKey,
    teamName: row.teamName,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
    uploadedByName,
  };
}

export const basedatosTeacherRouter = Router();
basedatosTeacherRouter.use(requireAuth, requireTeacher);

basedatosTeacherRouter.get("/groups/:groupId/basedatos/deliveries", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const rows = await prisma.teamDelivery.findMany({
    where: { groupId },
    select: {
      teamKey: true,
      teamName: true,
      fileName: true,
      sizeBytes: true,
      uploadedAt: true,
      uploadedById: true,
    },
    orderBy: { teamName: "asc" },
  });
  const uploaders = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.uploadedById) } },
    select: { id: true, displayName: true },
  });
  const names = new Map(uploaders.map((user) => [user.id, user.displayName]));
  return res.json({
    deliveries: rows.map((row) => publicDelivery(row, names.get(row.uploadedById) ?? "Alumno")),
  });
});

basedatosTeacherRouter.get("/groups/:groupId/basedatos/deliveries/:teamKey/file", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const teamKey = String(req.params.teamKey);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const row = await prisma.teamDelivery.findUnique({
    where: { groupId_teamKey: { groupId, teamKey } },
  });
  if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Ese equipo todavía no sube el PDF." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentBasedatosRoutes(app: import("express").Express) {
  app.get("/student/basedatos/delivery", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const team = await studentTeam(req.auth!.userId);
    if (!team) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    const released = await activityReleased(team.groupId);
    const row = await prisma.teamDelivery.findUnique({
      where: { groupId_teamKey: { groupId: team.groupId, teamKey: team.teamKey } },
      select: {
        teamKey: true,
        teamName: true,
        fileName: true,
        sizeBytes: true,
        uploadedAt: true,
        uploadedById: true,
      },
    });
    let uploadedByName = "";
    if (row) {
      const uploader = await prisma.user.findUnique({
        where: { id: row.uploadedById },
        select: { displayName: true },
      });
      uploadedByName = uploader?.displayName ?? "Un integrante";
    }
    const cierre = cierreDeGrupo(team.groupCode);
    return res.json({
      released,
      teamKey: team.teamKey,
      teamName: team.teamName,
      uploadOpen: cierre ? cierre.open : true,
      uploadText: cierre?.texto ?? null,
      delivery: row ? publicDelivery(row, uploadedByName) : null,
    });
  });

  app.post(
    "/student/basedatos/delivery",
    requireAuth,
    requireStudent,
    requireNotPreviewStudent,
    (req, res, next) => {
      upload.single("file")(req, res, (err: unknown) => {
        const code = (err as { code?: string } | null)?.code;
        if (code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 5 MB. Redúcelo y vuelve a subirlo." });
        }
        if (err) return res.status(400).json({ error: "upload_failed", message: "No se pudo leer el archivo." });
        next();
      });
    },
    async (req: AuthedRequest, res) => {
      if (req.body?.completo !== "si") {
        return res.status(400).json({
          error: "checks_incomplete",
          message: "Antes de subir, marca que el PDF trae carátula, las secciones con título, el script completo y las capturas.",
        });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF del equipo." });
      if (file.size > PDF_MAX_BYTES) {
        return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 5 MB. Redúcelo y vuelve a subirlo." });
      }
      if (!isPdf(file)) {
        return res.status(400).json({ error: "pdf_only", message: "Solo se puede subir un archivo PDF." });
      }
      const team = await studentTeam(req.auth!.userId);
      if (!team) {
        return res.status(400).json({
          error: "no_team",
          message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
        });
      }
      if (!(await activityReleased(team.groupId))) {
        return res.status(403).json({ error: "not_released", message: "El docente todavía no libera la entrega." });
      }
      const cierre = cierreDeGrupo(team.groupCode);
      if (cierre && !cierre.open) {
        return res.status(403).json({
          error: "upload_closed",
          message: `${cierre.texto} Esa hora ya pasó y ya no se acepta el PDF.`,
        });
      }
      const saved = await prisma.teamDelivery.upsert({
        where: { groupId_teamKey: { groupId: team.groupId, teamKey: team.teamKey } },
        create: {
          groupId: team.groupId,
          teamKey: team.teamKey,
          teamName: team.teamName,
          fileName: safeFileName(file.originalname || "entrega.pdf"),
          mimeType: "application/pdf",
          fileData: file.buffer,
          sizeBytes: file.size,
          uploadedById: req.auth!.userId,
        },
        update: {
          teamName: team.teamName,
          fileName: safeFileName(file.originalname || "entrega.pdf"),
          mimeType: "application/pdf",
          fileData: file.buffer,
          sizeBytes: file.size,
          uploadedById: req.auth!.userId,
          uploadedAt: new Date(),
        },
      });
      return res.json({
        delivery: publicDelivery(saved, team.studentName),
      });
    },
  );
}
