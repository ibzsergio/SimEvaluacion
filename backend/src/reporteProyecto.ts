import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { getPreviewViewGroup, isPreviewControlNumber, requireNotPreviewStudent } from "./previewStudent.js";

const FILE_MAX_BYTES = 4 * 1024 * 1024;
const TITLE = "REPORTE PROYECTO";
const MARK = "[[reporte-proyecto-state]]";
const INICIO = "2026-11-20T00:00:00-06:00";
const CIERRE = "2026-11-26T00:00:00-06:00";
const CIERRE_MENSAJE = "Después del miércoles 25 de noviembre ya no se puede modificar el reporte.";
const DIAS = ["2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25"] as const;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: FILE_MAX_BYTES } });

type Miembro = { doing: string; observation: string };
type Dia = { members: Record<string, Miembro>; commitsNote: string };
type Estado = { v: 1; days: Record<string, Record<string, Dia>> };
const EMPTY: Estado = { v: 1, days: {} };

function abierto(at: number | Date = Date.now()) {
  const ms = at instanceof Date ? at.getTime() : at;
  return ms >= new Date(INICIO).getTime() && ms < new Date(CIERRE).getTime();
}

function hoyMexico(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function diaValido(value: unknown): value is (typeof DIAS)[number] {
  return typeof value === "string" && (DIAS as readonly string[]).includes(value);
}

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function claveArchivo(day: string, who: string) {
  return `rep:${day}:${who}`;
}

function partesClave(activityKey: string) {
  const match = /^rep:(\d{4}-\d{2}-\d{2}):([A-Za-z0-9]+)$/.exec(activityKey);
  const day = match?.[1];
  const who = match?.[2];
  if (!day || !who || !diaValido(day)) return null;
  return { day, who };
}

function tipoDe(file: Express.Multer.File) {
  const bytes = file.buffer;
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("utf8") === "%PDF") return { mime: "application/pdf", ext: "pdf" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("utf8") === "RIFF" && bytes.subarray(8, 12).toString("utf8") === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

function estadoDe(body: string): Estado {
  const idx = body.indexOf(MARK);
  if (idx < 0) return { v: 1, days: {} };
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<Estado>;
    if (parsed?.v !== 1 || !parsed.days || typeof parsed.days !== "object") return { v: 1, days: {} };
    return { v: 1, days: parsed.days };
  } catch {
    return { v: 1, days: {} };
  }
}

async function leerEstado(groupId: string) {
  const anuncio = await prisma.announcement.findFirst({
    where: { groupId, title: TITLE },
    orderBy: { createdAt: "desc" },
  });
  return { anuncio, estado: anuncio ? estadoDe(anuncio.body) : { ...EMPTY, days: {} } };
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

function diaDe(estado: Estado, teamKey: string, day: string): Dia {
  const team = estado.days[teamKey];
  const dia = team?.[day];
  return {
    members: dia?.members && typeof dia.members === "object" ? dia.members : {},
    commitsNote: clip(dia?.commitsNote, 300),
  };
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
  const code = member.student.group?.code ?? "";
  if (code !== "301" && code !== "302") return null;
  const members = [...member.team.members].sort((a, b) => {
    if (a.student.id === member.team.leaderId) return -1;
    if (b.student.id === member.team.leaderId) return 1;
    return a.student.displayName.localeCompare(b.student.displayName, "es");
  });
  return {
    groupId: member.student.groupId,
    groupCode: code,
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

async function archivosDelEquipo(groupId: string, teamKey: string) {
  const rows = await prisma.sqlScrumDelivery.findMany({
    where: { groupId, teamKey, activityKey: { startsWith: "rep:" } },
    select: { activityKey: true, fileName: true, sizeBytes: true },
  });
  const map = new Map<string, { fileName: string; sizeBytes: number }>();
  for (const row of rows) {
    const partes = partesClave(row.activityKey);
    if (!partes) continue;
    map.set(`${partes.day}:${partes.who}`, { fileName: row.fileName, sizeBytes: row.sizeBytes });
  }
  return map;
}

function reporteDe(
  estado: Estado,
  teamKey: string,
  members: { id: string; displayName: string; isLeader: boolean }[],
  files: Map<string, { fileName: string; sizeBytes: number }>,
) {
  const reports: Record<string, unknown> = {};
  for (const day of DIAS) {
    const dia = diaDe(estado, teamKey, day);
    reports[day] = {
      commitsNote: dia.commitsNote,
      commitsFile: files.get(`${day}:commits`) ?? null,
      members: members.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        isLeader: member.isLeader,
        doing: clip(dia.members[member.id]?.doing, 500),
        observation: clip(dia.members[member.id]?.observation, 400),
        file: files.get(`${day}:${member.id}`) ?? null,
      })),
    };
  }
  return reports;
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
    open: abierto(),
    today: hoyMexico(),
    days: DIAS,
    teamKey: "preview",
    teamName: "Vista de prueba",
    isLeader: false,
    hasLeader: true,
    members: [],
    reports: {},
  };
}

