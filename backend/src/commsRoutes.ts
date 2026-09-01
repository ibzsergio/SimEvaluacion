import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { requireAuth, requireTeacher, type AuthedRequest } from "./middleware.js";
import {
  createTeacherGroup,
  deleteTeacherGroup,
  resetSemesterForTeacher,
  SEMESTER_RESET_PHRASE,
} from "./semesterService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const commsTeacherRouter = Router();
commsTeacherRouter.use(requireAuth, requireTeacher);

commsTeacherRouter.get("/", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.userId;
  const [announcements, tasks, calendar, groups] = await Promise.all([
    prisma.announcement.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      include: { group: { select: { code: true } } },
    }),
    prisma.task.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      include: { group: { select: { code: true } } },
    }),
    prisma.schoolCalendar.findUnique({ where: { teacherId } }),
    prisma.classGroup.findMany({
      where: { teacherId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, shift: true },
    }),
  ]);

  return res.json({
    announcements,
    tasks,
    calendar: calendar
      ? {
          id: calendar.id,
          title: calendar.title,
          semesterLabel: calendar.semesterLabel,
          fileName: calendar.fileName,
          mimeType: calendar.mimeType,
          publishedAt: calendar.publishedAt,
        }
      : null,
    groups,
  });
});

commsTeacherRouter.post("/announcements", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(8000),
      groupId: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  if (body.data.groupId) {
    const group = await prisma.classGroup.findFirst({
      where: { id: body.data.groupId, teacherId: req.auth!.userId },
    });
    if (!group) return res.status(404).json({ error: "group_not_found" });
  }

  const created = await prisma.announcement.create({
    data: {
      teacherId: req.auth!.userId,
      groupId: body.data.groupId ?? null,
      title: body.data.title,
      body: body.data.body,
    },
    include: { group: { select: { code: true } } },
  });
  return res.json({ announcement: created });
});

commsTeacherRouter.delete("/announcements/:id", async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.announcement.findFirst({
    where: { id, teacherId: req.auth!.userId },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });
  await prisma.announcement.delete({ where: { id } });
  return res.json({ ok: true });
});

commsTeacherRouter.post("/tasks", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(8000),
      groupId: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  if (body.data.groupId) {
    const group = await prisma.classGroup.findFirst({
      where: { id: body.data.groupId, teacherId: req.auth!.userId },
    });
    if (!group) return res.status(404).json({ error: "group_not_found" });
  }

  const created = await prisma.task.create({
    data: {
      teacherId: req.auth!.userId,
      groupId: body.data.groupId ?? null,
      title: body.data.title,
      body: body.data.body,
      dueDate: body.data.dueDate ? new Date(`${body.data.dueDate}T12:00:00.000Z`) : null,
    },
    include: { group: { select: { code: true } } },
  });
  return res.json({ task: created });
});

commsTeacherRouter.delete("/tasks/:id", async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.task.findFirst({
    where: { id, teacherId: req.auth!.userId },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });
  await prisma.task.delete({ where: { id } });
  return res.json({ ok: true });
});

commsTeacherRouter.post("/calendar", upload.single("file"), async (req: AuthedRequest, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "file_required" });

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return res.status(400).json({ error: "invalid_file_type" });
  }

  const title = String(req.body.title ?? "Calendario escolar").trim() || "Calendario escolar";
  const semesterLabel = String(req.body.semesterLabel ?? "").trim() || null;

  const calendar = await prisma.schoolCalendar.upsert({
    where: { teacherId: req.auth!.userId },
    create: {
      teacherId: req.auth!.userId,
      title,
      semesterLabel,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileData: file.buffer,
    },
    update: {
      title,
      semesterLabel,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileData: file.buffer,
      publishedAt: new Date(),
    },
  });

  return res.json({
    calendar: {
      id: calendar.id,
      title: calendar.title,
      semesterLabel: calendar.semesterLabel,
      fileName: calendar.fileName,
      mimeType: calendar.mimeType,
      publishedAt: calendar.publishedAt,
    },
  });
});

commsTeacherRouter.delete("/calendar", async (req: AuthedRequest, res) => {
  await prisma.schoolCalendar.deleteMany({ where: { teacherId: req.auth!.userId } });
  return res.json({ ok: true });
});

commsTeacherRouter.get("/calendar/file", async (req: AuthedRequest, res) => {
  const calendar = await prisma.schoolCalendar.findUnique({
    where: { teacherId: req.auth!.userId },
  });
  if (!calendar) return res.status(404).json({ error: "not_found" });

  res.setHeader("Content-Type", calendar.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${calendar.fileName}"`);
  return res.send(Buffer.from(calendar.fileData));
});

commsTeacherRouter.post("/semester/reset", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      confirmPhrase: z.string(),
      clearComms: z.boolean().optional().default(false),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  if (body.data.confirmPhrase.trim().toUpperCase() !== SEMESTER_RESET_PHRASE) {
    return res.status(400).json({ error: "invalid_confirm_phrase" });
  }

  const result = await resetSemesterForTeacher(req.auth!.userId, body.data.clearComms);
  return res.json(result);
});

commsTeacherRouter.post("/groups", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      code: z.string().trim().min(1).max(32),
      shift: z.string().trim().min(1).max(64).optional().default("matutino"),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  try {
    const group = await createTeacherGroup(req.auth!.userId, body.data.code, body.data.shift);
    return res.json({ group });
  } catch (err) {
    if (err instanceof Error && err.message === "invalid_group_code") {
      return res.status(400).json({ error: "invalid_group_code" });
    }
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2002") {
      return res.status(400).json({ error: "group_already_exists" });
    }
    throw err;
  }
});

commsTeacherRouter.delete("/groups/:groupId", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  try {
    const result = await deleteTeacherGroup(req.auth!.userId, groupId);
    return res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "group_not_found") {
      return res.status(404).json({ error: "group_not_found" });
    }
    throw err;
  }
});

export async function getStudentComms(userId: string) {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { groupId: true, group: { select: { teacherId: true } } },
  });
  if (!student?.groupId || !student.group?.teacherId) {
    return { announcements: [], tasks: [], calendar: null };
  }

  const teacherId = student.group.teacherId;
  const groupId = student.groupId;

  const [announcements, tasks, calendar] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        teacherId,
        OR: [{ groupId: null }, { groupId }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, body: true, createdAt: true, groupId: true },
    }),
    prisma.task.findMany({
      where: {
        teacherId,
        OR: [{ groupId: null }, { groupId }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        dueDate: true,
        createdAt: true,
        groupId: true,
      },
    }),
    prisma.schoolCalendar.findUnique({
      where: { teacherId },
      select: {
        id: true,
        title: true,
        semesterLabel: true,
        fileName: true,
        mimeType: true,
        publishedAt: true,
      },
    }),
  ]);

  return { announcements, tasks, calendar };
}

export async function getStudentCalendarFile(userId: string) {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { group: { select: { teacherId: true } } },
  });
  if (!student?.group?.teacherId) return null;

  return prisma.schoolCalendar.findUnique({
    where: { teacherId: student.group.teacherId },
  });
}
