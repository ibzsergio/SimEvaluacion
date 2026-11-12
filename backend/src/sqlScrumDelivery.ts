import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 8 * 1024 * 1024;
const PUNTOS = 2000;

const ACTIVITIES = {
  bd2: {
    key: "bd2",
    title: "ACTIVIDAD BASE DE DATOS II",
    mark: "[[sql-scrum:bd2]]",
  },
  bd3: {
    key: "bd3",
    title: "ACTIVIDAD BASE DE DATOS III",
    mark: "[[sql-scrum:bd3]]",
  },
} as const;

type ActivityKey = keyof typeof ACTIVITIES;

const CIERRE: Record<string, { iso: string; texto: string }> = {
  "301": {
    iso: "2026-11-12T15:00:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 301 se cierran a las 3:00 p. m. de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
  "302": {
    iso: "2026-11-12T15:00:00-06:00",
    texto:
      "La entrega y la subida del archivo del grupo 302 se cierran a las 3:00 p. m. de hoy. Después ya no se puede subir y el equipo pierde los 2000 puntos.",
  },
};

function activityOf(key: string): (typeof ACTIVITIES)[ActivityKey] | null {
  return key in ACTIVITIES ? ACTIVITIES[key as ActivityKey] : null;
}

function cierreDe(groupCode?: string | null, now = Date.now()) {
  const item = groupCode ? CIERRE[groupCode.trim()] : undefined;
  if (!item) {
    return {
      texto: "Los grupos 301 y 302 entregan hasta las 3:00 p. m. de hoy.",
      open: false,
    };
  }
  return { texto: item.texto, open: now < new Date(item.iso).getTime() };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PDF_MAX_BYTES } });

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

type Note = { points?: number; studentId?: string | null };

async function teamNotes(groupId: string, activity: (typeof ACTIVITIES)[ActivityKey], teamKey: string) {
  const announcements = await prisma.announcement.findMany({
    where: { groupId, title: activity.title },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { body: true },
  });
  for (const item of announcements) {
    const idx = item.body.indexOf(activity.mark);
    if (idx < 0) continue;
    try {
      const parsed = JSON.parse(item.body.slice(idx + activity.mark.length).trim()) as {
        v?: number;
        notes?: Record<string, Note[]>;
      };
      if (parsed?.v !== 1 || !parsed.notes) continue;
      return Array.isArray(parsed.notes[teamKey]) ? parsed.notes[teamKey] : [];
    } catch {
      /* el aviso siguiente puede sí tener las notas */
    }
  }
  return [];
}

function pointsFor(notes: Note[], studentId: string) {
  const cut = notes
    .filter((note) => !note.studentId || note.studentId === studentId)
    .reduce((acc, note) => acc + Math.max(0, Math.round(Number(note.points) || 0)), 0);
  return Math.max(0, PUNTOS - cut);
}

