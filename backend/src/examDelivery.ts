import { Router } from "express";
import multer from "multer";
import { prisma } from "./prisma.js";
import { requireAuth, requireStudent, requireTeacher, type AuthedRequest } from "./middleware.js";
import { requireNotPreviewStudent } from "./previewStudent.js";

const PDF_MAX_BYTES = 3 * 1024 * 1024;
const EXAM_GROUP = "302";
const EXAM_UNTIL = "2026-11-06T17:00:00-06:00";
const EXAM_TEXT = "El examen solo se puede subir hoy, hasta las 5:00 p. m.";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_MAX_BYTES },
});

function examOpen(now = Date.now()) {
  return now < new Date(EXAM_UNTIL).getTime();
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

async function studentContext(studentId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT" },
    select: {
      id: true,
      displayName: true,
      groupId: true,
      group: { select: { code: true } },
    },
  });
  if (!student?.groupId) return null;
  return {
    studentId: student.id,
    displayName: student.displayName,
    groupId: student.groupId,
    groupCode: student.group?.code ?? "",
  };
}

function publicFile(row: { fileName: string; sizeBytes: number; uploadedAt: Date }) {
  return {
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export const examTeacherRouter = Router();
examTeacherRouter.use(requireAuth, requireTeacher);

examTeacherRouter.get("/groups/:groupId/examen/deliveries", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const rows = await prisma.examDelivery.findMany({
    where: { groupId },
    select: { studentId: true, fileName: true, sizeBytes: true, uploadedAt: true },
    orderBy: { uploadedAt: "desc" },
  });
  return res.json({
    groupCode: group.code,
    onlyGroup: EXAM_GROUP,
    uploadText: EXAM_TEXT,
    uploadOpen: examOpen(),
    deliveries: rows.map((row) => ({
      studentId: row.studentId,
      ...publicFile(row),
    })),
  });
});

examTeacherRouter.get("/groups/:groupId/examen/:studentId/file", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const studentId = String(req.params.studentId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  const row = await prisma.examDelivery.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
  });
  if (!row) return res.status(404).json({ error: "delivery_not_found", message: "Este alumno todavía no sube el examen." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(row.fileName)}"`);
  return res.send(Buffer.from(row.fileData));
});

export function registerStudentExamRoutes(app: import("express").Express) {
  app.get("/student/examen/delivery", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
    const student = await studentContext(req.auth!.userId);
    if (!student) return res.status(400).json({ error: "student_without_group", message: "No tienes grupo asignado." });
    if (student.groupCode.trim() !== EXAM_GROUP) {
      return res.json({ allowed: false, uploadOpen: false, uploadText: null, delivery: null });
    }
    const row = await prisma.examDelivery.findUnique({
      where: { groupId_studentId: { groupId: student.groupId, studentId: student.studentId } },
      select: { fileName: true, sizeBytes: true, uploadedAt: true },
    });
    return res.json({
      allowed: true,
      uploadOpen: examOpen(),
      uploadText: EXAM_TEXT,
      delivery: row ? publicFile(row) : null,
    });
  });

  app.post(
    "/student/examen/delivery",
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
          message: "Antes de subir, marca que el PDF trae carátula, fotos legibles, tu nombre, la fecha y el margen amarillo.",
        });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: "pdf_required", message: "Selecciona el PDF de tu examen." });
      if (file.size > PDF_MAX_BYTES) {
        return res.status(400).json({ error: "pdf_too_big", message: "El PDF pesa más de 3 MB. Redúcelo y vuelve a subirlo." });
      }
      if (!isPdf(file)) {
        return res.status(400).json({ error: "pdf_only", message: "Solo se puede subir un archivo PDF." });
      }
      const student = await studentContext(req.auth!.userId);
      if (!student) return res.status(400).json({ error: "student_without_group", message: "No tienes grupo asignado." });
      if (student.groupCode.trim() !== EXAM_GROUP) {
        return res.status(403).json({ error: "wrong_group", message: "El examen solo lo sube el grupo 302." });
      }
      if (!examOpen()) {
        return res.status(403).json({
          error: "upload_closed",
          message: `${EXAM_TEXT} Esa hora ya pasó y ya no se acepta el PDF.`,
        });
      }
      const saved = await prisma.examDelivery.upsert({
        where: { groupId_studentId: { groupId: student.groupId, studentId: student.studentId } },
        create: {
          groupId: student.groupId,
          studentId: student.studentId,
          fileName: safeFileName(file.originalname || "examen.pdf"),
          mimeType: "application/pdf",
          fileData: file.buffer,
          sizeBytes: file.size,
        },
        update: {
          fileName: safeFileName(file.originalname || "examen.pdf"),
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
