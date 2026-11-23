import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { getPreviewViewGroup, isPreviewControlNumber, PREVIEW_CONTROL_NUMBER, requireNotPreviewStudent } from "./previewStudent.js";

const TITLE = "Propuesta Árbol de Navidad";
const MARK = "[[arbol-navidad-state]]";
const PROPOSAL_MARK = "[[arbol-navidad-proposal]]";
const ACTIVITY_KEY = "arbol";
const PDF_MAX_BYTES = 5 * 1024 * 1024;
const TEXTO_MAX = 1500;
const SOLO_301 = "Esta actividad es solo del grupo 301.";
const NO_LIBERADA = "El docente todavía no libera esta actividad.";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PDF_MAX_BYTES } });

type Propuesta = { studentId: string; text: string; updatedAt: string };
type Estado = { v: 1; released: boolean };

function estadoDe(body: string): Estado {
  const idx = body.indexOf(MARK);
  if (idx < 0) return { v: 1, released: false };
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<Estado>;
    return { v: 1, released: Boolean(parsed?.released) };
  } catch {
    return { v: 1, released: false };
  }
}

function propuestaDe(body: string): Propuesta | null {
  const idx = body.indexOf(PROPOSAL_MARK);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + PROPOSAL_MARK.length).trim()) as Partial<Propuesta>;
    if (!parsed?.studentId || typeof parsed.text !== "string") return null;
    return { studentId: parsed.studentId, text: clip(parsed.text), updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "" };
  } catch {
    return null;
  }
}

async function anunciosDelGrupo(groupId: string) {
  return prisma.announcement.findMany({
    where: { groupId, title: TITLE },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true },
  });
}

async function leerEstado(groupId: string) {
  const anuncios = await anunciosDelGrupo(groupId);
  const anuncio = anuncios.find((item) => item.body.includes(MARK) && !item.body.includes(PROPOSAL_MARK));
  return {
    anuncio,
    estado: anuncio ? estadoDe(anuncio.body) : { v: 1 as const, released: false },
    propuestas: propuestasDe(anuncios),
  };
}

async function guardarPropuesta(groupId: string, studentId: string, text: string) {
  const updatedAt = new Date().toISOString();
  const body = `${TITLE}\n\n${PROPOSAL_MARK}\n${JSON.stringify({ studentId, text, updatedAt })}`;
  const anuncios = await anunciosDelGrupo(groupId);
  const propios = anuncios.filter((item) => propuestaDe(item.body)?.studentId === studentId);
  const primero = propios[0];
  if (primero) {
    await prisma.announcement.update({ where: { id: primero.id }, data: { body } });
    const extras = propios.slice(1).map((item) => item.id);
    if (extras.length) await prisma.announcement.deleteMany({ where: { id: { in: extras } } });
  } else {
    const group = await prisma.classGroup.findUnique({ where: { id: groupId }, select: { teacherId: true } });
    if (!group) throw new Error("group_not_found");
    await prisma.announcement.create({ data: { teacherId: group.teacherId, groupId, title: TITLE, body } });
  }
  return { text, updatedAt };
}

function propuestasDe(anuncios: { id: string; body: string }[]) {
  const map = new Map<string, Propuesta>();
  for (const item of anuncios) {
    const propuesta = propuestaDe(item.body);
    if (!propuesta) continue;
    const previa = map.get(propuesta.studentId);
    if (!previa || propuesta.updatedAt > previa.updatedAt) map.set(propuesta.studentId, propuesta);
  }
  return map;
}

async function guardarEstado(groupId: string, estado: Estado, anuncioId?: string) {
  const visible = estado.released
    ? `${TITLE} está liberada. Cada alumno escribe su propuesta y puede subir un PDF.`
    : `${TITLE} está en preparación. Los alumnos todavía no la ven.`;
  const body = `${visible}\n\n${MARK}\n${JSON.stringify(estado)}`;
  if (anuncioId) {
    await prisma.announcement.update({ where: { id: anuncioId }, data: { body } });
    return;
  }
  const group = await prisma.classGroup.findUnique({ where: { id: groupId }, select: { teacherId: true } });
  if (!group) throw new Error("group_not_found");
  await prisma.announcement.create({ data: { teacherId: group.teacherId, groupId, title: TITLE, body } });
}

