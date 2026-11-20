import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { getPreviewViewGroup, isPreviewControlNumber, requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 8 * 1024 * 1024;
const PUNTOS = 3000;
const DURACION_MS = 150 * 60 * 1000;
const ACTIVITY_KEY = "repo";
const TITLE = "Repositorio Proyecto en GitHub";
const MARK = "[[repo-proyecto-state]]";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PDF_MAX_BYTES } });

type Nota = {
  id: string;
  code: string;
  label: string;
  points: number;
  studentId: string | null;
  studentName: string | null;
  at: string;
};

type LeaderNota = {
  id: string;
  code: string;
  label: string;
  studentId: string;
  studentName: string;
  comment: string;
  at: string;
};

type Estado = {
  v: 1;
  clocks: Record<string, string>;
  links: Record<string, string>;
  notes: Record<string, Nota[]>;
  leaderNotes: Record<string, LeaderNota[]>;
};

const EMPTY: Estado = { v: 1, clocks: {}, links: {}, notes: {}, leaderNotes: {} };

const NOTAS_LIDER = [
  { code: "no_trabaja", label: "No está trabajando" },
  { code: "no_asistio", label: "No asistió" },
  { code: "no_lugar", label: "No está en su lugar de trabajo" },
  { code: "jugando", label: "Está jugando" },
  { code: "fuera", label: "Está fuera del equipo" },
  { code: "otra", label: "Otra situación" },
] as const;

const NOTAS = [
  { code: "colaborador", label: "No agregaron a ibzsergio", points: 500 },
  { code: "sin_commit", label: "No tiene commit en el repositorio", points: 500 },
  { code: "no_clona", label: "No clonó el proyecto", points: 400 },
  { code: "crud", label: "El CRUD no guarda en la base de XAMPP", points: 500 },
  { code: "caratula", label: "Falta la carátula de Canva", points: 400 },
  { code: "commits", label: "No se ven los commits de los integrantes", points: 400 },
] as const;

function estadoDe(body: string): Estado {
  const idx = body.indexOf(MARK);
  if (idx < 0) return { ...EMPTY, clocks: {}, links: {}, notes: {} };
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<Estado>;
    if (parsed?.v !== 1) return { ...EMPTY, clocks: {}, links: {}, notes: {} };
    return {
      v: 1,
      clocks: parsed.clocks && typeof parsed.clocks === "object" ? parsed.clocks : {},
      links: parsed.links && typeof parsed.links === "object" ? parsed.links : {},
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
      leaderNotes: notasLiderDe(parsed.leaderNotes),
    };
  } catch {
    return { ...EMPTY, clocks: {}, links: {}, notes: {} };
  }
}

function notasLiderDe(raw: unknown): Record<string, LeaderNota[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, LeaderNota[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    out[key] = value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<LeaderNota>;
      if (!row.id || !row.studentId || !row.label) return [];
      return [
        {
          id: String(row.id),
          code: String(row.code ?? ""),
          label: String(row.label).slice(0, 140),
          studentId: String(row.studentId),
          studentName: String(row.studentName ?? "").slice(0, 120),
          comment: String(row.comment ?? "").slice(0, 200),
          at: String(row.at ?? ""),
        },
      ];
    });
  }
  return out;
}

function serializar(estado: Estado) {
  return `${TITLE}\n\n${MARK}\n${JSON.stringify(estado)}`;
}

function ligaValida(raw: unknown) {
  const url = String(raw ?? "").trim();
  if (url.length < 18 || url.length > 300) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return null;
    if (host !== "github.com" && host !== "www.github.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const owner = parts[0];
    const repo = parts[1];
    if (!owner || !repo) return null;
    return `https://github.com/${owner}/${repo.replace(/\.git$/i, "")}`;
  } catch {
    return null;
  }
}

const HORARIOS: Record<string, { until: string; points: number }[]> = {
  "301": [
    { until: "2026-11-20T09:30:00-06:00", points: 3000 },
    { until: "2026-11-20T12:00:00-06:00", points: 2000 },
    { until: "2026-11-20T15:00:00-06:00", points: 1000 },
  ],
};
const NOTAS_ABIERTAS_301 = "2026-11-21T00:00:00-06:00";

function cierreMensaje(groupCode: string) {
  if (groupCode.trim() === "301") {
    return "Después de las 3:00 p. m. de hoy, viernes 20 de noviembre, ya no se acepta el PDF.";
  }
  return "Esta entrega no está abierta para tu grupo.";
}

function entregaDe(groupCode: string, at: number | Date = Date.now()) {
  const tramos = HORARIOS[groupCode.trim()];
  const ms = at instanceof Date ? at.getTime() : at;
  if (!tramos) return { open: false, points: 0 };
  for (const tramo of tramos) {
    if (ms < new Date(tramo.until).getTime()) return { open: true, points: tramo.points };
  }
  return { open: false, points: 0 };
}

