import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { getPreviewViewGroup, isPreviewControlNumber, requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 3 * 1024 * 1024;
const PUNTOS = 1000;
const ACTIVITY_KEY = "glosario";
const TITLE = "Glosario Bilingüe";
const MARK = "[[glosario-state]]";
const HORARIOS = {
  "301": [
    { until: "2026-11-19T09:30:00-06:00", points: 1000 },
    { until: "2026-11-19T11:00:00-06:00", points: 500 },
    { until: "2026-11-19T13:10:00-06:00", points: 300 },
  ],
  "302": [
    { until: "2026-11-19T11:00:00-06:00", points: 1000 },
    { until: "2026-11-19T12:00:00-06:00", points: 500 },
    { until: "2026-11-19T13:10:00-06:00", points: 300 },
  ],
} as const;
const CIERRE_MENSAJE = "Después de la 1:10 p. m. de hoy, jueves 19 de noviembre, ya no se acepta el PDF.";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PDF_MAX_BYTES } });

function entregaDe(groupCode: string, at: number | Date = Date.now()) {
  const code = groupCode.trim();
  const horario = code === "301" || code === "302" ? HORARIOS[code] : null;
  if (!horario) return { open: false, points: 0 };
  const ms = at instanceof Date ? at.getTime() : at;
  for (const tramo of horario) {
    if (ms < new Date(tramo.until).getTime()) return { open: true, points: tramo.points };
  }
  return { open: false, points: 0 };
}

type Nota = {
  id: string;
  code: string;
  label: string;
  points: number;
  studentId: string | null;
  studentName: string | null;
  at: string;
};

type Estado = { v: 1; notes: Record<string, Nota[]> };

const NOTAS = [
  { code: "participa", label: "No participó", points: 200 },
  { code: "caratula", label: "Falta la carátula de Canva", points: 200 },
  { code: "descripcion", label: "La palabra clave no trae descripción", points: 200 },
  { code: "reporte", label: "Falta el reporte general", points: 300 },
  { code: "integrantes", label: "No se indica qué hizo cada integrante", points: 200 },
] as const;

function estadoDe(body: string): Estado {
  const idx = body.indexOf(MARK);
  if (idx < 0) return { v: 1, notes: {} };
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<Estado>;
    if (parsed?.v !== 1 || !parsed.notes || typeof parsed.notes !== "object") return { v: 1, notes: {} };
    return { v: 1, notes: parsed.notes };
  } catch {
    return { v: 1, notes: {} };
  }
}

async function leerEstado(groupId: string) {
  const anuncio = await prisma.announcement.findFirst({
    where: { groupId, title: TITLE },
    orderBy: { createdAt: "desc" },
  });
  return { anuncio, estado: anuncio ? estadoDe(anuncio.body) : { v: 1 as const, notes: {} } };
}

async function guardarEstado(groupId: string, estado: Estado, anuncioId?: string) {
  const body = `${TITLE}\n\n${MARK}\n${JSON.stringify(estado)}`;
  if (anuncioId) {
    await prisma.announcement.update({ where: { id: anuncioId }, data: { body } });
    return;
  }
  const group = await prisma.classGroup.findUnique({ where: { id: groupId }, select: { teacherId: true } });
  if (!group) throw new Error("group_not_found");
  await prisma.announcement.create({ data: { teacherId: group.teacherId, groupId, title: TITLE, body } });
}

function puntosDe(notas: Nota[], studentId: string, max: number) {
  const corte = notas
    .filter((nota) => !nota.studentId || nota.studentId === studentId)
    .reduce((acc, nota) => acc + Math.max(0, nota.points), 0);
  return Math.max(0, max - corte);
}

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

async function equipoDelAlumno(studentId: string) {
  const member = await prisma.projectTeamMember.findUnique({
    where: { studentId },
    include: {
      student: { select: { groupId: true, group: { select: { code: true } } } },
      team: { select: { id: true, name: true, groupId: true } },
    },
  });
  if (!member?.student.groupId || member.team.groupId !== member.student.groupId) return null;
  return {
    groupId: member.student.groupId,
    groupCode: member.student.group?.code ?? "",
    teamKey: `project:${member.team.id}`,
    teamName: member.team.name,
  };
}

