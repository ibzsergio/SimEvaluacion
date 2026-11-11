import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 12 * 1024 * 1024;
const MARK = "[[crud-state]]";
const TITLE = "CRUDS BD";
const TITLES = [TITLE, "TEST"];
const PUNTOS = 2000;
const CIERRE: Record<string, { iso: string; texto: string }> = {
  "302": {
    iso: "2026-11-11T09:20:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 302 se cierran a las 9:20 a. m. de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
  "301": {
    iso: "2026-11-11T12:00:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 301 se cierran a las 12:00 del día de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
};

function crudCierre(groupCode?: string | null, now = Date.now()) {
  const item = groupCode ? CIERRE[groupCode.trim()] : undefined;
  if (!item) {
    return {
      texto:
        "El grupo 302 entrega hasta las 9:20 a. m. El grupo 301 entrega hasta las 12:00 del día. Después de esa hora ya no se puede subir y el equipo pierde los 2000 puntos.",
      open: false,
    };
  }
  return { texto: item.texto, open: now < new Date(item.iso).getTime() };
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

async function ensureTestActivity(groupId: string, teacherId: string) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { currentPartial: true },
  });
  const existing = await prisma.activity.findFirst({
    where: { groupId, name: { in: TITLES } },
    select: { id: true, name: true, maxPoints: true },
  });
  if (existing) {
    if (existing.name !== TITLE || existing.maxPoints !== PUNTOS) {
      await prisma.activity.update({
        where: { id: existing.id },
        data: { name: TITLE, maxPoints: PUNTOS },
      });
      await prisma.grade.updateMany({
        where: { activityId: existing.id, points: 1000 },
        data: { points: PUNTOS },
      });
    }
    return existing.id;
  }
  const lastOrder = await prisma.activity.aggregate({
    where: { groupId },
    _max: { sortOrder: true },
  });
  const created = await prisma.activity.create({
    data: {
      date: todayClassDayDate(),
      name: TITLE,
      maxPoints: PUNTOS,
      signatureMax: 0,
      sortOrder: (lastOrder._max.sortOrder ?? -1) + 1,
      partialNumber: group?.currentPartial ?? 1,
      releasedToStudents: true,
      groupId,
      createdById: teacherId,
    },
    select: { id: true },
  });
  return created.id;
}

async function awardTeam(groupId: string, teamKey: string) {
  const teamId = teamKey.startsWith("project:") ? teamKey.slice("project:".length) : "";
  const [team, group] = await Promise.all([
    prisma.projectTeam.findFirst({
      where: { id: teamId, groupId },
      select: { members: { select: { studentId: true } } },
    }),
    prisma.classGroup.findUnique({
      where: { id: groupId },
      select: { teacherId: true },
    }),
  ]);
  if (!team || !group) return;
  const activityId = await ensureTestActivity(groupId, group.teacherId);
  const gradedAt = new Date();
  for (const member of team.members) {
    await prisma.grade.upsert({
      where: { activityId_studentId: { activityId, studentId: member.studentId } },
      update: { points: PUNTOS, signatures: 0, gradedById: group.teacherId },
      create: {
        activityId,
        studentId: member.studentId,
        points: PUNTOS,
        signatures: 0,
        gradedById: group.teacherId,
        gradedAt,
      },
    });
  }
}

async function activityReleased(groupId: string) {
  const announcements = await prisma.announcement.findMany({
    where: { groupId, title: { in: TITLES } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { body: true },
  });
  for (const item of announcements) {
    const idx = item.body.indexOf(MARK);
    if (idx < 0) continue;
    try {
      const parsed = JSON.parse(item.body.slice(idx + MARK.length).trim()) as { released?: boolean };
      if (typeof parsed?.released === "boolean") return parsed.released;
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
      student: { select: { id: true, groupId: true, displayName: true, group: { select: { code: true } } } },
      team: { select: { id: true, name: true, groupId: true } },
    },
  });
  if (!member?.student.groupId || member.team.groupId !== member.student.groupId) return null;
  return {
    groupId: member.student.groupId,
    groupCode: member.student.group?.code ?? "",
    teamKey: `project:${member.team.id}`,
    teamName: member.team.name,
    studentName: member.student.displayName,
  };
}

