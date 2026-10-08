import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { signAuthToken, verifyAuthTokenForRefresh } from "./auth.js";
import { requireAuth, requireTeacher, requireStudent, type AuthedRequest } from "./middleware.js";
import {
  ensurePreviewStudent,
  ensurePreviewStudentForAnyTeacher,
  getPreviewViewGroup,
  isPreviewControlNumber,
  loadStudentViewContext,
  PREVIEW_CONTROL_NUMBER,
  requireNotPreviewStudent,
} from "./previewStudent.js";
import { ensureTeacherGroups } from "./groups.js";
import { removeJunkStudentsForGroup } from "./dedupeStudents.js";
import { teacherGroupsRouter, upsertStudentActivityGrade } from "./teacherGroups.js";
import { officeExamTeacherRouter } from "./officeExam/officeExamRoutes.js";
import {
  commsTeacherRouter,
  getStudentCalendarFile,
  getStudentComms,
  sendCalendarFile,
} from "./commsRoutes.js";
import {
  getStudentAttendanceSummary,
  getStudentParticipationStars,
  formatClassDayIso,
  parseClassDayDate,
  todayClassDayDate,
} from "./classDayService.js";
import {
  getStudentOfficeExamState,
  saveStudentAnswers,
  startStudentExam,
  submitStudentExam,
  getDiplomaGradeInfo,
} from "./officeExam/officeExamRoutes.js";
import { getGroupRanking, getOfficialGroupRanking, RANKING_RULE } from "./groupRanking.js";
import {
  chooseLecturaLeader,
  getLecturaSession,
  lecturaErrorHttp,
  startLecturaTimer,
  studentLecturaAssignment,
} from "./lecturaSession.js";
import {
  chooseTorreLeader,
  getTorreSession,
  startTorreTimer,
  studentTorreAssignment,
  torreErrorHttp,
} from "./torreChallenge.js";
import { buildStudentMotivation } from "./studentMotivation.js";
import { getStudentSeating } from "./seatingService.js";
import { ensureSeatingSchema, getSeatingSchemaStatus } from "./ensureSeatingSchema.js";
import { ensureClassDaySchema } from "./ensureClassDaySchema.js";
import { ensureSkillSurveySchema } from "./ensureSkillSurveySchema.js";
import { ensurePartialExamSchema } from "./ensurePartialExamSchema.js";
import { ensurePartialCutSchema } from "./ensurePartialCutSchema.js";
import { ensureDiplomaSchema } from "./ensureDiplomaSchema.js";
import { ensureLecturaSchema } from "./ensureLecturaSchema.js";
import { ensureTorreSchema } from "./ensureTorreSchema.js";
import { dropPythonPracticeSchema } from "./ensurePythonPracticeSchema.js";
import { ensureCompilerSchema, getCompilerReleasedForGroup } from "./ensureCompilerSchema.js";
import { getStudentSurveyState, submitStudentSurvey } from "./skillSurveyService.js";
import { runMigrationsWithRecovery } from "./runMigrations.js";
import { streamDiplomaPdf } from "./diplomaPdf.js";
import { SKILL_SURVEY_QUESTIONS } from "./skillSurvey.js";

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(express.json({ limit: "200kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/health/seating", async (_req, res) => {
  try {
    const status = await getSeatingSchemaStatus();
    res.status(status.ready ? 200 : 503).json({ ok: status.ready, ...status });
  } catch (err) {
    res.status(503).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

function userPayload(user: {
  id: string;
  role: "TEACHER" | "STUDENT";
  displayName: string;
  email: string | null;
  controlNumber: string | null;
  listNumber: number | null;
  group: { id: string; code: string; shift: string } | null;
}) {
  return {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    email: user.email,
    controlNumber: user.controlNumber,
    listNumber: user.listNumber,
    group: user.group,
  };
}

app.post("/auth/login/teacher", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(4),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const user = await prisma.user.findFirst({
    where: { email: body.data.email, role: "TEACHER" },
    include: { group: { select: { id: true, code: true, shift: true } } },
  });
  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const ok = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  await ensurePreviewStudent(user.id);
  const token = signAuthToken({ sub: user.id, role: user.role });
  return res.json({ token, user: userPayload(user) });
});

const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

app.post("/auth/login/student", async (req, res) => {
  const body = z
    .object({
      controlNumber: z.coerce.string().trim().min(1).max(64),
      password: z.preprocess(emptyToUndefined, z.string().min(4).optional()),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  let controlNumber = body.data.controlNumber.replace(/\s/g, "");
  if (isPreviewControlNumber(controlNumber)) {
    controlNumber = PREVIEW_CONTROL_NUMBER;
    await ensurePreviewStudentForAnyTeacher();
  }
  const user = await prisma.user.findFirst({
    where: { controlNumber, role: "STUDENT" },
    include: { group: { select: { id: true, code: true, shift: true } } },
  });
  if (!user) {
    return res.status(401).json({
      error: "student_not_found",
      message: "Número de control no encontrado. Pide al docente que importe tu lista.",
    });
  }

  if (!user.passwordSet) {
    return res.status(403).json({
      error: "password_not_set",
      student: {
        controlNumber: user.controlNumber,
        displayName: user.displayName,
      },
    });
  }

  if (!body.data.password) {
    return res.status(400).json({ error: "password_required" });
  }

  const ok = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signAuthToken({ sub: user.id, role: user.role });
  const payloadUser = { ...user };
  if (isPreviewControlNumber(user.controlNumber) && user.group) {
    const teacherId = (
      await prisma.classGroup.findUnique({
        where: { id: user.group.id },
        select: { teacherId: true },
      })
    )?.teacherId;
    const viewGroup = teacherId ? await getPreviewViewGroup(teacherId) : null;
    if (viewGroup) payloadUser.group = viewGroup;
  }
  return res.json({ token, user: userPayload(payloadUser) });
});

app.post("/auth/refresh", async (req, res) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "missing_token" });
  try {
    const payload = verifyAuthTokenForRefresh(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { group: { select: { id: true, code: true, shift: true } } },
    });
    if (!user) return res.status(401).json({ error: "invalid_token" });
    const token = signAuthToken({ sub: user.id, role: user.role });
    const payloadUser = { ...user };
    if (isPreviewControlNumber(user.controlNumber) && user.group) {
      const teacherId = (
        await prisma.classGroup.findUnique({
          where: { id: user.group.id },
          select: { teacherId: true },
        })
      )?.teacherId;
      const viewGroup = teacherId ? await getPreviewViewGroup(teacherId) : null;
      if (viewGroup) payloadUser.group = viewGroup;
    }
    return res.json({ token, user: userPayload(payloadUser) });
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
});

app.post("/auth/student/create-password", async (req, res) => {
  const body = z
    .object({
      controlNumber: z.coerce.string().trim().min(1).max(64),
      password: z.string().min(4).max(64),
      confirmPassword: z.string().min(4).max(64),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });
  if (body.data.password !== body.data.confirmPassword) {
    return res.status(400).json({ error: "password_mismatch" });
  }

  const controlNumber = body.data.controlNumber.trim().replace(/\s/g, "");
  const user = await prisma.user.findFirst({
    where: { controlNumber, role: "STUDENT" },
    include: { group: { select: { id: true, code: true, shift: true } } },
  });
  if (!user) return res.status(404).json({ error: "student_not_found" });
  if (user.passwordSet) {
    return res.status(400).json({ error: "password_already_set" });
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordSet: true,
      recoverablePassword: null,
    },
    include: { group: { select: { id: true, code: true, shift: true } } },
  });

  const token = signAuthToken({ sub: updated.id, role: updated.role });
  return res.json({ token, user: userPayload(updated) });
});

// Seed simple users for local dev (teacher + a few students)
app.post("/auth/dev-seed", async (_req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "not_found" });

  const teacherEmail = "seribamont@gmail.com";
  const teacherPass = "c4l1f1c4c10n3s***";
  const studentPass = "1234";

  const teacherHash = await bcrypt.hash(teacherPass, 10);
  const studentHash = await bcrypt.hash(studentPass, 10);

  const teacher = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {
      passwordHash: teacherHash,
      passwordSet: true,
      role: "TEACHER",
      displayName: "Sergio Ibañez Montiel",
    },
    create: {
      email: teacherEmail,
      passwordHash: teacherHash,
      passwordSet: true,
      role: "TEACHER",
      displayName: "Sergio Ibañez Montiel",
    },
  });

  await ensureTeacherGroups(teacher.id);

  return res.json({
    teacher: { email: teacher.email, password: teacherPass },
    note: "Importa alumnos por Excel desde el panel del docente (hojas con el código de cada grupo).",
  });
});