function puedeAnotar(groupCode: string, started: boolean) {
  if (started) return true;
  return groupCode.trim() === "301" && Date.now() < new Date(NOTAS_ABIERTAS_301).getTime();
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

async function anuncioDelGrupo(groupId: string) {
  return prisma.announcement.findFirst({
    where: { groupId, title: TITLE },
    orderBy: { createdAt: "desc" },
  });
}

async function leerEstado(groupId: string) {
  const anuncio = await anuncioDelGrupo(groupId);
  return { anuncio, estado: anuncio ? estadoDe(anuncio.body) : { ...EMPTY, clocks: {}, links: {}, notes: {} } };
}

async function guardarEstado(groupId: string, estado: Estado, anuncioId?: string) {
  const body = serializar(estado);
  if (anuncioId) {
    await prisma.announcement.update({ where: { id: anuncioId }, data: { body } });
    return;
  }
  const group = await prisma.classGroup.findUnique({ where: { id: groupId }, select: { teacherId: true } });
  if (!group) throw new Error("group_not_found");
  await prisma.announcement.create({
    data: { teacherId: group.teacherId, groupId, title: TITLE, body },
  });
}

async function equipoDelAlumno(studentId: string) {
  const member = await prisma.projectTeamMember.findUnique({
    where: { studentId },
    include: {
      student: { select: { groupId: true, group: { select: { code: true } } } },
      team: {
        select: {
          id: true,
          name: true,
          groupId: true,
          leaderId: true,
          members: { select: { student: { select: { id: true, displayName: true } } } },
        },
      },
    },
  });
  if (!member?.student.groupId || member.team.groupId !== member.student.groupId) return null;
  const members = [...member.team.members].sort((a, b) => {
    if (a.student.id === member.team.leaderId) return -1;
    if (b.student.id === member.team.leaderId) return 1;
    return a.student.displayName.localeCompare(b.student.displayName, "es");
  });
  return {
    groupId: member.student.groupId,
    groupCode: member.student.group?.code ?? "",
    teamKey: `project:${member.team.id}`,
    teamName: member.team.name,
    leaderId: member.team.leaderId,
    isLeader: member.team.leaderId === studentId,
    members: members.map((item) => ({
      id: item.student.id,
      displayName: item.student.displayName,
      isLeader: item.student.id === member.team.leaderId,
    })),
  };
}

function puntosDe(notas: Nota[], studentId: string, max: number) {
  const corte = notas
    .filter((nota) => !nota.studentId || nota.studentId === studentId)
    .reduce((acc, nota) => acc + Math.max(0, nota.points), 0);
  return Math.max(0, max - corte);
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

async function aplicarPuntos(groupId: string, teamKey: string, estado: Estado) {
  const teamId = teamKey.startsWith("project:") ? teamKey.slice("project:".length) : "";
  const [team, group] = await Promise.all([
    prisma.projectTeam.findFirst({
      where: { id: teamId, groupId },
      select: { members: { select: { studentId: true } } },
    }),
    prisma.classGroup.findUnique({ where: { id: groupId }, select: { teacherId: true, code: true } }),
  ]);
  if (!team || !group) return;
  const delivery = await prisma.sqlScrumDelivery.findUnique({
    where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId, teamKey } },
    select: { uploadedAt: true },
  });
  const max = delivery ? entregaDe(group.code, delivery.uploadedAt).points : 0;
  const activityId = await ensureActivity(groupId, group.teacherId);
  const notas = estado.notes[teamKey] ?? [];
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

export const repoProyectoTeacherRouter = Router();
repoProyectoTeacherRouter.use(requireAuth, requireTeacher);

repoProyectoTeacherRouter.get("/groups/:groupId/repo-proyecto", async (req: AuthedRequest, res) => {
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
      select: {
        id: true,
        name: true,
        leaderId: true,
        members: { select: { student: { select: { id: true, displayName: true } } } },
      },
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
      const startedAt = estado.clocks[teamKey] ?? null;
      return {
        teamKey,
        teamName: team.name,
        leaderId: team.leaderId,
        startedAt,
        endsAt: startedAt ? new Date(new Date(startedAt).getTime() + DURACION_MS).toISOString() : null,
        link: estado.links[teamKey] ?? null,
        notes: estado.notes[teamKey] ?? [],
        leaderNotes: estado.leaderNotes[teamKey] ?? [],
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
    })),
  });
});

