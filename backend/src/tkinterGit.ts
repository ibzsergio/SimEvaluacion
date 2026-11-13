import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 8 * 1024 * 1024;
const ACTIVITY_KEY = "git";
const ACTIVITY_TITLE = "ACTIVIDAD TKINTER EN GIT";
const MARK = "[[tkinter-git-state]]";
const CIERRE_302 = "2026-11-13T17:00:00-06:00";
const MENSAJE_CIERRE =
  "Ya pasó la hora. El grupo 302 puede subir el PDF hasta las 5:00 p. m. del viernes 13 de noviembre.";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PDF_MAX_BYTES } });

type TeamRow = {
  id: string;
  name: string;
  leaderId: string | null;
  members: Array<{ student: { id: string; displayName: string; listNumber: number | null } }>;
};

function ordenarEquipos(teams: TeamRow[]) {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }) || a.id.localeCompare(b.id));
}

function equipoPublico(team: TeamRow) {
  const members = [...team.members].sort((a, b) => {
    if (a.student.id === team.leaderId) return -1;
    if (b.student.id === team.leaderId) return 1;
    return a.student.displayName.localeCompare(b.student.displayName, "es");
  });
  return {
    id: team.id,
    name: team.name,
    leaderId: team.leaderId,
    members: members.map((member) => ({
      id: member.student.id,
      displayName: member.student.displayName,
      listNumber: member.student.listNumber,
      isLeader: member.student.id === team.leaderId,
    })),
  };
}

async function equiposDelGrupo(groupId: string) {
  const teams = await prisma.projectTeam.findMany({
    where: { groupId },
    select: {
      id: true,
      name: true,
      leaderId: true,
      members: { select: { student: { select: { id: true, displayName: true, listNumber: true } } } },
    },
  });
  return ordenarEquipos(teams).map(equipoPublico);
}

export const tkinterGitTeacherRouter = Router();
tkinterGitTeacherRouter.use(requireAuth, requireTeacher);

tkinterGitTeacherRouter.get("/groups/:groupId/tkinter-git", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  return res.json({ groupCode: group.code, teams: await equiposDelGrupo(group.id) });
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

async function actividadLiberada(groupId: string) {
  const rows = await prisma.announcement.findMany({
    where: { groupId, title: ACTIVITY_TITLE },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { body: true },
  });
  for (const row of rows) {
    const idx = row.body.indexOf(MARK);
    if (idx < 0) continue;
    try {
      const parsed = JSON.parse(row.body.slice(idx + MARK.length).trim()) as { v?: number; released?: boolean };
      if (parsed?.v === 1) return Boolean(parsed.released);
    } catch {
      /* el aviso siguiente puede sí tener el estado */
    }
  }
  return false;
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

function subidaAbierta(groupCode: string, now = Date.now()) {
  if (groupCode.trim() !== "302") return true;
  return now < new Date(CIERRE_302).getTime();
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

function ligasDe(body: string) {
  const idx = body.indexOf(MARK);
  if (idx < 0) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as { repoLinks?: Record<string, unknown> };
    const links = parsed.repoLinks;
    if (!links || typeof links !== "object") return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(links)) {
      const url = ligaValida(value);
      if (url) out[key] = url;
    }
    return out;
  } catch {
    return {};
  }
}

function ponerLiga(body: string, teamKey: string, url: string) {
  const idx = body.indexOf(MARK);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as { v?: number; repoLinks?: Record<string, string> };
    if (parsed?.v !== 1) return null;
    parsed.repoLinks = { ...(parsed.repoLinks ?? {}), [teamKey]: url };
    return `${body.slice(0, idx + MARK.length)}\n${JSON.stringify(parsed)}`;
  } catch {
    return null;
  }
}

async function anuncioDelGrupo(groupId: string) {
  return prisma.announcement.findFirst({
    where: { groupId, title: ACTIVITY_TITLE },
    orderBy: { createdAt: "desc" },
  });
}

function entregaPublica(
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

tkinterGitTeacherRouter.get("/groups/:groupId/tkinter-git/deliveries", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const rows = await prisma.sqlScrumDelivery.findMany({
    where: { groupId, activityKey: ACTIVITY_KEY },
    select: { teamKey: true, teamName: true, fileName: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
    orderBy: { uploadedAt: "desc" },
  });
  const names = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.uploadedById) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(names.map((user) => [user.id, user.displayName]));
  const anuncio = await anuncioDelGrupo(groupId);
  return res.json({
    deliveries: rows.map((row) => entregaPublica(row, nameById.get(row.uploadedById) ?? "Un integrante")),
    links: anuncio ? ligasDe(anuncio.body) : {},
  });
});