app.use("/teacher", teacherGroupsRouter);
app.use("/teacher/office-exam", officeExamTeacherRouter);
app.use("/teacher/comms", commsTeacherRouter);

// Teacher: create/list activities
app.get("/teacher/activities", requireAuth, requireTeacher, async (req: AuthedRequest, res) => {
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  if (!groupId) return res.status(400).json({ error: "group_id_required" });

  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const activities = await prisma.activity.findMany({
    where: { createdById: req.auth!.userId, groupId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { group: { select: { code: true, shift: true } } },
  });
  return res.json({
    activities: activities.map((a) => ({ ...a, date: formatClassDayIso(a.date) })),
  });
});

app.post("/teacher/activities", requireAuth, requireTeacher, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      groupId: z.string().min(1),
      date: z.string(), // YYYY-MM-DD
      name: z.string().min(2),
      maxPoints: z.number().int().min(1),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const group = await prisma.classGroup.findFirst({
    where: { id: body.data.groupId, teacherId: req.auth!.userId },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const activityDate = parseClassDayDate(body.data.date);
  if (!activityDate) return res.status(400).json({ error: "invalid_date" });

  const lastOrder = await prisma.activity.aggregate({
    where: { groupId: group.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (lastOrder._max.sortOrder ?? -1) + 1;

  const created = await prisma.activity.create({
    data: {
      date: activityDate,
      name: body.data.name,
      maxPoints: body.data.maxPoints,
      signatureMax: 0,
      sortOrder,
      partialNumber: group.currentPartial ?? 1,
      groupId: group.id,
      createdById: req.auth!.userId,
    },
    include: { group: { select: { code: true, shift: true } } },
  });
  return res.json({
    activity: { ...created, date: formatClassDayIso(created.date) },
  });
});

app.put("/teacher/activities/:activityId", requireAuth, requireTeacher, async (req: AuthedRequest, res) => {
  const activityId = String(req.params.activityId);
  const body = z
    .object({
      date: z.string(),
      name: z.string().min(2),
      maxPoints: z.number().int().min(1),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const existing = await prisma.activity.findFirst({
    where: { id: activityId, createdById: req.auth!.userId },
  });
  if (!existing) return res.status(404).json({ error: "activity_not_found" });

  const activityDate = parseClassDayDate(body.data.date);
  if (!activityDate) return res.status(400).json({ error: "invalid_date" });

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      date: activityDate,
      name: body.data.name.trim(),
      maxPoints: body.data.maxPoints,
    },
    include: { group: { select: { code: true, shift: true } } },
  });

  return res.json({
    activity: { ...updated, date: formatClassDayIso(updated.date) },
  });
});

app.delete(
  "/teacher/activities/:activityId",
  requireAuth,
  requireTeacher,
  async (req: AuthedRequest, res) => {
    const activityId = String(req.params.activityId);

    const existing = await prisma.activity.findFirst({
      where: { id: activityId, createdById: req.auth!.userId },
    });
    if (!existing) return res.status(404).json({ error: "activity_not_found" });

    await prisma.activity.delete({ where: { id: activityId } });

    return res.json({ ok: true, deletedId: activityId });
  },
);

// Teacher: list students + their grade for an activity
app.get(
  "/teacher/activities/:activityId/grades",
  requireAuth,
  requireTeacher,
  async (req: AuthedRequest, res) => {
    const activityId = String(req.params.activityId);
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, createdById: req.auth!.userId },
    });
    if (!activity) return res.status(404).json({ error: "activity_not_found" });

    await removeJunkStudentsForGroup(activity.groupId);

    const students = await prisma.user.findMany({
      where: { role: "STUDENT", groupId: activity.groupId },
      orderBy: [{ displayName: "asc" }, { listNumber: "asc" }],
      select: { id: true, listNumber: true, controlNumber: true, displayName: true },
    });

    const grades = await prisma.grade.findMany({
      where: { activityId },
      select: { studentId: true, points: true, gradedAt: true },
    });
    const submissions = await prisma.submission.findMany({
      where: { activityId },
      select: { studentId: true, submittedAt: true },
    });
    const byStudent = new Map(grades.map((g) => [g.studentId, g]));
    const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));

    return res.json({
      activity: { ...activity, date: formatClassDayIso(activity.date) },
      rows: students.map((s) => ({
        student: s,
        grade: byStudent.get(s.id) ?? null,
        submission: submissionByStudent.get(s.id) ?? null,
      })),
    });
  },
);