export const reporteProyectoTeacherRouter = Router();
reporteProyectoTeacherRouter.use(requireAuth, requireTeacher);

reporteProyectoTeacherRouter.get("/groups/:groupId/reporte-proyecto", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const [{ estado }, teams, rows] = await Promise.all([
    leerEstado(groupId),
    prisma.projectTeam.findMany({
      where: { groupId },
      select: {
        id: true,
        name: true,
        leaderId: true,
        members: { select: { student: { select: { id: true, displayName: true } } } },
      },
    }),
    prisma.sqlScrumDelivery.findMany({
      where: { groupId, activityKey: { startsWith: "rep:" } },
      select: { activityKey: true, teamKey: true, fileName: true, sizeBytes: true },
    }),
  ]);
  const files = new Map<string, { fileName: string; sizeBytes: number }>();
  for (const row of rows) {
    const partes = partesClave(row.activityKey);
    if (!partes) continue;
    files.set(`${row.teamKey}:${partes.day}:${partes.who}`, { fileName: row.fileName, sizeBytes: row.sizeBytes });
  }
  const ordered = [...teams].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }) || a.id.localeCompare(b.id));
  return res.json({
    groupCode: group.code,
    open: abierto(),
    today: hoyMexico(),
    days: DIAS,
    teams: ordered.map((team) => {
      const teamKey = `project:${team.id}`;
      const members = [...team.members]
        .sort((a, b) => {
          if (a.student.id === team.leaderId) return -1;
          if (b.student.id === team.leaderId) return 1;
          return a.student.displayName.localeCompare(b.student.displayName, "es");
        })
        .map((item) => ({
          id: item.student.id,
          displayName: item.student.displayName,
          isLeader: item.student.id === team.leaderId,
        }));
      const teamFiles = new Map<string, { fileName: string; sizeBytes: number }>();
      for (const [key, value] of files) {
        if (key.startsWith(`${teamKey}:`)) teamFiles.set(key.slice(teamKey.length + 1), value);
      }
      return {
        teamKey,
        teamName: team.name,
        leaderName: members.find((member) => member.isLeader)?.displayName ?? null,
        reports: reporteDe(estado, teamKey, members, teamFiles),
      };
    }),
  });
});