async function ensureActivity(groupId: string, teacherId: string) {
  const group = await prisma.classGroup.findUnique({ where: { id: groupId }, select: { currentPartial: true } });
  const existing = await prisma.activity.findFirst({
    where: { groupId, name: TITLE },
    select: { id: true, maxPoints: true },
  });
  if (existing) {
    if (existing.maxPoints !== PUNTOS) {
      await prisma.activity.update({ where: { id: existing.id }, data: { maxPoints: PUNTOS } });
    }
    return existing.id;
  }
  const lastOrder = await prisma.activity.aggregate({ where: { groupId }, _max: { sortOrder: true } });
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

async function awardTeam(groupId: string, teamKey: string, max: number, notas: Nota[]) {
  const teamId = teamKey.startsWith("project:") ? teamKey.slice("project:".length) : "";
  const [team, group] = await Promise.all([
    prisma.projectTeam.findFirst({
      where: { id: teamId, groupId },
      select: { members: { select: { studentId: true } } },
    }),
    prisma.classGroup.findUnique({ where: { id: groupId }, select: { teacherId: true } }),
  ]);
  if (!team || !group) return;
  const activityId = await ensureActivity(groupId, group.teacherId);
  const gradedAt = new Date();
  for (const member of team.members) {
    const points = puntosDe(notas, member.studentId, max);
    await prisma.grade.upsert({
      where: { activityId_studentId: { activityId, studentId: member.studentId } },
      update: { points, signatures: 0, gradedById: group.teacherId },
      create: {
        activityId,
        studentId: member.studentId,
        points,
        signatures: 0,
        gradedById: group.teacherId,
        gradedAt,
      },
    });
  }
}

async function vistaDePrueba(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { controlNumber: true, group: { select: { teacherId: true } } },
  });
  if (!user?.group || !isPreviewControlNumber(user.controlNumber)) return null;
  const view = await getPreviewViewGroup(user.group.teacherId);
  const code = view?.code;
  if (code !== "301" && code !== "302") return null;
  return {
    preview: true,
    groupCode: code,
    teamKey: "preview",
    teamName: "Vista de prueba",
    delivery: null,
  };
}

export const glosarioTeacherRouter = Router();
glosarioTeacherRouter.use(requireAuth, requireTeacher);

glosarioTeacherRouter.get("/groups/:groupId/glosario", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const [{ estado }, rows, teams] = await Promise.all([
    leerEstado(groupId),
    prisma.sqlScrumDelivery.findMany({
      where: { groupId, activityKey: ACTIVITY_KEY },
      select: { teamKey: true, teamName: true, fileName: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.projectTeam.findMany({
      where: { groupId },
      select: { id: true, name: true, leaderId: true, members: { select: { student: { select: { id: true, displayName: true } } } } },
    }),
  ]);
  const names = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.uploadedById) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(names.map((user) => [user.id, user.displayName]));
  const ordered = [...teams].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }) || a.id.localeCompare(b.id));
  return res.json({
    groupCode: group.code,
    teams: ordered.map((team) => {
      const teamKey = `project:${team.id}`;
      return {
        teamKey,
        teamName: team.name,
        leaderName: team.members.find((member) => member.student.id === team.leaderId)?.student.displayName ?? null,
        notes: estado.notes[teamKey] ?? [],
        members: [...team.members]
          .sort((a, b) => a.student.displayName.localeCompare(b.student.displayName, "es"))
          .map((member) => ({
            id: member.student.id,
            displayName: member.student.displayName,
            isLeader: member.student.id === team.leaderId,
          })),
      };
    }),
    deliveries: rows.map((row) => ({
      teamKey: row.teamKey,
      teamName: row.teamName,
      fileName: row.fileName,
      sizeBytes: row.sizeBytes,
      uploadedAt: row.uploadedAt.toISOString(),
      uploadedByName: nameById.get(row.uploadedById) ?? "Un integrante",
      points: entregaDe(group.code, row.uploadedAt).points,
    })),
  });
});