app.put(
  "/teacher/activities/:activityId/grades/:studentId",
  requireAuth,
  requireTeacher,
  async (req: AuthedRequest, res) => {
    const activityId = String(req.params.activityId);
    const studentId = String(req.params.studentId);
    const body = z
      .object({
        points: z.number().int().min(0),
      })
      .safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_body" });

    try {
      const grade = await upsertStudentActivityGrade({
        teacherId: req.auth!.userId,
        activityId,
        studentId,
        points: body.data.points,
      });
      return res.json({ grade });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "activity_not_found") return res.status(404).json({ error: "activity_not_found" });
      if (msg === "student_not_found") return res.status(404).json({ error: "student_not_found" });
      throw err;
    }
  },
);

// Student: progress + leaderboard
app.get("/student/progress", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });

  const ctx = await loadStudentViewContext(req.auth!.userId);
  if (!ctx) {
    return res.status(400).json({ error: "student_without_group" });
  }
  const me = { groupId: ctx.groupId, displayName: ctx.me.displayName, listNumber: ctx.me.listNumber };
  const preview = ctx.preview;

  const myGroup = await prisma.classGroup.findUnique({
    where: { id: me.groupId },
    select: {
      id: true,
      code: true,
      shift: true,
      plannedActivities: true,
      progressClosed: true,
      partialClosed: true,
      partialClosedAt: true,
      diplomaEnabled: true,
      diplomaEnabledAt: true,
      lecturaReleased: true,
      lecturaReleasedAt: true,
      torreReleased: true,
      torreReleasedAt: true,
      currentPartial: true,
    },
  });

  const activities = await prisma.activity.findMany({
    where: { groupId: me.groupId, partialNumber: myGroup?.currentPartial ?? 1 },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, date: true, name: true, maxPoints: true, createdAt: true },
  });

  const grades = await prisma.grade.findMany({
    where: { studentId: req.auth!.userId },
    select: { activityId: true, points: true, gradedAt: true },
  });
  const byActivity = new Map(grades.map((g) => [g.activityId, g]));

  const { ranking, rankingPartial } = await getGroupRanking(me.groupId);

  const myEntry = ranking.find((r) => r.studentId === req.auth!.userId);
  const myPlace = myEntry?.place ?? ranking.length;
  const myScore = myEntry?.score ?? 0;
  const top10 = ranking.slice(0, 10);

  function badgeForPlace(place: number): string | null {
    if (place === 1) return "gold";
    if (place === 2) return "silver";
    if (place === 3) return "bronze";
    if (place <= 10) return "top10";
    return null;
  }

  const activityRows = activities.map((a) => {
    const grade = byActivity.get(a.id) ?? null;
    const dateIso = formatClassDayIso(a.date);
    const dueEnd = new Date(`${dateIso}T23:59:59.999Z`);
    const isOverdue = !grade && Date.now() > dueEnd.getTime();
    const status: "pending" | "graded" = grade ? "graded" : "pending";

    return {
      id: a.id,
      name: a.name,
      date: dateIso,
      publishedAt: a.createdAt,
      maxPoints: a.maxPoints,
      status,
      isOverdue,
      grade: grade ? { points: grade.points, gradedAt: grade.gradedAt } : null,
      submission: null,
    };
  });

  const summary = {
    total: activityRows.length,
    graded: activityRows.filter((a) => a.status === "graded").length,
    pending: activityRows.filter((a) => a.status === "pending").length,
    overdue: activityRows.filter((a) => a.status === "pending" && a.isOverdue).length,
  };

  const planned = myGroup?.plannedActivities ?? null;
  const progressClosed = myGroup?.progressClosed ?? false;
  const gradedCount = summary.graded;
  const totalForActivitiesProgress = planned ?? activityRows.length;
  const activitiesPercentRaw =
    totalForActivitiesProgress > 0 ? Math.round((gradedCount / totalForActivitiesProgress) * 100) : 0;
  const activitiesPercent =
    !progressClosed && activityRows.length > 0 && gradedCount >= activityRows.length
      ? Math.min(activitiesPercentRaw, 99)
      : activitiesPercentRaw;

  const maxPointsTotal = activities.reduce((acc, a) => acc + (a.maxPoints ?? 0), 0);
  const pointsPercent = maxPointsTotal > 0 ? Math.round((myScore / maxPointsTotal) * 100) : 0;
  const motivation = buildStudentMotivation(
    req.auth!.userId,
    me.displayName,
    myPlace,
    ranking.length,
    myScore,
    ranking,
    myGroup?.partialClosed ?? false,
    myGroup?.currentPartial ?? 1,
  );

  const participationStars = await getStudentParticipationStars(
    req.auth!.userId,
    me.groupId,
    myGroup?.currentPartial ?? 1,
  );
  const attendance = await getStudentAttendanceSummary(
    req.auth!.userId,
    me.groupId,
    myGroup?.currentPartial ?? 1,
  );
  let seating = null;
  if (!preview) {
    try {
      seating = await getStudentSeating(req.auth!.userId, me.groupId, todayClassDayDate());
    } catch (err) {
      console.warn("[student/progress] seating lookup failed:", err);
    }
  }

  const lecturaSession = await getLecturaSession(me.groupId);
  const lectura = lecturaSession
    ? studentLecturaAssignment(lecturaSession, req.auth!.userId, me.displayName)
    : null;
  const torreSession = await getTorreSession(me.groupId);
  const torre = torreSession ? studentTorreAssignment(torreSession, req.auth!.userId) : null;
  const compilerReleased = myGroup ? await getCompilerReleasedForGroup(myGroup.id) : false;

  return res.json({
    preview,
    group: myGroup ? { ...myGroup, compilerReleased } : myGroup,
    my: {
      score: myScore,
      place: myPlace,
      totalStudents: ranking.length,
      badge: badgeForPlace(myPlace),
      listNumber: me.listNumber,
      inTop10: motivation.inTop10,
      participationStars,
      placeBeforeAttendance: myEntry?.placeBeforeAttendance ?? myPlace,
      placesDroppedByAttendance: myEntry?.placesDroppedByAttendance ?? 0,
      attendanceDemotionMessages: myEntry?.attendanceDemotionMessages ?? [],
    },
    classEngagement: {
      participationStars,
      attendance,
    },
    seating,
    lectura,
    torre,
    motivation,
    summary,
    top10,
    rankingPartial,
    rankingRule: RANKING_RULE,
    courseProgress: progressClosed
      ? { mode: "points", closed: true, current: myScore, total: maxPointsTotal, percent: pointsPercent }
      : {
          mode: "activities",
          closed: false,
          current: gradedCount,
          total: totalForActivitiesProgress,
          percent: Math.max(0, Math.min(activitiesPercent, 99)),
        },
    activities: activityRows,
  });
});