tkinterGitTeacherRouter.get("/groups/:groupId/tkinter-git/:teamKey/file", async (req: AuthedRequest, res) => {
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

export function registerStudentTkinterGitRoutes(app: import("express").Express) {
  app.get("/student/tkinter-git", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const student = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { groupId: true, group: { select: { code: true } } },
    });
    if (!student?.groupId) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un grupo. Pide al docente que te asigne.",
      });
    }
    const teams = await equiposDelGrupo(student.groupId);
    const mine = teams.find((team) => team.members.some((member) => member.id === req.auth!.userId)) ?? null;
    const released = await actividadLiberada(student.groupId);
    return res.json({
      groupCode: student.group?.code ?? "",
      released,
      myTeamId: mine?.id ?? null,
      teams,
    });
  });

  app.get("/student/tkinter-git/delivery", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    const released = await actividadLiberada(team.groupId);
    const anuncio = await anuncioDelGrupo(team.groupId);
    const repoUrl = anuncio ? ligasDe(anuncio.body)[team.teamKey] ?? null : null;
    const row = await prisma.sqlScrumDelivery.findUnique({
      where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId: team.groupId, teamKey: team.teamKey } },
      select: { teamKey: true, teamName: true, fileName: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
    });
    let uploadedByName = "";
    if (row) {
      const uploader = await prisma.user.findUnique({ where: { id: row.uploadedById }, select: { displayName: true } });
      uploadedByName = uploader?.displayName ?? "Un integrante";
    }
    return res.json({
      released,
      teamKey: team.teamKey,
      teamName: team.teamName,
      repoUrl,
      delivery: row ? entregaPublica(row, uploadedByName) : null,
    });
  });

  app.post("/student/tkinter-git/repo", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const team = await equipoDelAlumno(req.auth!.userId);
    if (!team) {
      return res.status(400).json({
        error: "no_team",
        message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
      });
    }
    if (team.groupCode.trim() !== "302") {
      return res.status(403).json({ error: "wrong_group", message: "La liga del repositorio la entrega el grupo 302." });
    }
    if (!subidaAbierta(team.groupCode)) {
      return res.status(403).json({ error: "closed", message: MENSAJE_CIERRE });
    }
    const url = ligaValida(req.body?.url);
    if (!url) {
      return res.status(400).json({
        error: "invalid_url",
        message: "Pega la liga completa del repositorio. Tiene que empezar con https://github.com/ y traer el usuario y el nombre del proyecto.",
      });
    }
    const anuncio = await anuncioDelGrupo(team.groupId);
    if (!anuncio) {
      return res.status(400).json({ error: "not_ready", message: "El docente todavía no prepara la actividad. Pídele que la abra y vuelve a guardar la liga." });
    }
    const next = ponerLiga(anuncio.body, team.teamKey, url);
    if (!next) {
      return res.status(400).json({ error: "not_ready", message: "No se pudo guardar la liga. Recarga la página e inténtalo de nuevo." });
    }
    await prisma.announcement.update({ where: { id: anuncio.id }, data: { body: next } });
    return res.json({ repoUrl: url });
  });

  app.post(
    "/student/tkinter-git/delivery",
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
          message: "Antes de subir, marca que el PDF trae la portada, el programa y el CRUD con la base de datos.",
        });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF del equipo." });
      if (file.size > PDF_MAX_BYTES) {
        return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo." });
      }
      if (!isPdf(file)) return res.status(400).json({ error: "pdf_only", message: "Solo se puede subir un archivo PDF." });
      const team = await equipoDelAlumno(req.auth!.userId);
      if (!team) {
        return res.status(400).json({
          error: "no_team",
          message: "No estás en un equipo de proyecto. Pide al docente que te asigne en Roles / Equipos.",
        });
      }
      if (!(await actividadLiberada(team.groupId))) {
        return res.status(403).json({ error: "not_released", message: "El docente todavía no libera la actividad." });
      }
      if (!subidaAbierta(team.groupCode)) {
        return res.status(403).json({ error: "closed", message: MENSAJE_CIERRE });
      }
      if (team.groupCode.trim() === "302") {
        const anuncio = await anuncioDelGrupo(team.groupId);
        const repoUrl = anuncio ? ligasDe(anuncio.body)[team.teamKey] : undefined;
        if (!repoUrl) {
          return res.status(400).json({
            error: "repo_required",
            message: "Primero guarda la liga del repositorio y agrega a ibzsergio como colaborador.",
          });
        }
      }
      const saved = await prisma.sqlScrumDelivery.upsert({
        where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId: team.groupId, teamKey: team.teamKey } },
        create: {
          activityKey: ACTIVITY_KEY,
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
      const uploader = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } });
      return res.json({ delivery: entregaPublica(saved, uploader?.displayName ?? "Un integrante") });
    },
  );
}