glosarioTeacherRouter.post("/groups/:groupId/glosario/notes", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const teamKey = String(req.body?.teamKey ?? "");
  const code = String(req.body?.code ?? "");
  const preset = NOTAS.find((item) => item.code === code);
  if (!teamKey.startsWith("project:") || !preset) {
    return res.status(400).json({ error: "invalid_body", message: "Elige una nota." });
  }
  const { anuncio, estado } = await leerEstado(groupId);
  const nota: Nota = {
    id: `glosario-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: preset.code,
    label: preset.label,
    points: preset.points,
    studentId: typeof req.body?.studentId === "string" ? req.body.studentId : null,
    studentName: typeof req.body?.studentName === "string" ? req.body.studentName : null,
    at: new Date().toISOString(),
  };
  estado.notes[teamKey] = [...(estado.notes[teamKey] ?? []), nota];
  await guardarEstado(groupId, estado, anuncio?.id);
  return res.json({ ok: true });
});

glosarioTeacherRouter.post("/groups/:groupId/glosario/notes/remove", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const teamKey = String(req.body?.teamKey ?? "");
  const noteId = String(req.body?.noteId ?? "");
  const { anuncio, estado } = await leerEstado(groupId);
  estado.notes[teamKey] = (estado.notes[teamKey] ?? []).filter((nota) => nota.id !== noteId);
  await guardarEstado(groupId, estado, anuncio?.id);
  return res.json({ ok: true });
});

glosarioTeacherRouter.post("/groups/:groupId/glosario/grades", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const teamKey = String(req.body?.teamKey ?? "");
  if (!teamKey.startsWith("project:")) return res.status(400).json({ error: "invalid_body", message: "Elige un equipo." });
  const [{ estado }, delivery] = await Promise.all([
    leerEstado(groupId),
    prisma.sqlScrumDelivery.findUnique({
      where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId, teamKey } },
      select: { uploadedAt: true },
    }),
  ]);
  const max = delivery ? entregaDe(group.code, delivery.uploadedAt).points : 0;
  await awardTeam(groupId, teamKey, max, estado.notes[teamKey] ?? []);
  return res.json({ ok: true });
});

glosarioTeacherRouter.get("/groups/:groupId/glosario/:teamKey/file", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const teamKey = String(req.params.teamKey);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const row = await prisma.sqlScrumDelivery.findUnique({
    where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId, teamKey } },
  });
  if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Este equipo todavía no sube su PDF." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentGlosarioRoutes(app: import("express").Express) {
  app.get("/student/glosario", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) {
      const vista = await vistaDePrueba(req.auth!.userId);
      if (vista) return res.json(vista);
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    const row = await prisma.sqlScrumDelivery.findUnique({
      where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId: team.groupId, teamKey: team.teamKey } },
      select: { fileName: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
    });
    let uploadedByName = "";
    if (row) {
      const uploader = await prisma.user.findUnique({ where: { id: row.uploadedById }, select: { displayName: true } });
      uploadedByName = uploader?.displayName ?? "Un integrante";
    }
    return res.json({
      preview: false,
      groupCode: team.groupCode,
      teamKey: team.teamKey,
      teamName: team.teamName,
      delivery: row
        ? {
            fileName: row.fileName,
            sizeBytes: row.sizeBytes,
            uploadedAt: row.uploadedAt.toISOString(),
            uploadedByName,
            points: entregaDe(team.groupCode, row.uploadedAt).points,
          }
        : null,
    });
  });

  app.post(
    "/student/glosario/delivery",
    requireAuth,
    requireStudent,
    requireNotPreviewStudent,
    (req, res, next) => {
      upload.single("file")(req, res, (err: unknown) => {
        const code = (err as { code?: string } | null)?.code;
        if (code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 3 MB. Redúcelo y vuelve a subirlo." });
        }
        if (err) return res.status(400).json({ error: "upload_failed", message: "No se pudo leer el archivo." });
        next();
      });
    },
    async (req: AuthedRequest, res) => {
      if (req.body?.completo !== "si") {
        return res.status(400).json({
          error: "checks_incomplete",
          message: "Antes de subir, marca la carátula, el glosario con palabra y descripción, el reporte general y lo que hizo cada integrante.",
        });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF del equipo." });
      if (file.size > PDF_MAX_BYTES || !isPdf(file)) {
        return res.status(400).json({ error: "pdf_only", message: "Solo se puede subir un PDF de 3 MB o menos." });
      }
      const team = await equipoDelAlumno(req.auth!.userId);
      if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
      const ahora = entregaDe(team.groupCode);
      if (!ahora.open) return res.status(403).json({ error: "closed", message: CIERRE_MENSAJE });
      try {
        const saved = await prisma.sqlScrumDelivery.upsert({
          where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId: team.groupId, teamKey: team.teamKey } },
          create: {
            activityKey: ACTIVITY_KEY,
            groupId: team.groupId,
            teamKey: team.teamKey,
            teamName: team.teamName,
            fileName: safeFileName(file.originalname || "glosario.pdf"),
            mimeType: "application/pdf",
            fileData: file.buffer,
            sizeBytes: file.size,
            uploadedById: req.auth!.userId,
          },
          update: {
            teamName: team.teamName,
            fileName: safeFileName(file.originalname || "glosario.pdf"),
            mimeType: "application/pdf",
            fileData: file.buffer,
            sizeBytes: file.size,
            uploadedById: req.auth!.userId,
          },
        });
        const uploader = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } });
        return res.json({
          delivery: {
            fileName: saved.fileName,
            sizeBytes: saved.sizeBytes,
            uploadedAt: saved.uploadedAt.toISOString(),
            uploadedByName: uploader?.displayName ?? "Un integrante",
            points: entregaDe(team.groupCode, saved.uploadedAt).points || ahora.points,
          },
        });
      } catch (err) {
        console.error("glosario upload failed", err);
        return res.status(500).json({
          error: "upload_failed",
          message: "No se pudo guardar el PDF. Si pesa cerca de 3 MB, redúcelo y vuelve a subirlo.",
        });
      }
    },
  );
}