function publicDelivery(
  row: {
    teamKey: string;
    teamName: string;
    fileName: string;
    sizeBytes: number;
    uploadedAt: Date;
    uploadedById: string;
  },
  uploadedByName: string,
) {
  return {
    teamKey: row.teamKey,
    teamName: row.teamName,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
    uploadedByName,
  };
}

export const crudTeacherRouter = Router();
crudTeacherRouter.use(requireAuth, requireTeacher);

crudTeacherRouter.get("/groups/:groupId/crud/deliveries", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, teacherId: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  await ensureTestActivity(group.id, group.teacherId);
  const [rows, teams] = await Promise.all([
    prisma.crudDelivery.findMany({
      where: { groupId },
      select: { teamKey: true, teamName: true, fileName: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.projectTeam.findMany({
      where: { groupId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        members: {
          select: {
            student: { select: { id: true, displayName: true, listNumber: true } },
          },
        },
      },
    }),
  ]);
  const names = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.uploadedById) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(names.map((user) => [user.id, user.displayName]));
  return res.json({
    groupCode: group.code,
    teams: teams.map((team) => ({
      key: `project:${team.id}`,
      name: team.name,
      members: team.members.map((member) => member.student),
    })),
    deliveries: rows.map((row) => publicDelivery(row, nameById.get(row.uploadedById) ?? "Un integrante")),
  });
});

crudTeacherRouter.get("/groups/:groupId/crud/:teamKey/file", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const teamKey = String(req.params.teamKey);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const row = await prisma.crudDelivery.findUnique({
    where: { groupId_teamKey: { groupId, teamKey } },
  });
  if (!row) {
    return res.status(404).json({ error: "delivery_not_found", message: "Este equipo todavía no sube sus evidencias." });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentCrudRoutes(app: import("express").Express) {
  app.get("/student/crud/delivery", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const team = await studentTeam(req.auth!.userId);
    if (!team) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    const released = await activityReleased(team.groupId);
    const row = await prisma.crudDelivery.findUnique({
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
    return res.json({
      allowed: released,
      teamKey: team.teamKey,
      teamName: team.teamName,
      delivery: row ? publicDelivery(row, uploadedByName) : null,
    });
  });

  app.post(
    "/student/crud/delivery",
    requireAuth,
    requireStudent,
    requireNotPreviewStudent,
    (req, res, next) => {
      upload.single("file")(req, res, (err: unknown) => {
        const code = (err as { code?: string } | null)?.code;
        if (code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "pdf_too_big",
            message: "El PDF pesa más de 12 MB. Redúcelo y vuelve a subirlo.",
          });
        }
        if (err) return res.status(400).json({ error: "upload_failed", message: "No se pudo leer el archivo." });
        next();
      });
    },
    async (req: AuthedRequest, res) => {
      if (req.body?.completo !== "si") {
        return res.status(400).json({
          error: "checks_incomplete",
          message:
            "Antes de subir, marca que el PDF muestra a cada integrante con la tabla que le asignó el líder, su script y el CRUD funcionando.",
        });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF del equipo." });
      if (file.size > PDF_MAX_BYTES) {
        return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 12 MB. Redúcelo y vuelve a subirlo." });
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
        return res.status(403).json({ error: "not_released", message: "CRUDS BD todavía no está liberada para tu grupo." });
      }
      const cierre = crudCierre(team.groupCode);
      if (!cierre.open) {
        return res.status(403).json({
          error: "upload_closed",
          message: `${cierre.texto} Esa hora ya pasó.`,
        });
      }
      const saved = await prisma.crudDelivery.upsert({
        where: { groupId_teamKey: { groupId: team.groupId, teamKey: team.teamKey } },
        create: {
          groupId: team.groupId,
          teamKey: team.teamKey,
          teamName: team.teamName,
          fileName: safeFileName(file.originalname || "evidencias-crud.pdf"),
          mimeType: "application/pdf",
          fileData: file.buffer,
          sizeBytes: file.size,
          uploadedById: req.auth!.userId,
        },
        update: {
          teamName: team.teamName,
          fileName: safeFileName(file.originalname || "evidencias-crud.pdf"),
          mimeType: "application/pdf",
          fileData: file.buffer,
          sizeBytes: file.size,
          uploadedById: req.auth!.userId,
          uploadedAt: new Date(),
        },
      });
      await awardTeam(team.groupId, team.teamKey);
      return res.json({ delivery: publicDelivery(saved, team.studentName) });
    },
  );
}