app.get("/student/skill-survey", requireAuth, requireStudent, async (req: AuthedRequest, res) => {
  try {
    const state = await getStudentSurveyState(req.auth!.userId);
    return res.json(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    if (msg === "student_without_group") return res.status(400).json({ error: msg });
    console.error("[skill-survey] student get failed:", err);
    return res.status(500).json({ error: "skill_survey_failed" });
  }
});

app.post("/student/skill-survey", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  const answersSchema = z.record(z.string(), z.number().int().min(1).max(5));
  const body = z.object({ answers: answersSchema }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  // Ensure all questions present
  for (const q of SKILL_SURVEY_QUESTIONS) {
    if (body.data.answers[q.id] == null) {
      return res.status(400).json({ error: "incomplete_answers" });
    }
  }

  try {
    const result = await submitStudentSurvey(req.auth!.userId, body.data.answers);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    if (msg === "student_without_group" || msg === "incomplete_answers") {
      return res.status(400).json({ error: msg });
    }
    console.error("[skill-survey] student submit failed:", err);
    return res.status(500).json({ error: "skill_survey_failed" });
  }
});

app.post("/student/lectura/leader", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  const body = z.object({ leaderId: z.string().min(1) }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "invalid_body" });
  const me = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { groupId: true, displayName: true },
  });
  if (!me?.groupId) return res.status(400).json({ error: "student_without_group" });
  try {
    const session = await chooseLecturaLeader(me.groupId, req.auth!.userId, body.data.leaderId);
    if (!session) return res.status(404).json({ error: "group_not_found" });
    return res.json({ lectura: studentLecturaAssignment(session, req.auth!.userId, me.displayName) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    const mapped = lecturaErrorHttp(msg);
    return res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
  }
});

