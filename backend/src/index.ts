import "dotenv/config";
import { execSync } from "node:child_process";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { signAuthToken } from "./auth.js";
import { requireAuth, requireTeacher, type AuthedRequest } from "./middleware.js";
import { ensureTeacherGroups } from "./groups.js";
import { teacherGroupsRouter } from "./teacherGroups.js";
import { getGroupRanking, RANKING_RULE } from "./groupRanking.js";

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
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

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

  const controlNumber = body.data.controlNumber.replace(/\s/g, "");
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
  return res.json({ token, user: userPayload(user) });
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
    note: "Importa alumnos por Excel en grupos 201 y 202 desde el panel del docente.",
  });
});

app.use("/teacher", teacherGroupsRouter);

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
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { group: { select: { code: true, shift: true } } },
  });
  return res.json({ activities });
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

  const created = await prisma.activity.create({
    data: {
      date: new Date(body.data.date),
      name: body.data.name,
      maxPoints: body.data.maxPoints,
      signatureMax: 0,
      groupId: group.id,
      createdById: req.auth!.userId,
    },
    include: { group: { select: { code: true, shift: true } } },
  });
  return res.json({ activity: created });
});

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
      activity,
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

    const activity = await prisma.activity.findFirst({
      where: { id: activityId, createdById: req.auth!.userId },
      select: { id: true, maxPoints: true, groupId: true },
    });
    if (!activity) return res.status(404).json({ error: "activity_not_found" });

    const student = await prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT", groupId: activity.groupId },
    });
    if (!student) return res.status(404).json({ error: "student_not_found" });

    const clampedPoints = Math.min(body.data.points, activity.maxPoints);

    const grade = await prisma.grade.upsert({
      where: { activityId_studentId: { activityId, studentId } },
      update: { points: clampedPoints, signatures: 0, gradedById: req.auth!.userId },
      create: {
        activityId,
        studentId,
        points: clampedPoints,
        signatures: 0,
        gradedById: req.auth!.userId,
      },
    });

    // Al registrar/calificar, consideramos la actividad como entregada.
    // Esto permite que el docente capture calificaciones aunque ya haya vencido (p. ej. con justificante).
    await prisma.submission.upsert({
      where: { activityId_studentId: { activityId, studentId } },
      update: { submittedAt: new Date() },
      create: { activityId, studentId, submittedAt: new Date() },
    });

    return res.json({ grade });
  },
);

// Student: progress + leaderboard
app.get("/student/progress", requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.role !== "STUDENT") return res.status(403).json({ error: "forbidden" });

  const me = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { groupId: true, displayName: true, listNumber: true },
  });
  if (!me?.groupId) {
    return res.status(400).json({ error: "student_without_group" });
  }

  const myGroup = await prisma.classGroup.findUnique({
    where: { id: me.groupId },
    select: { id: true, code: true, shift: true, plannedActivities: true, progressClosed: true },
  });

  const activities = await prisma.activity.findMany({
    where: { groupId: me.groupId },
    orderBy: [{ createdAt: "desc" }, { date: "desc" }],
    select: { id: true, date: true, name: true, maxPoints: true, createdAt: true },
  });

  const grades = await prisma.grade.findMany({
    where: { studentId: req.auth!.userId },
    select: { activityId: true, points: true, gradedAt: true },
  });
  const byActivity = new Map(grades.map((g) => [g.activityId, g]));

  const { ranking } = await getGroupRanking(me.groupId);

  const myEntry = ranking.find((r) => r.studentId === req.auth!.userId);
  const myPlace = myEntry?.place ?? ranking.length;
  const myScore = ranking.find((r) => r.studentId === req.auth!.userId)?.score ?? 0;
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
    const dueEnd = new Date(a.date);
    dueEnd.setHours(23, 59, 59, 999);
    const isOverdue = !grade && Date.now() > dueEnd.getTime();
    const status: "pending" | "graded" = grade ? "graded" : "pending";

    return {
      id: a.id,
      name: a.name,
      date: a.date,
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

  return res.json({
    group: myGroup,
    my: {
      score: myScore,
      place: myPlace,
      totalStudents: ranking.length,
      badge: badgeForPlace(myPlace),
      listNumber: me.listNumber,
    },
    summary,
    top10,
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

function runMigrations() {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[startup] Missing DATABASE_URL for migrations.");
    process.exit(1);
  }
  console.log("[startup] Running prisma migrate deploy...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "pipe", encoding: "utf8" });
  } catch (err) {
    const output = `${(err as { stdout?: string }).stdout ?? ""}${(err as { stderr?: string }).stderr ?? ""}${String(err)}`;
    if (output.includes("P3009") && output.includes("20260528023800_group_progress_settings")) {
      console.log("[startup] Recovering failed migration 20260528023800_group_progress_settings...");
      execSync("npx prisma migrate resolve --rolled-back 20260528023800_group_progress_settings", {
        stdio: "inherit",
      });
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
    } else {
      console.error(output);
      throw err;
    }
  }
  console.log("[startup] Migrations complete.");
}

// Listen first so Railway healthcheck can reach /health while migrations run.
app.listen(port, host, () => {
  console.log(`[startup] API listening on http://${host}:${port}`);
  resolveDatabaseUrl();
  try {
    runMigrations();
  } catch (err) {
    console.error("[startup] Migration failed:", err);
    process.exit(1);
  }
});