function safeFileName(name: string) {
  const clean = name.replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]+/g, "_").slice(0, 120);
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

function isPdf(file: Express.Multer.File) {
  const buffer = file.buffer;
  if (!buffer || buffer.length < 5) return false;
  const head = buffer.subarray(0, Math.min(buffer.length, 1024));
  return head.includes(Buffer.from("%PDF"));
}

function clip(value: unknown) {
  return String(value ?? "").trim().slice(0, TEXTO_MAX);
}

async function alumnoActual(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      controlNumber: true,
      groupId: true,
      group: { select: { code: true, teacherId: true } },
    },
  });
  if (!user?.groupId || !user.group) return null;
  if (isPreviewControlNumber(user.controlNumber)) {
    const view = await getPreviewViewGroup(user.group.teacherId);
    if (!view) return null;
    return { preview: true as const, id: user.id, displayName: user.displayName, groupId: view.id, groupCode: view.code };
  }
  return {
    preview: false as const,
    id: user.id,
    displayName: user.displayName,
    groupId: user.groupId,
    groupCode: user.group.code,
  };
}

async function archivoDe(groupId: string, studentId: string) {
  return prisma.sqlScrumDelivery.findUnique({
    where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId, teamKey: studentId } },
    select: { fileName: true, sizeBytes: true, uploadedAt: true },
  });
}

export const arbolNavidadTeacherRouter = Router();
arbolNavidadTeacherRouter.use(requireAuth, requireTeacher);