app.post("/student/lectura/start", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { groupId: true, displayName: true },
  });
  if (!me?.groupId) return res.status(400).json({ error: "student_without_group" });
  try {
    const session = await startLecturaTimer(me.groupId, req.auth!.userId);
    if (!session) return res.status(404).json({ error: "group_not_found" });
    return res.json({ lectura: studentLecturaAssignment(session, req.auth!.userId, me.displayName) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    const mapped = lecturaErrorHttp(msg);
    return res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
  }
});

app.post("/student/torre/leader", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  const body = z.object({ leaderId: z.string().min(1) }).safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "invalid_body" });
  const me = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { groupId: true },
  });
  if (!me?.groupId) return res.status(400).json({ error: "student_without_group" });
  try {
    const session = await chooseTorreLeader(me.groupId, req.auth!.userId, body.data.leaderId);
    if (!session) return res.status(404).json({ error: "group_not_found" });
    return res.json({ torre: studentTorreAssignment(session, req.auth!.userId) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    const mapped = torreErrorHttp(msg);
    return res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
  }
});

app.post("/student/torre/start", requireAuth, requireStudent, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { groupId: true },
  });
  if (!me?.groupId) return res.status(400).json({ error: "student_without_group" });
  try {
    const session = await startTorreTimer(me.groupId, req.auth!.userId);
    if (!session) return res.status(404).json({ error: "group_not_found" });
    return res.json({ torre: studentTorreAssignment(session, req.auth!.userId) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    const mapped = torreErrorHttp(msg);
    return res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
  }
});