repoProyectoTeacherRouter.post("/groups/:groupId/repo-proyecto/notes", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const teamKey = String(req.body?.teamKey ?? "");
  const code = String(req.body?.code ?? "");
  const preset = NOTAS.find((item) => item.code === code);
  const customLabel = String(req.body?.label ?? "").trim();
  const customPoints = Number(req.body?.points);
  if (!teamKey.startsWith("project:")) return res.status(400).json({ error: "invalid_body", message: "Elige un equipo." });
  if (!preset && (!customLabel || !Number.isFinite(customPoints))) {
    return res.status(400).json({ error: "invalid_body", message: "Elige una nota." });
  }
  const { anuncio, estado } = await leerEstado(groupId);
  const nota: Nota = {
    id: `repo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: preset ? preset.code : "custom",
    label: (customLabel || preset?.label || code).slice(0, 140),
    points: Math.max(0, Math.round(preset ? preset.points : customPoints)),
    studentId: typeof req.body?.studentId === "string" ? req.body.studentId : null,
    studentName: typeof req.body?.studentName === "string" ? req.body.studentName : null,
    at: new Date().toISOString(),
  };
  estado.notes[teamKey] = [...(estado.notes[teamKey] ?? []), nota];
  await guardarEstado(groupId, estado, anuncio?.id);
  return res.json({ ok: true });
});

repoProyectoTeacherRouter.post("/groups/:groupId/repo-proyecto/notes/remove", async (req: AuthedRequest, res) => {
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

repoProyectoTeacherRouter.post("/groups/:groupId/repo-proyecto/grades", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const { estado } = await leerEstado(groupId);
  const only = typeof req.body?.teamKey === "string" ? req.body.teamKey : "";
  const keys = only ? [only] : Object.keys(estado.clocks);
  for (const teamKey of keys) await aplicarPuntos(groupId, teamKey, estado);
  return res.json({ ok: true });
});

repoProyectoTeacherRouter.get("/groups/:groupId/repo-proyecto/:teamKey/file", async (req: AuthedRequest, res) => {
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
    isLeader: false,
    hasLeader: true,
    members: [],
    startedAt: null,
    endsAt: null,
    link: null,
    leaderNotes: [],
    delivery: null,
  };
}

export function registerStudentRepoProyectoRoutes(app: import("express").Express) {
  app.get("/student/repo-proyecto", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) {
      const vista = await vistaDePrueba(req.auth!.userId);
      if (vista) return res.json(vista);
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    const { estado } = await leerEstado(team.groupId);
    const startedAt = estado.clocks[team.teamKey] ?? null;
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
      groupCode: team.groupCode,
      teamKey: team.teamKey,
      teamName: team.teamName,
      isLeader: team.isLeader,
      hasLeader: Boolean(team.leaderId),
      members: team.members,
      startedAt,
      endsAt: startedAt ? new Date(new Date(startedAt).getTime() + DURACION_MS).toISOString() : null,
      link: estado.links[team.teamKey] ?? null,
      leaderNotes: estado.leaderNotes[team.teamKey] ?? [],
      delivery: row
        ? { fileName: row.fileName, sizeBytes: row.sizeBytes, uploadedAt: row.uploadedAt.toISOString(), uploadedByName }
        : null,
    });
  });

  app.post("/student/repo-proyecto/start", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) {
      return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
    }
    if (!team.leaderId) {
      return res.status(400).json({ error: "no_leader", message: "Este equipo no tiene líder. Pide al docente que lo nombre en Roles / Equipos." });
    }
    if (!team.isLeader) {
      return res.status(403).json({ error: "not_leader", message: "Solo el líder puede iniciar el cronómetro." });
    }
    const { anuncio, estado } = await leerEstado(team.groupId);
    const previo = estado.clocks[team.teamKey];
    const startedAt = previo ?? new Date().toISOString();
    if (!previo) {
      estado.clocks[team.teamKey] = startedAt;
      await guardarEstado(team.groupId, estado, anuncio?.id);
    }
    return res.json({ startedAt, endsAt: new Date(new Date(startedAt).getTime() + DURACION_MS).toISOString() });
  });

  app.post("/student/repo-proyecto/repo", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
    if (!entregaDe(team.groupCode).open) {
      return res.status(403).json({ error: "closed", message: cierreMensaje(team.groupCode) });
    }
    const { anuncio, estado } = await leerEstado(team.groupId);
    const url = ligaValida(req.body?.url);
    if (!url) {
      return res.status(400).json({
        error: "invalid_url",
        message: "Pega la liga completa. Tiene que empezar con https://github.com/ y traer el usuario y el nombre del proyecto.",
      });
    }
    estado.links[team.teamKey] = url;
    await guardarEstado(team.groupId, estado, anuncio?.id);
    return res.json({ link: url });
  });

  app.post("/student/repo-proyecto/leader-notes", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
    if (!team.isLeader) {
      return res.status(403).json({ error: "not_leader", message: "Solo el líder puede anotar a los integrantes." });
    }
    const { anuncio, estado } = await leerEstado(team.groupId);
    if (!puedeAnotar(team.groupCode, Boolean(estado.clocks[team.teamKey]))) {
      return res.status(403).json({ error: "not_started", message: "Hoy el líder del grupo 301 puede anotar a sus compañeros." });
    }
    const code = String(req.body?.code ?? "");
    const preset = NOTAS_LIDER.find((item) => item.code === code);
    if (!preset) {
      return res.status(400).json({
        error: "invalid_body",
        message: "Elige si no está trabajando, no asistió, no está en su lugar, está jugando, está fuera o es otra situación.",
      });
    }
    const studentId = String(req.body?.studentId ?? "");
    const member = team.members.find((item) => item.id === studentId);
    if (!member) return res.status(400).json({ error: "invalid_body", message: "Ese alumno no está en tu equipo." });
    if (member.isLeader) return res.status(400).json({ error: "invalid_body", message: "Anota a un compañero del equipo." });
    const comment = String(req.body?.comment ?? "").trim().slice(0, 200);
    if (preset.code === "otra" && !comment) {
      return res.status(400).json({ error: "invalid_body", message: "En otra situación escribe qué está pasando." });
    }
    const nota: LeaderNota = {
      id: `lider-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: preset.code,
      label: preset.label,
      studentId: member.id,
      studentName: member.displayName,
      comment,
      at: new Date().toISOString(),
    };
    const actuales = estado.leaderNotes[team.teamKey] ?? [];
    estado.leaderNotes[team.teamKey] = [...actuales, nota];
    await guardarEstado(team.groupId, estado, anuncio?.id);
    return res.json({ ok: true });
  });

  app.post("/student/repo-proyecto/leader-notes/remove", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
    if (!team.isLeader) {
      return res.status(403).json({ error: "not_leader", message: "Solo el líder puede quitar sus notas." });
    }
    const noteId = String(req.body?.noteId ?? "");
    const { anuncio, estado } = await leerEstado(team.groupId);
    estado.leaderNotes[team.teamKey] = (estado.leaderNotes[team.teamKey] ?? []).filter((nota) => nota.id !== noteId);
    await guardarEstado(team.groupId, estado, anuncio?.id);
    return res.json({ ok: true });
  });

  app.post(
    "/student/repo-proyecto/delivery",
    requireAuth,
    requireStudent,
    requireNotPreviewStudent,
    (req, res, next) => {
      upload.single("file")(req, res, (err: unknown) => {
        const code = (err as { code?: string } | null)?.code;
        if (code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo." });
        }
        if (err) return res.status(400).json({ error: "upload_failed", message: "No se pudo leer el archivo." });
        next();
      });
    },
    async (req: AuthedRequest, res) => {
      if (req.body?.completo !== "si") {
        return res.status(400).json({
          error: "checks_incomplete",
          message: "Antes de subir, marca la carátula, las evidencias de cada integrante, los CRUD y los commits.",
        });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF del equipo." });
      if (file.size > PDF_MAX_BYTES || !isPdf(file)) {
        return res.status(400).json({ error: "pdf_only", message: "Solo se puede subir un PDF de 8 MB o menos." });
      }
      const team = await equipoDelAlumno(req.auth!.userId);
      if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
      if (!entregaDe(team.groupCode).open) {
        return res.status(403).json({ error: "closed", message: cierreMensaje(team.groupCode) });
      }
      const { estado } = await leerEstado(team.groupId);
      if (!estado.links[team.teamKey]) {
        return res.status(400).json({ error: "repo_required", message: "Primero guarda la liga del repositorio y agrega a ibzsergio como colaborador." });
      }
      try {
        const saved = await prisma.sqlScrumDelivery.upsert({
          where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId: team.groupId, teamKey: team.teamKey } },
          create: {
            activityKey: ACTIVITY_KEY,
            groupId: team.groupId,
            teamKey: team.teamKey,
            teamName: team.teamName,
            fileName: safeFileName(file.originalname || "repositorio.pdf"),
            mimeType: "application/pdf",
            fileData: file.buffer,
            sizeBytes: file.size,
            uploadedById: req.auth!.userId,
          },
          update: {
            teamName: team.teamName,
            fileName: safeFileName(file.originalname || "repositorio.pdf"),
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
          },
        });
      } catch (err) {
        console.error("repo proyecto upload failed", err);
        return res.status(500).json({
          error: "upload_failed",
          message: "No se pudo guardar el PDF. Si pesa cerca de 8 MB, redúcelo y vuelve a subirlo.",
        });
      }
    },
  );
}