arbolNavidadTeacherRouter.get("/groups/:groupId/arbol-navidad", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  if (group.code !== "301") {
    return res.json({ groupCode: group.code, released: false, students: [] });
  }
  const [{ estado, propuestas }, students, files] = await Promise.all([
    leerEstado(groupId),
    prisma.user.findMany({
      where: { groupId, role: "STUDENT", NOT: { controlNumber: PREVIEW_CONTROL_NUMBER } },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.sqlScrumDelivery.findMany({
      where: { groupId, activityKey: ACTIVITY_KEY },
      select: { teamKey: true, fileName: true, sizeBytes: true, uploadedAt: true },
    }),
  ]);
  const byStudent = new Map(files.map((file) => [file.teamKey, file]));
  return res.json({
    groupCode: group.code,
    released: estado.released,
    students: students.map((student) => {
      const file = byStudent.get(student.id);
      const proposal = propuestas.get(student.id);
      return {
        id: student.id,
        displayName: student.displayName,
        text: clip(proposal?.text),
        updatedAt: proposal?.updatedAt ?? null,
        file: file
          ? { fileName: file.fileName, sizeBytes: file.sizeBytes, uploadedAt: file.uploadedAt.toISOString() }
          : null,
      };
    }),
  });
});

arbolNavidadTeacherRouter.post("/groups/:groupId/arbol-navidad/release", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const body = z.object({ released: z.boolean() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  if (group.code !== "301") return res.status(403).json({ error: "wrong_group", message: SOLO_301 });
  const { anuncio, estado } = await leerEstado(groupId);
  estado.released = body.data.released;
  await guardarEstado(groupId, estado, anuncio?.id);
  return res.json({ released: estado.released });
});

arbolNavidadTeacherRouter.get("/groups/:groupId/arbol-navidad/:studentId/file", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const studentId = String(req.params.studentId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const student = await prisma.user.findFirst({ where: { id: studentId, groupId, role: "STUDENT" }, select: { id: true } });
  if (!student) return res.status(404).json({ error: "student_not_found", message: "Ese alumno no está en el grupo." });
  const row = await prisma.sqlScrumDelivery.findUnique({
    where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId, teamKey: studentId } },
  });
  if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Este alumno todavía no sube su PDF." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentArbolRoutes(app: import("express").Express) {
  app.get("/student/arbol-navidad", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const alumno = await alumnoActual(req.auth!.userId);
    if (!alumno || alumno.groupCode !== "301") {
      return res.json({ preview: Boolean(alumno?.preview), groupCode: alumno?.groupCode ?? "", released: false, text: "", file: null });
    }
    const { estado, propuestas } = await leerEstado(alumno.groupId);
    if (alumno.preview) {
      return res.json({ preview: true, groupCode: "301", released: estado.released, text: "", file: null });
    }
    const proposal = propuestas.get(alumno.id);
    const file = estado.released ? await archivoDe(alumno.groupId, alumno.id) : null;
    return res.json({
      preview: false,
      groupCode: "301",
      released: estado.released,
      text: estado.released ? clip(proposal?.text) : "",
      updatedAt: estado.released ? (proposal?.updatedAt ?? null) : null,
      file:
        file && estado.released
          ? { fileName: file.fileName, sizeBytes: file.sizeBytes, uploadedAt: file.uploadedAt.toISOString() }
          : null,
    });
  });

  app.post("/student/arbol-navidad", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const body = z.object({ text: z.string().max(TEXTO_MAX) }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "text_too_long", message: `La propuesta puede tener hasta ${TEXTO_MAX} caracteres.` });
    }
    const text = body.data.text.trim();
    if (!text) return res.status(400).json({ error: "text_required", message: "Escribe tu propuesta antes de guardarla." });
    const alumno = await alumnoActual(req.auth!.userId);
    if (!alumno || alumno.groupCode !== "301") return res.status(403).json({ error: "wrong_group", message: SOLO_301 });
    const { estado } = await leerEstado(alumno.groupId);
    if (!estado.released) return res.status(403).json({ error: "not_released", message: NO_LIBERADA });
    const saved = await guardarPropuesta(alumno.groupId, alumno.id, text);
    return res.json(saved);
  });

  app.get("/student/arbol-navidad/file", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
    const alumno = await alumnoActual(req.auth!.userId);
    if (!alumno || alumno.groupCode !== "301") return res.status(403).json({ error: "wrong_group", message: SOLO_301 });
    const { estado } = await leerEstado(alumno.groupId);
    if (!estado.released) return res.status(403).json({ error: "not_released", message: NO_LIBERADA });
    const row = await prisma.sqlScrumDelivery.findUnique({
      where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId: alumno.groupId, teamKey: alumno.id } },
    });
    if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Todavía no subes tu PDF." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
    return res.send(Buffer.from(row.fileData));
  });

  app.post(
    "/student/arbol-navidad/file",
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
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: "pdf_required", message: "No llegó el PDF. Vuelve a elegir el archivo." });
      }
      if (file.size > PDF_MAX_BYTES || file.buffer.length > PDF_MAX_BYTES) {
        return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 5 MB. Redúcelo y vuelve a subirlo." });
      }
      if (!isPdf(file)) {
        return res.status(400).json({ error: "pdf_only", message: "Ese archivo no es un PDF. Sube un solo PDF de máximo 5 MB." });
      }
      const alumno = await alumnoActual(req.auth!.userId);
      if (!alumno || alumno.groupCode !== "301") return res.status(403).json({ error: "wrong_group", message: SOLO_301 });
      const { estado } = await leerEstado(alumno.groupId);
      if (!estado.released) return res.status(403).json({ error: "not_released", message: NO_LIBERADA });
      try {
        const saved = await prisma.sqlScrumDelivery.upsert({
          where: { activityKey_groupId_teamKey: { activityKey: ACTIVITY_KEY, groupId: alumno.groupId, teamKey: alumno.id } },
          create: {
            activityKey: ACTIVITY_KEY,
            groupId: alumno.groupId,
            teamKey: alumno.id,
            teamName: alumno.displayName.slice(0, 120),
            fileName: safeFileName(file.originalname || "propuesta-arbol.pdf"),
            mimeType: "application/pdf",
            fileData: file.buffer,
            sizeBytes: file.size,
            uploadedById: alumno.id,
          },
          update: {
            teamName: alumno.displayName.slice(0, 120),
            fileName: safeFileName(file.originalname || "propuesta-arbol.pdf"),
            mimeType: "application/pdf",
            fileData: file.buffer,
            sizeBytes: file.size,
            uploadedById: alumno.id,
          },
          select: { fileName: true, sizeBytes: true, uploadedAt: true },
        });
        return res.json({
          file: { fileName: saved.fileName, sizeBytes: saved.sizeBytes, uploadedAt: saved.uploadedAt.toISOString() },
        });
      } catch (err) {
        console.error("arbol navidad upload failed", err);
        return res.status(500).json({
          error: "upload_failed",
          message: "No se pudo guardar el PDF. Si pesa cerca de 5 MB, redúcelo y vuelve a subirlo.",
        });
      }
    },
  );
}