app.get("/student/diploma.pdf", requireAuth, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });

  const me = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { displayName: true, groupId: true },
  });
  if (!me?.groupId) return res.status(400).json({ error: "student_without_group" });

  const group = await prisma.classGroup.findUnique({
    where: { id: me.groupId },
    select: {
      code: true,
      shift: true,
      partialClosed: true,
      partialClosedAt: true,
      diplomaEnabled: true,
      currentPartial: true,
    },
  });
  if (!group?.partialClosed || !group.partialClosedAt) {
    return res.status(403).json({
      error: "partial_not_closed",
      message: "El diploma estará disponible cuando el docente cierre el parcial y active los diplomas.",
    });
  }
  if (!group.diplomaEnabled) {
    return res.status(403).json({
      error: "diploma_not_enabled",
      message: "El docente está validando calificaciones. El diploma se habilitará cuando lo autorice.",
    });
  }

  const { ranking } = await getOfficialGroupRanking(me.groupId);
  const myEntry = ranking.find((r) => r.studentId === req.auth!.userId);
  const place = myEntry?.place ?? ranking.length;
  const score = myEntry?.score ?? 0;
  const gradeInfo = await getDiplomaGradeInfo(req.auth!.userId, me.groupId);

  const safeName = me.displayName.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ.-]/g, "").trim() || "alumno";
  return streamDiplomaPdf(
    res,
    {
      studentName: me.displayName,
      groupCode: group.code,
      groupShift: group.shift,
      place: gradeInfo.place,
      totalStudents: ranking.length,
      score,
      partialClosedAt: group.partialClosedAt,
      totalFirmas: gradeInfo.totalFirmas,
      finalGrade: gradeInfo.finalGrade,
      firmasScore6: gradeInfo.firmasScore6,
      examScore4: gradeInfo.examScore4,
      isExempt: gradeInfo.isExempt,
      currentPartial: group.currentPartial ?? 1,
    },
    `diploma_${safeName.replace(/\s+/g, "_")}.pdf`,
  );
});