reporteProyectoTeacherRouter.get("/groups/:groupId/reporte-proyecto/:teamKey/file", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const teamKey = String(req.params.teamKey);
  const day = String(req.query.day ?? "");
  const who = String(req.query.who ?? "");
  if (!diaValido(day) || !/^[A-Za-z0-9]+$/.test(who)) {
    return res.status(400).json({ error: "invalid_body", message: "Elige el día y la evidencia." });
  }
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const row = await prisma.sqlScrumDelivery.findUnique({
    where: { activityKey_groupId_teamKey: { activityKey: claveArchivo(day, who), groupId, teamKey } },
  });
  if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Esa evidencia todavía no está." });
  res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${row.fileName.replace(/"/g, "")}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentReporteProyectoRoutes(app: import("express").Express) {
  app.get("/student/reporte-proyecto", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
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
    const files = await archivosDelEquipo(team.groupId, team.teamKey);
    return res.json({
      preview: false,
      groupCode: team.groupCode,
      open: abierto(),
      today: hoyMexico(),
      days: DIAS,
      teamKey: team.teamKey,
      teamName: team.teamName,
      isLeader: team.isLeader,
      hasLeader: Boolean(team.leaderId),
      members: team.members,
      reports: reporteDe(estado, team.teamKey, team.members, files),
    });
  });

  app.post("/student/reporte-proyecto", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
    if (!team.isLeader) return res.status(403).json({ error: "not_leader", message: "Solo el líder del proyecto llena el reporte." });
    if (!abierto()) return res.status(403).json({ error: "closed", message: CIERRE_MENSAJE });
    const day = req.body?.day;
    if (!diaValido(day)) return res.status(400).json({ error: "invalid_body", message: "Elige un día hábil: viernes 20, lunes 23, martes 24 o miércoles 25." });
    const incoming = Array.isArray(req.body?.members) ? req.body.members : [];
    const { anuncio, estado } = await leerEstado(team.groupId);
    const actual = diaDe(estado, team.teamKey, day);
    const members = { ...actual.members };
    for (const item of incoming) {
      if (!item || typeof item !== "object") continue;
      const studentId = String((item as { studentId?: unknown }).studentId ?? "");
      if (!team.members.some((member) => member.id === studentId)) continue;
      const row = item as { doing?: unknown; observation?: unknown };
      members[studentId] = { doing: clip(row.doing, 500), observation: clip(row.observation, 400) };
    }
    const teamDays = { ...(estado.days[team.teamKey] ?? {}) };
    teamDays[day] = { members, commitsNote: clip(req.body?.commitsNote, 300) };
    estado.days[team.teamKey] = teamDays;
    await guardarEstado(team.groupId, estado, anuncio?.id);
    return res.json({ ok: true });
  });

  app.post(
    "/student/reporte-proyecto/file",
    requireAuth,
    requireStudent,
    requireNotPreviewStudent,
    (req, res, next) => {
      upload.single("file")(req, res, (err: unknown) => {
        const code = (err as { code?: string } | null)?.code;
        if (code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "file_too_big", message: "El archivo pesa más de 4 MB. Redúcelo y vuelve a subirlo." });
        }
        if (err) return res.status(400).json({ error: "upload_failed", message: "No se pudo leer el archivo." });
        next();
      });
    },
    async (req: AuthedRequest, res) => {
      const team = await equipoDelAlumno(req.auth!.userId);
      if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
      if (!team.isLeader) return res.status(403).json({ error: "not_leader", message: "Solo el líder del proyecto sube las evidencias." });
      if (!abierto()) return res.status(403).json({ error: "closed", message: CIERRE_MENSAJE });
      const day = req.body?.day;
      const who = String(req.body?.who ?? "");
      if (!diaValido(day) || !/^[A-Za-z0-9]+$/.test(who)) {
        return res.status(400).json({ error: "invalid_body", message: "Elige el día y de quién es la evidencia." });
      }
      if (who !== "commits" && !team.members.some((member) => member.id === who)) {
        return res.status(400).json({ error: "invalid_body", message: "Ese alumno no está en tu equipo." });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "file_required", message: "Selecciona una imagen o un PDF." });
      const tipo = tipoDe(file);
      if (!tipo || file.size > FILE_MAX_BYTES) {
        return res.status(400).json({ error: "file_type", message: "Solo se puede subir una imagen JPG, PNG, WEBP o un PDF de 4 MB o menos." });
      }
      const fileName = who === "commits" ? `commits-${day}.${tipo.ext}` : `evidencia-${day}.${tipo.ext}`;
      try {
        const saved = await prisma.sqlScrumDelivery.upsert({
          where: { activityKey_groupId_teamKey: { activityKey: claveArchivo(day, who), groupId: team.groupId, teamKey: team.teamKey } },
          create: {
            activityKey: claveArchivo(day, who),
            groupId: team.groupId,
            teamKey: team.teamKey,
            teamName: team.teamName,
            fileName,
            mimeType: tipo.mime,
            fileData: file.buffer,
            sizeBytes: file.size,
            uploadedById: req.auth!.userId,
          },
          update: {
            teamName: team.teamName,
            fileName,
            mimeType: tipo.mime,
            fileData: file.buffer,
            sizeBytes: file.size,
            uploadedById: req.auth!.userId,
          },
          select: { fileName: true, sizeBytes: true },
        });
        return res.json({ file: saved });
      } catch (err) {
        console.error("reporte proyecto upload failed", err);
        return res.status(500).json({
          error: "upload_failed",
          message: "No se pudo guardar la evidencia. Si pesa cerca de 4 MB, redúcela y vuelve a subirla.",
        });
      }
    },
  );

  app.get("/student/reporte-proyecto/file", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) return res.status(400).json({ error: "no_team", message: "No estás en un equipo de proyecto." });
    const day = String(req.query.day ?? "");
    const who = String(req.query.who ?? "");
    if (!diaValido(day) || !/^[A-Za-z0-9]+$/.test(who)) {
      return res.status(400).json({ error: "invalid_body", message: "Elige el día y la evidencia." });
    }
    const row = await prisma.sqlScrumDelivery.findUnique({
      where: { activityKey_groupId_teamKey: { activityKey: claveArchivo(day, who), groupId: team.groupId, teamKey: team.teamKey } },
    });
    if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Esa evidencia todavía no está." });
    res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${row.fileName.replace(/"/g, "")}"`);
    return res.send(Buffer.from(row.fileData));
  });
}