async function ensureActivity(groupId: string, teacherId: string, title: string) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { currentPartial: true },
  });
  const existing = await prisma.activity.findFirst({
    where: { groupId, name: title },
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
      name: title,
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

async function awardTeam(groupId: string, activity: (typeof ACTIVITIES)[ActivityKey], teamKey: string) {
  const teamId = teamKey.startsWith("project:") ? teamKey.slice("project:".length) : "";
  const [team, group] = await Promise.all([
    prisma.projectTeam.findFirst({
      where: { id: teamId, groupId },
      select: { members: { select: { studentId: true } } },
    }),
    prisma.classGroup.findUnique({ where: { id: groupId }, select: { teacherId: true } }),
  ]);
  if (!team || !group) return;
  const activityId = await ensureActivity(groupId, group.teacherId, activity.title);
  const notes = await teamNotes(groupId, activity, teamKey);
  const gradedAt = new Date();
  for (const member of team.members) {
    const points = pointsFor(notes, member.studentId);
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
  };
}

function publicDelivery(
  row: { teamKey: string; teamName: string; fileName: string; sizeBytes: number; uploadedAt: Date },
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

export const sqlScrumTeacherRouter = Router();
sqlScrumTeacherRouter.use(requireAuth, requireTeacher);

sqlScrumTeacherRouter.get("/groups/:groupId/sql-scrum/:key/deliveries", async (req: AuthedRequest, res) => {
  const activity = activityOf(String(req.params.key));
  if (!activity) return res.status(404).json({ error: "activity_not_found" });
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, teacherId: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  await ensureActivity(group.id, group.teacherId, activity.title);
  const [rows, teams] = await Promise.all([
    prisma.sqlScrumDelivery.findMany({
      where: { groupId, activityKey: activity.key },
      select: { teamKey: true, teamName: true, fileName: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.projectTeam.findMany({
      where: { groupId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        members: { select: { student: { select: { id: true, displayName: true, listNumber: true } } } },
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

sqlScrumTeacherRouter.get("/groups/:groupId/sql-scrum/:key/:teamKey/file", async (req: AuthedRequest, res) => {
  const activity = activityOf(String(req.params.key));
  if (!activity) return res.status(404).json({ error: "activity_not_found" });
  const groupId = String(req.params.groupId);
  const teamKey = String(req.params.teamKey);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const row = await prisma.sqlScrumDelivery.findUnique({
    where: { activityKey_groupId_teamKey: { activityKey: activity.key, groupId, teamKey } },
  });
  if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Este equipo todavía no sube su PDF." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentSqlScrumRoutes(app: import("express").Express) {
  app.get("/student/sql-scrum/:key/delivery", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const activity = activityOf(String(req.params.key));
    if (!activity) return res.status(404).json({ error: "activity_not_found" });
    const team = await studentTeam(req.auth!.userId);
    if (!team) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    const row = await prisma.sqlScrumDelivery.findUnique({
      where: { activityKey_groupId_teamKey: { activityKey: activity.key, groupId: team.groupId, teamKey: team.teamKey } },
      select: { teamKey: true, teamName: true, fileName: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
    });
    let uploadedByName = "";
    if (row) {
      const uploader = await prisma.user.findUnique({ where: { id: row.uploadedById }, select: { displayName: true } });
      uploadedByName = uploader?.displayName ?? "Un integrante";
    }
    const cierre = cierreDe(team.groupCode);
    return res.json({
      allowed: true,
      teamKey: team.teamKey,
      teamName: team.teamName,
      uploadOpen: cierre.open,
      uploadText: cierre.texto,
      delivery: row ? publicDelivery(row, uploadedByName) : null,
    });
  });

  app.post("/student/sql-scrum/:key/delivery", requireAuth, requireStudent, requireNotPreviewStudent, (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      const code = (err as { code?: string } | null)?.code;
      if (code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo." });
      }
      if (err) return res.status(400).json({ error: "upload_failed", message: "No se pudo leer el archivo." });
      next();
    });
  }, async (req: AuthedRequest, res) => {
    const activity = activityOf(String(req.params.key));
    if (!activity) return res.status(404).json({ error: "activity_not_found" });
    if (req.body?.completo !== "si") {
      return res.status(400).json({
        error: "checks_incomplete",
        message: "Antes de subir, marca que el PDF trae la portada y las evidencias en Tkinter de cada tabla.",
      });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF del equipo." });
    if (file.size > PDF_MAX_BYTES) {
      return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo." });
    }
    if (!isPdf(file)) return res.status(400).json({ error: "pdf_only", message: "Solo se puede subir un archivo PDF." });
    const team = await studentTeam(req.auth!.userId);
    if (!team) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    const cierre = cierreDe(team.groupCode);
    if (!cierre.open) {
      return res.status(403).json({ error: "upload_closed", message: `${cierre.texto} Esa hora ya pasó.` });
    }
    const saved = await prisma.sqlScrumDelivery.upsert({
      where: { activityKey_groupId_teamKey: { activityKey: activity.key, groupId: team.groupId, teamKey: team.teamKey } },
      create: {
        activityKey: activity.key,
        groupId: team.groupId,
        teamKey: team.teamKey,
        teamName: team.teamName,
        fileName: safeFileName(file.originalname || "actividad.pdf"),
        mimeType: "application/pdf",
        fileData: file.buffer,
        sizeBytes: file.size,
        uploadedById: req.auth!.userId,
      },
      update: {
        teamName: team.teamName,
        fileName: safeFileName(file.originalname || "actividad.pdf"),
        mimeType: "application/pdf",
        fileData: file.buffer,
        sizeBytes: file.size,
        uploadedById: req.auth!.userId,
      },
    });
    await awardTeam(team.groupId, activity, team.teamKey);
    const uploader = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } });
    return res.json({ delivery: publicDelivery(saved, uploader?.displayName ?? "Un integrante") });
  });
}