app.get("/student/comms", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });
  const data = await getStudentComms(req.auth!.userId);
  return res.json(data);
});

app.get("/student/calendar/file", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });
  const calendar = await getStudentCalendarFile(req.auth!.userId);
  if (!calendar) return res.status(404).json({ error: "calendar_not_found" });
  return sendCalendarFile(res, calendar);
});

app.get("/student/office-exam", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });
  const state = await getStudentOfficeExamState(req.auth!.userId);
  return res.json(state);
});

app.post("/student/office-exam/start", requireAuth, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });
  try {
    const state = await startStudentExam(req.auth!.userId);
    return res.json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "exam_disabled") return res.status(403).json({ error: "exam_disabled" });
    if (msg === "already_submitted") return res.status(400).json({ error: "already_submitted" });
    return res.status(400).json({ error: msg });
  }
});

app.put("/student/office-exam/answers", requireAuth, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });
  const body = z.object({ answers: z.record(z.string(), z.string()) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });
  try {
    const result = await saveStudentAnswers(req.auth!.userId, body.data.answers);
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "already_submitted") return res.status(400).json({ error: "already_submitted" });
    return res.status(400).json({ error: msg });
  }
});

app.post("/student/office-exam/submit", requireAuth, requireNotPreviewStudent, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });
  const body = z.object({ answers: z.record(z.string(), z.string()) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });
  try {
    const state = await submitStudentExam(req.auth!.userId, body.data.answers);
    return res.json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return res.status(400).json({ error: msg });
  }
});

const port = Number(process.env.PORT ?? 4000);
const host = "0.0.0.0";

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return;
  const direct = ["MYSQL_URL", "MYSQL_PUBLIC_URL", "MYSQL_PRIVATE_URL"];
  for (const key of direct) {
    const value = process.env[key]?.trim();
    if (value) {
      process.env.DATABASE_URL = value;
      console.log(`[startup] DATABASE_URL set from ${key}`);
      return;
    }
  }
  const mysqlHost = process.env.MYSQLHOST ?? process.env.MYSQL_HOST;
  if (!mysqlHost) return;
  const mysqlPort = process.env.MYSQLPORT ?? process.env.MYSQL_PORT ?? "3306";
  const mysqlUser = process.env.MYSQLUSER ?? process.env.MYSQL_USER ?? "root";
  const mysqlPass = process.env.MYSQLPASSWORD ?? process.env.MYSQL_PASSWORD ?? "";
  const mysqlDb = process.env.MYSQLDATABASE ?? process.env.MYSQL_DATABASE ?? "railway";
  process.env.DATABASE_URL = `mysql://${encodeURIComponent(mysqlUser)}:${encodeURIComponent(mysqlPass)}@${mysqlHost}:${mysqlPort}/${mysqlDb}`;
  console.log("[startup] DATABASE_URL built from MYSQLHOST/MYSQLUSER/MYSQLDATABASE");
}

function shouldRunMigrations() {
  if (process.env.SKIP_MIGRATIONS === "1") return false;
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  return false;
}

app.use((req, res) => {
  res.status(404).json({ error: "not_found", method: req.method, path: req.path });
});

// Listen only after migrations + seating schema are ready.
void (async () => {
  resolveDatabaseUrl();
  try {
    if (shouldRunMigrations() && process.env.DATABASE_URL?.trim()) {
      try {
        runMigrationsWithRecovery();
      } catch (err) {
        console.warn("[startup] prisma migrate deploy failed; continuing with seating repair.", err);
      }
    }
    await ensureSeatingSchema();
    await ensureClassDaySchema();
    await ensureSkillSurveySchema();
    await ensurePartialExamSchema();
    await ensurePartialCutSchema();
    await ensureDiplomaSchema();
    await ensureLecturaSchema();
    await ensureTorreSchema();
    await dropPythonPracticeSchema();
    await ensureCompilerSchema();
  } catch (err) {
    console.error("[startup] Startup schema failed:", err);
    process.exit(1);
  }

  app.listen(port, host, () => {
    console.log(`[startup] API listening on http://${host}:${port}`);
  });
})().catch((err) => {
  console.error("[startup] Fatal bootstrap error:", err);
  process.exit(1);
});

