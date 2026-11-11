import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 8 * 1024 * 1024;
const MARK = "[[crud-state]]";
const TITLE = "TEST";

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
    where: { groupId, title: TITLE },
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

async function studentContext(studentId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT" },
    select: { id: true, groupId: true },
  });
  if (!student?.groupId) return null;
  return { studentId: student.id, groupId: student.groupId };
}

function publicFile(row: { fileName: string; sizeBytes: number; uploadedAt: Date }) {
  return {
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export const crudTeacherRouter = Router();
crudTeacherRouter.use(requireAuth, requireTeacher);

crudTeacherRouter.get("/groups/:groupId/crud/deliveries", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const rows = await prisma.crudDelivery.findMany({
    where: { groupId },
    select: { studentId: true, fileName: true, sizeBytes: true, uploadedAt: true },
    orderBy: { uploadedAt: "desc" },
  });
  return res.json({
    groupCode: group.code,
    deliveries: rows.map((row) => ({ studentId: row.studentId, ...publicFile(row) })),
  });
});

crudTeacherRouter.get("/groups/:groupId/crud/:studentId/file", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const studentId = String(req.params.studentId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const row = await prisma.crudDelivery.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
  });
  if (!row) {
    return res.status(404).json({ error: "delivery_not_found", message: "Este alumno todavía no sube sus evidencias." });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentCrudRoutes(app: import("express").Express) {
  app.get("/student/crud/delivery", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const student = await studentContext(req.auth!.userId);
    if (!student) return res.status(400).json({ error: "student_without_group", message: "No tienes grupo asignado." });
    const released = await activityReleased(student.groupId);
    if (!released) return res.json({ allowed: false, delivery: null });
    const row = await prisma.crudDelivery.findUnique({
      where: { groupId_studentId: { groupId: student.groupId, studentId: student.studentId } },
      select: { fileName: true, sizeBytes: true, uploadedAt: true },
    });
    return res.json({ allowed: true, delivery: row ? publicFile(row) : null });
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
            message: "El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo.",
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
            "Antes de subir, marca que el PDF trae carátula y, por cada tabla, las capturas de guardar, consultar, actualizar y eliminar.",
        });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF con las evidencias de tus 3 tablas." });
      if (file.size > PDF_MAX_BYTES) {
        return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo." });
      }
      if (!isPdf(file)) {
        return res.status(400).json({ error: "pdf_only", message: "Solo se puede subir un archivo PDF." });
      }
      const student = await studentContext(req.auth!.userId);
      if (!student) return res.status(400).json({ error: "student_without_group", message: "No tienes grupo asignado." });
      if (!(await activityReleased(student.groupId))) {
        return res.status(403).json({ error: "not_released", message: "TEST todavía no está liberada para tu grupo." });
      }
      const saved = await prisma.crudDelivery.upsert({
        where: { groupId_studentId: { groupId: student.groupId, studentId: student.studentId } },
        create: {
          groupId: student.groupId,
          studentId: student.studentId,
          fileName: safeFileName(file.originalname || "evidencias-crud.pdf"),
          mimeType: "application/pdf",
          fileData: file.buffer,
          sizeBytes: file.size,
        },
        update: {
          fileName: safeFileName(file.originalname || "evidencias-crud.pdf"),
          mimeType: "application/pdf",
          fileData: file.buffer,
          sizeBytes: file.size,
          uploadedAt: new Date(),
        },
      });
      return res.json({ delivery: publicFile(saved) });
    },
  );
}
