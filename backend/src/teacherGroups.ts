import { Router } from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import { z } from "zod";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { prisma } from "./prisma.js";
import { parseStudentsExcel, parseStudentsWorkbook } from "./excel.js";
import { parseGradesExcel, parseGradesWorkbook } from "./importGradesExcel.js";
import { ensureTeacherGroups, placeholderPasswordHash } from "./groups.js";
import { dedupeStudentsForTeacher, removeJunkStudentsForGroup } from "./dedupeStudents.js";
import { importStudentRows } from "./importStudents.js";
import { importGradesForGroup, type GradeImportMode } from "./importGrades.js";
import { getGroupRanking, RANKING_RULE } from "./groupRanking.js";
import { closeWeekForGroup, ensureCurrentGroupWeek } from "./weeks.js";
import { requireAuth, requireTeacher, type AuthedRequest } from "./middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const teacherGroupsRouter = Router();

teacherGroupsRouter.use(requireAuth, requireTeacher);

function asTrimmedString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeControlNumber(input: string) {
  return input.trim().replace(/\s/g, "");
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function getPartialCutoffForGroup(groupId: string) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { id: true, code: true, shift: true, partialClosed: true, partialClosedAt: true },
  });
  if (!group) return null;
  const cutoff = group.partialClosed && group.partialClosedAt ? group.partialClosedAt : new Date();
  return { group, cutoff, isClosed: Boolean(group.partialClosed && group.partialClosedAt) };
}

function buildGroupWorkbook(params: {
  group: { code: string; shift: string };
  cutoff: Date;
  isClosed: boolean;
  maxPointsTotal: number;
  activityCount: number;
  rows: Array<{
    listNumber: number | null;
    controlNumber: string | null;
    displayName: string;
    delivered: number;
    notDelivered: number;
    deliveredPercent: number;
    points: number;
    calif6: number;
  }>;
}) {
  const sheetRows = params.rows.map((r) => ({
    "No. Lista": r.listNumber ?? "",
    "No. Control": r.controlNumber ?? "",
    Alumno: r.displayName,
    "Actividades (parcial)": params.activityCount,
    Entregadas: r.delivered,
    "No entregadas": r.notDelivered,
    "% entregadas": `${r.deliveredPercent}%`,
    "Puntos obtenidos": r.points,
    "Puntos máximos": params.maxPointsTotal,
    "Calificación (0-6)": r.calif6,
    "Examen (0-4)": "",
    "Total (0-10)": "",
  }));

  const infoRows = [
    ["Grupo", `${params.group.code} (${params.group.shift})`],
    ["Corte", params.cutoff.toISOString()],
    ["Parcial", params.isClosed ? "Cerrado" : "Preliminar"],
  ];

  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsInfo, "INFO");
  XLSX.utils.book_append_sheet(wb, ws, "RESUMEN");
  return wb;
}

function sendXlsx(res: { setHeader: (k: string, v: string) => void; send: (b: Buffer) => void }, wb: XLSX.WorkBook, filename: string) {
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(out);
}

type GradesMatrixExport = {
  group: { code: string; shift: string };
  activities: Array<{ id: string; name: string; date: Date; maxPoints: number; signatureMax: number }>;
  students: Array<{
    id: string;
    displayName: string;
    listNumber: number | null;
    controlNumber: string | null;
  }>;
  gradeByStudentActivity: Map<string, Map<string, { points: number; signatures: number }>>;
};

async function loadGroupGradesMatrixExport(
  groupId: string,
  teacherId: string,
): Promise<GradesMatrixExport | null> {
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) return null;

  const activities = await prisma.activity.findMany({
    where: { groupId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, date: true, maxPoints: true, signatureMax: true },
  });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    orderBy: [{ listNumber: "asc" }, { displayName: "asc" }],
  });

  const activityIds = activities.map((a) => a.id);
  const studentIds = students.map((s) => s.id);

  const grades =
    activityIds.length && studentIds.length
      ? await prisma.grade.findMany({
          where: { studentId: { in: studentIds }, activityId: { in: activityIds } },
          select: { studentId: true, activityId: true, points: true, signatures: true },
        })
      : [];

  const gradeByStudentActivity = new Map<string, Map<string, { points: number; signatures: number }>>();
  for (const g of grades) {
    let byActivity = gradeByStudentActivity.get(g.studentId);
    if (!byActivity) {
      byActivity = new Map();
      gradeByStudentActivity.set(g.studentId, byActivity);
    }
    byActivity.set(g.activityId, { points: g.points, signatures: g.signatures });
  }

  return { group, activities, students, gradeByStudentActivity };
}

function buildGradesMatrixSheet(data: GradesMatrixExport): XLSX.WorkSheet {
  const hasSignatures = data.activities.some((a) => a.signatureMax > 0);
  const maxPointsTotal = data.activities.reduce((acc, a) => acc + (a.maxPoints ?? 0), 0);

  const headerRow: unknown[] = ["No.", "No. Control", "Alumno"];
  const dateRow: unknown[] = ["", "", ""];
  const maxRow: unknown[] = ["", "", ""];

  for (const a of data.activities) {
    headerRow.push(a.name);
    dateRow.push(a.date.toISOString().slice(0, 10));
    maxRow.push(a.maxPoints);
    if (hasSignatures) headerRow.push(`${a.name} (firmas)`);
    if (hasSignatures) {
      dateRow.push("");
      maxRow.push(a.signatureMax);
    }
  }
  headerRow.push("TOTAL PUNTOS");
  if (hasSignatures) headerRow.push("TOTAL FIRMAS");
  dateRow.push("");
  maxRow.push(maxPointsTotal);
  if (hasSignatures) {
    dateRow.push("");
    maxRow.push(data.activities.reduce((acc, a) => acc + (a.signatureMax ?? 0), 0));
  }

  const dataRows: unknown[][] = data.students.map((s, idx) => {
    const row: unknown[] = [
      s.listNumber ?? idx + 1,
      s.controlNumber ?? "",
      s.displayName,
    ];
    let totalPoints = 0;
    let totalSignatures = 0;
    const byActivity = data.gradeByStudentActivity.get(s.id);

    for (const a of data.activities) {
      const grade = byActivity?.get(a.id);
      const points = grade?.points ?? "";
      row.push(points);
      if (typeof points === "number") totalPoints += points;
      if (hasSignatures) {
        const sigs = grade?.signatures ?? "";
        row.push(sigs);
        if (typeof sigs === "number") totalSignatures += sigs;
      }
    }
    row.push(totalPoints);
    if (hasSignatures) row.push(totalSignatures);
    return row;
  });

  return XLSX.utils.aoa_to_sheet([headerRow, dateRow, maxRow, ...dataRows]);
}

function buildCombinedGradesWorkbook(exports: GradesMatrixExport[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const data of exports) {
    XLSX.utils.book_append_sheet(wb, buildGradesMatrixSheet(data), data.group.code);
  }
  return wb;
}

function sendPdf(
  res: { setHeader: (k: string, v: string) => void; status?: (n: number) => any },
  build: (doc: InstanceType<typeof PDFDocument>) => void,
  filename: string,
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  // @ts-expect-error express response has pipe
  doc.pipe(res);
  build(doc);
  doc.end();
}

teacherGroupsRouter.get("/groups", async (req: AuthedRequest, res) => {
  const groups = await ensureTeacherGroups(req.auth!.userId);
  const groupIds = groups.map((g) => g.id);
  const [studentCounts, activityCounts] = await Promise.all([
    prisma.user.groupBy({
      by: ["groupId"],
      where: { role: "STUDENT", groupId: { in: groupIds } },
      _count: { _all: true },
    }),
    prisma.activity.groupBy({
      by: ["groupId"],
      where: { groupId: { in: groupIds }, createdById: req.auth!.userId },
      _count: { _all: true },
    }),
  ]);
  const studentsByGroup = new Map(studentCounts.map((c) => [c.groupId, c._count._all]));
  const activitiesByGroup = new Map(activityCounts.map((c) => [c.groupId, c._count._all]));

  return res.json({
    groups: groups.map((g) => ({
      ...g,
      studentCount: studentsByGroup.get(g.id) ?? 0,
      activityCount: activitiesByGroup.get(g.id) ?? 0,
    })),
  });
});

teacherGroupsRouter.put("/groups/:groupId/progress-settings", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const body = z
    .object({
      plannedActivities: z.number().int().min(1).max(365).nullable().optional(),
      progressClosed: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const updated = await prisma.classGroup.update({
    where: { id: groupId },
    data: {
      plannedActivities:
        body.data.plannedActivities === undefined ? undefined : body.data.plannedActivities,
      progressClosed: body.data.progressClosed === undefined ? undefined : body.data.progressClosed,
      progressClosedAt:
        body.data.progressClosed === true ? new Date() : body.data.progressClosed === false ? null : undefined,
    },
    select: {
      id: true,
      code: true,
      shift: true,
      plannedActivities: true,
      progressClosed: true,
      progressClosedAt: true,
    },
  });

  return res.json({ group: updated });
});

teacherGroupsRouter.put("/groups/:groupId/partial-settings", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const body = z
    .object({
      partialClosed: z.boolean(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const updated = await prisma.classGroup.update({
    where: { id: groupId },
    data: {
      partialClosed: body.data.partialClosed,
      partialClosedAt: body.data.partialClosed ? new Date() : null,
    },
    select: {
      id: true,
      code: true,
      shift: true,
      plannedActivities: true,
      progressClosed: true,
      progressClosedAt: true,
      partialClosed: true,
      partialClosedAt: true,
    },
  });

  return res.json({ group: updated });
});

teacherGroupsRouter.post("/groups/:groupId/students", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const body = z
    .object({
      controlNumber: z.string().min(1).max(64),
      displayName: z.string().min(2).max(160),
      listNumber: z.number().int().min(1).max(999).nullable().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const controlNumber = normalizeControlNumber(body.data.controlNumber);
  const unsetHash = await placeholderPasswordHash();
  try {
    const created = await prisma.user.create({
      data: {
        role: "STUDENT",
        groupId: group.id,
        controlNumber,
        displayName: body.data.displayName.trim(),
        listNumber: body.data.listNumber ?? null,
        passwordHash: unsetHash,
        passwordSet: false,
        recoverablePassword: null,
      },
      select: {
        id: true,
        controlNumber: true,
        listNumber: true,
        displayName: true,
        passwordSet: true,
        recoverablePassword: true,
      },
    });
    return res.json({
      student: {
        id: created.id,
        controlNumber: created.controlNumber,
        listNumber: created.listNumber,
        displayName: created.displayName,
        passwordSet: created.passwordSet,
        passwordLabel: "Pendiente — el alumno debe crearla al entrar",
      },
    });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return res.status(400).json({
        error: "control_number_taken",
        message: "Ya existe un alumno con ese número de control.",
      });
    }
    throw err;
  }
});

teacherGroupsRouter.put("/groups/:groupId/students/:studentId", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const studentId = String(req.params.studentId);
  const body = z
    .object({
      controlNumber: z.string().min(1).max(64).optional(),
      displayName: z.string().min(2).max(160).optional(),
      listNumber: z.number().int().min(1).max(999).nullable().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", groupId, group: { teacherId: req.auth!.userId } },
    select: {
      id: true,
      controlNumber: true,
      listNumber: true,
      displayName: true,
      passwordSet: true,
      recoverablePassword: true,
    },
  });
  if (!student) return res.status(404).json({ error: "student_not_found" });

  const nextControl =
    body.data.controlNumber === undefined ? undefined : normalizeControlNumber(body.data.controlNumber);

  try {
    const updated = await prisma.user.update({
      where: { id: student.id },
      data: {
        controlNumber: nextControl,
        displayName: body.data.displayName?.trim(),
        listNumber: body.data.listNumber === undefined ? undefined : body.data.listNumber,
      },
      select: {
        id: true,
        controlNumber: true,
        listNumber: true,
        displayName: true,
        passwordSet: true,
        recoverablePassword: true,
      },
    });
    return res.json({
      student: {
        id: updated.id,
        controlNumber: updated.controlNumber,
        listNumber: updated.listNumber,
        displayName: updated.displayName,
        passwordSet: updated.passwordSet,
        passwordLabel: updated.passwordSet
          ? updated.recoverablePassword
            ? updated.recoverablePassword
            : "Contraseña personal (solo el alumno la conoce)"
          : "Pendiente — el alumno debe crearla al entrar",
      },
    });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return res.status(400).json({
        error: "control_number_taken",
        message: "Ya existe un alumno con ese número de control.",
      });
    }
    throw err;
  }
});

teacherGroupsRouter.delete("/groups/:groupId/students/:studentId", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const studentId = String(req.params.studentId);

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", groupId, group: { teacherId: req.auth!.userId } },
    select: { id: true, displayName: true, controlNumber: true },
  });
  if (!student) return res.status(404).json({ error: "student_not_found" });

  await prisma.user.delete({ where: { id: student.id } });
  return res.json({ ok: true, deletedId: student.id });
});

teacherGroupsRouter.get("/groups/:groupId/ranking", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: {
      id: true,
      code: true,
      shift: true,
      plannedActivities: true,
      progressClosed: true,
      progressClosedAt: true,
      partialClosed: true,
      partialClosedAt: true,
    },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const { ranking, activityCount } = await getGroupRanking(groupId);
  const top10 = ranking.slice(0, 10);

  return res.json({
    group,
    ranking,
    top10,
    activityCount,
    rankingRule: RANKING_RULE,
  });
});

teacherGroupsRouter.get("/groups/:groupId/weeks", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true, partialClosed: true, partialClosedAt: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  await ensureCurrentGroupWeek(groupId);

  const weeks = await prisma.groupWeek.findMany({
    where: { groupId },
    orderBy: { weekStart: "desc" },
    include: {
      winner: { include: { student: { select: { id: true, displayName: true, listNumber: true, controlNumber: true } } } },
    },
  });

  return res.json({
    group,
    weeks: weeks.map((w) => ({
      id: w.id,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      closedAt: w.closedAt,
      winner: w.winner
        ? {
            studentId: w.winner.studentId,
            displayName: w.winner.student.displayName,
            listNumber: w.winner.student.listNumber ?? null,
            controlNumber: w.winner.student.controlNumber ?? null,
            score: w.winner.score,
          }
        : null,
    })),
  });
});

teacherGroupsRouter.post("/groups/:groupId/weeks/close", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true, partialClosed: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });
  if (group.partialClosed) {
    return res.status(400).json({
      error: "partial_closed",
      message: "El parcial está cerrado. Reabre el parcial para poder cerrar semanas.",
    });
  }

  const week = await closeWeekForGroup(groupId);

  const winner = week.winner
    ? {
        studentId: week.winner.studentId,
        displayName: week.winner.student.displayName,
        listNumber: week.winner.student.listNumber ?? null,
        controlNumber: week.winner.student.controlNumber ?? null,
        score: week.winner.score,
      }
    : null;

  return res.json({
    group,
    week: {
      id: week.id,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      closedAt: week.closedAt,
      winner,
    },
  });
});

teacherGroupsRouter.get("/groups/:groupId/partial-summary", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true, partialClosed: true, partialClosedAt: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const { ranking } = await getGroupRanking(groupId);

  const wins = await prisma.weeklyWinner.groupBy({
    by: ["studentId"],
    where: { week: { groupId, closedAt: { not: null } } },
    _count: { _all: true },
    _sum: { score: true },
  });
  const winCountByStudent = new Map(wins.map((w) => [w.studentId, w._count._all]));
  const winScoreSumByStudent = new Map(wins.map((w) => [w.studentId, w._sum.score ?? 0]));

  return res.json({
    group,
    rows: ranking.map((r) => ({
      studentId: r.studentId,
      displayName: r.displayName,
      listNumber: r.listNumber ?? null,
      controlNumber: r.controlNumber ?? null,
      totalPoints: r.score,
      place: r.place,
      weeksWon: winCountByStudent.get(r.studentId) ?? 0,
      weeklyWinnerScoreSum: winScoreSumByStudent.get(r.studentId) ?? 0,
      exemption: r.exemption,
    })),
  });
});

teacherGroupsRouter.get("/groups/:groupId/report.xlsx", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const partial = await getPartialCutoffForGroup(groupId);
  if (!partial) return res.status(404).json({ error: "group_not_found" });

  const owned = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true },
  });
  if (!owned) return res.status(404).json({ error: "group_not_found" });

  const activities = await prisma.activity.findMany({
    where: {
      groupId,
      createdAt: { lte: partial.cutoff },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, date: true, maxPoints: true, createdAt: true },
  });
  const activityIds = activities.map((a) => a.id);
  const activityCount = activityIds.length;
  const maxPointsTotal = activities.reduce((acc, a) => acc + (a.maxPoints ?? 0), 0);

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    orderBy: [{ displayName: "asc" }],
  });
  const studentIds = students.map((s) => s.id);

  const [pointsGrouped, deliveredGrouped] = await Promise.all([
    prisma.grade.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, activityId: { in: activityIds } },
      _sum: { points: true },
    }),
    prisma.submission.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, activityId: { in: activityIds } },
      _count: { _all: true },
    }),
  ]);
  const pointsByStudent = new Map(pointsGrouped.map((g) => [g.studentId, g._sum.points ?? 0]));
  const deliveredByStudent = new Map(deliveredGrouped.map((g) => [g.studentId, g._count._all]));

  const rows = students.map((s) => {
    const points = pointsByStudent.get(s.id) ?? 0;
    const delivered = deliveredByStudent.get(s.id) ?? 0;
    const notDelivered = Math.max(0, activityCount - delivered);
    const deliveredPercent = activityCount > 0 ? Math.round(clamp01(delivered / activityCount) * 100) : 0;
    const calif6 =
      maxPointsTotal > 0 ? round2(Math.min(6, (points / maxPointsTotal) * 6)) : 0;
    return {
      listNumber: s.listNumber ?? null,
      controlNumber: s.controlNumber ?? null,
      displayName: s.displayName,
      delivered,
      notDelivered,
      deliveredPercent,
      points,
      calif6,
    };
  });

  const wb = buildGroupWorkbook({
    group: { code: owned.code, shift: owned.shift },
    cutoff: partial.cutoff,
    isClosed: partial.isClosed,
    maxPointsTotal,
    activityCount,
    rows,
  });

  return sendXlsx(res, wb, `reporte_parcial_grupo_${owned.code}.xlsx`);
});

teacherGroupsRouter.get("/groups/:groupId/report.pdf", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const partial = await getPartialCutoffForGroup(groupId);
  if (!partial) return res.status(404).json({ error: "group_not_found" });

  const owned = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true },
  });
  if (!owned) return res.status(404).json({ error: "group_not_found" });

  const activities = await prisma.activity.findMany({
    where: { groupId, createdAt: { lte: partial.cutoff } },
    select: { id: true, maxPoints: true },
  });
  const activityIds = activities.map((a) => a.id);
  const activityCount = activityIds.length;
  const maxPointsTotal = activities.reduce((acc, a) => acc + (a.maxPoints ?? 0), 0);

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    orderBy: [{ displayName: "asc" }],
  });
  const studentIds = students.map((s) => s.id);

  const [pointsGrouped, deliveredGrouped] = await Promise.all([
    prisma.grade.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, activityId: { in: activityIds } },
      _sum: { points: true },
    }),
    prisma.submission.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, activityId: { in: activityIds } },
      _count: { _all: true },
    }),
  ]);
  const pointsByStudent = new Map(pointsGrouped.map((g) => [g.studentId, g._sum.points ?? 0]));
  const deliveredByStudent = new Map(deliveredGrouped.map((g) => [g.studentId, g._count._all]));

  return sendPdf(
    res,
    (doc) => {
      const title = `Reporte del parcial — Grupo ${owned.code} (${owned.shift})`;
      doc.fontSize(16).text(title);
      doc.moveDown(0.25);
      doc
        .fontSize(10)
        .fillColor("gray")
        .text(
          `Corte: ${partial.cutoff.toLocaleString("es-MX")} · Estado: ${partial.isClosed ? "CERRADO" : "PRELIMINAR"}`,
        )
        .fillColor("black");
      doc.moveDown(0.75);

      doc.fontSize(10).text(`Actividades consideradas: ${activityCount}`);
      doc.text(`Puntos máximos del parcial: ${maxPointsTotal}`);
      doc.moveDown(0.75);

      const header = ["Control", "Alumno", "Ent", "NoEnt", "%", "Pts", "Calif(6)"];
      const colX = [40, 120, 330, 360, 405, 450, 500];
      doc.fontSize(9).font("Helvetica-Bold");
      header.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: false }));
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(9);

      for (const s of students) {
        const points = pointsByStudent.get(s.id) ?? 0;
        const delivered = deliveredByStudent.get(s.id) ?? 0;
        const notDelivered = Math.max(0, activityCount - delivered);
        const percent = activityCount > 0 ? Math.round(clamp01(delivered / activityCount) * 100) : 0;
        const calif6 = maxPointsTotal > 0 ? round2(Math.min(6, (points / maxPointsTotal) * 6)) : 0;

        const row = [
          s.controlNumber ?? String(s.listNumber ?? ""),
          s.displayName,
          String(delivered),
          String(notDelivered),
          `${percent}%`,
          String(points),
          String(calif6),
        ];

        // Simple pagination
        if (doc.y > 760) {
          doc.addPage();
          doc.fontSize(9).font("Helvetica-Bold");
          header.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: false }));
          doc.moveDown(0.4);
          doc.font("Helvetica").fontSize(9);
        }

        for (let i = 0; i < row.length; i++) {
          const opts = i === 1 ? { width: 200 } : undefined;
          doc.text(row[i] ?? "", colX[i], doc.y, opts);
        }
        doc.moveDown(0.35);
      }
    },
    `reporte_parcial_grupo_${owned.code}.pdf`,
  );
});

teacherGroupsRouter.get("/groups/:groupId/students/:studentId/report.xlsx", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const studentId = String(req.params.studentId);
  const partial = await getPartialCutoffForGroup(groupId);
  if (!partial) return res.status(404).json({ error: "group_not_found" });

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", groupId, group: { teacherId: req.auth!.userId } },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
  });
  if (!student) return res.status(404).json({ error: "student_not_found" });

  const activities = await prisma.activity.findMany({
    where: { groupId, createdAt: { lte: partial.cutoff } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, date: true, maxPoints: true },
  });
  const activityIds = activities.map((a) => a.id);
  const maxPointsTotal = activities.reduce((acc, a) => acc + (a.maxPoints ?? 0), 0);

  const [grades, submissions] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId, activityId: { in: activityIds } },
      select: { activityId: true, points: true },
    }),
    prisma.submission.findMany({
      where: { studentId, activityId: { in: activityIds } },
      select: { activityId: true, submittedAt: true },
    }),
  ]);
  const gradeByActivity = new Map(grades.map((g) => [g.activityId, g.points]));
  const subByActivity = new Map(submissions.map((s) => [s.activityId, s.submittedAt]));

  const delivered = submissions.length;
  const notDelivered = Math.max(0, activities.length - delivered);
  const deliveredPercent = activities.length > 0 ? Math.round(clamp01(delivered / activities.length) * 100) : 0;
  const points = grades.reduce((acc, g) => acc + (g.points ?? 0), 0);
  const calif6 = maxPointsTotal > 0 ? round2(Math.min(6, (points / maxPointsTotal) * 6)) : 0;

  const info = [
    ["Alumno", student.displayName],
    ["No. Control", student.controlNumber ?? ""],
    ["No. Lista", student.listNumber ?? ""],
    ["Corte", partial.cutoff.toISOString()],
    ["Parcial", partial.isClosed ? "Cerrado" : "Preliminar"],
    ["Actividades", activities.length],
    ["Entregadas", delivered],
    ["No entregadas", notDelivered],
    ["% entregadas", `${deliveredPercent}%`],
    ["Puntos", points],
    ["Puntos máximos", maxPointsTotal],
    ["Calificación (0-6)", calif6],
    ["Examen (0-4)", ""],
    ["Total (0-10)", ""],
  ];

  const details = activities.map((a) => ({
    Fecha: a.date.toISOString().slice(0, 10),
    Actividad: a.name,
    "Max puntos": a.maxPoints,
    Entregada: subByActivity.has(a.id) ? "Sí" : "No",
    "Fecha entrega": subByActivity.get(a.id)?.toISOString() ?? "",
    Puntos: gradeByActivity.get(a.id) ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "RESUMEN");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(details), "ACTIVIDADES");
  return sendXlsx(res, wb, `reporte_parcial_${normalizeControlNumber(student.controlNumber ?? student.id)}.xlsx`);
});

teacherGroupsRouter.get("/groups/:groupId/students/:studentId/report.pdf", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const studentId = String(req.params.studentId);
  const partial = await getPartialCutoffForGroup(groupId);
  if (!partial) return res.status(404).json({ error: "group_not_found" });

  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
    select: { id: true, code: true, shift: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", groupId, group: { teacherId: req.auth!.userId } },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
  });
  if (!student) return res.status(404).json({ error: "student_not_found" });

  const activities = await prisma.activity.findMany({
    where: { groupId, createdAt: { lte: partial.cutoff } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, date: true, maxPoints: true },
  });
  const activityIds = activities.map((a) => a.id);
  const maxPointsTotal = activities.reduce((acc, a) => acc + (a.maxPoints ?? 0), 0);

  const [grades, submissions] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId, activityId: { in: activityIds } },
      select: { activityId: true, points: true },
    }),
    prisma.submission.findMany({
      where: { studentId, activityId: { in: activityIds } },
      select: { activityId: true, submittedAt: true },
    }),
  ]);
  const gradeByActivity = new Map(grades.map((g) => [g.activityId, g.points]));
  const subByActivity = new Map(submissions.map((s) => [s.activityId, s.submittedAt]));

  const delivered = submissions.length;
  const notDelivered = Math.max(0, activities.length - delivered);
  const deliveredPercent = activities.length > 0 ? Math.round(clamp01(delivered / activities.length) * 100) : 0;
  const points = grades.reduce((acc, g) => acc + (g.points ?? 0), 0);
  const calif6 = maxPointsTotal > 0 ? round2(Math.min(6, (points / maxPointsTotal) * 6)) : 0;

  return sendPdf(
    res,
    (doc) => {
      doc.fontSize(16).text(`Reporte del parcial — ${student.displayName}`);
      doc.moveDown(0.25);
      doc
        .fontSize(10)
        .fillColor("gray")
        .text(
          `Grupo ${group.code} (${group.shift}) · Corte: ${partial.cutoff.toLocaleString("es-MX")} · ${
            partial.isClosed ? "CERRADO" : "PRELIMINAR"
          }`,
        )
        .fillColor("black");
      doc.moveDown(0.75);

      doc.fontSize(10).text(`Control: ${student.controlNumber ?? "—"} · No. Lista: ${student.listNumber ?? "—"}`);
      doc.text(`Entregadas: ${delivered} · No entregadas: ${notDelivered} · %: ${deliveredPercent}%`);
      doc.text(`Puntos: ${points} / ${maxPointsTotal} · Calificación (0–6): ${calif6}`);
      doc.moveDown(0.75);

      const header = ["Fecha", "Actividad", "Max", "Ent", "Pts"];
      const colX = [40, 120, 420, 470, 520];
      doc.fontSize(9).font("Helvetica-Bold");
      header.forEach((h, i) => doc.text(h, colX[i], doc.y));
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(9);

      for (const a of activities) {
        if (doc.y > 760) {
          doc.addPage();
          doc.fontSize(9).font("Helvetica-Bold");
          header.forEach((h, i) => doc.text(h, colX[i], doc.y));
          doc.moveDown(0.4);
          doc.font("Helvetica").fontSize(9);
        }
        const date = a.date.toISOString().slice(0, 10);
        const deliveredLabel = subByActivity.has(a.id) ? "Sí" : "No";
        const pts = gradeByActivity.get(a.id);
        doc.text(date, colX[0], doc.y);
        doc.text(a.name, colX[1], doc.y, { width: 280 });
        doc.text(String(a.maxPoints), colX[2], doc.y);
        doc.text(deliveredLabel, colX[3], doc.y);
        doc.text(pts == null ? "—" : String(pts), colX[4], doc.y);
        doc.moveDown(0.35);
      }
    },
    `reporte_parcial_${normalizeControlNumber(student.controlNumber ?? student.id)}.pdf`,
  );
});

teacherGroupsRouter.get("/groups/:groupId/students", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  await removeJunkStudentsForGroup(groupId);

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    orderBy: [{ displayName: "asc" }, { listNumber: "asc" }, { controlNumber: "asc" }],
    select: {
      id: true,
      controlNumber: true,
      listNumber: true,
      displayName: true,
      passwordSet: true,
      recoverablePassword: true,
    },
  });

  return res.json({
    group,
    students: students.map((s) => ({
      id: s.id,
      controlNumber: s.controlNumber,
      listNumber: s.listNumber,
      displayName: s.displayName,
      passwordSet: s.passwordSet,
      passwordLabel: s.passwordSet
        ? s.recoverablePassword
          ? s.recoverablePassword
          : "Contraseña personal (solo el alumno la conoce)"
        : "Pendiente — el alumno debe crearla al entrar",
    })),
  });
});

teacherGroupsRouter.post(
  "/groups/:groupId/students/import",
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const groupId = String(req.params.groupId);
    const group = await prisma.classGroup.findFirst({
      where: { id: groupId, teacherId: req.auth!.userId },
    });
    if (!group) return res.status(404).json({ error: "group_not_found" });

    if (!req.file?.buffer) {
      return res.status(400).json({ error: "file_required" });
    }

    const ext = req.file.originalname.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls") && !ext.endsWith(".csv")) {
      return res.status(400).json({ error: "invalid_file_type" });
    }

    const parsed = parseStudentsExcel(req.file.buffer, group.code);
    if (!parsed.length) {
      return res.status(400).json({
        error: "empty_file",
        message: "Usa columnas: número de control | nombre completo",
      });
    }

    const unsetHash = await placeholderPasswordHash();
    const summary = await importStudentRows(group, parsed, unsetHash);

    return res.json({
      group: { id: group.id, code: group.code, shift: group.shift },
      summary,
      loginHint: {
        usuario: "Número de control (columna del Excel)",
        primeraVez: "El alumno entra y crea su propia contraseña",
        ejemplo: parsed[0]?.controlNumber,
      },
    });
  },
);

teacherGroupsRouter.post("/students/dedupe", async (req: AuthedRequest, res) => {
  const { removed, details } = await dedupeStudentsForTeacher(req.auth!.userId);
  return res.json({
    removed,
    details,
    message:
      removed > 0
        ? `Se eliminaron ${removed} registros duplicados.`
        : "No había duplicados por nombre en tus grupos.",
  });
});

teacherGroupsRouter.post("/students/import-workbook", upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: "file_required" });
  }

  const ext = req.file.originalname.toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
    return res.status(400).json({
      error: "invalid_file_type",
      message: "Para varias hojas (201 y 202) usa un archivo .xlsx o .xls",
    });
  }

  const groups = await ensureTeacherGroups(req.auth!.userId);
  const groupCodes = groups.map((g) => g.code);
  const { sheets, skippedSheets } = parseStudentsWorkbook(req.file.buffer, groupCodes);

  if (!sheets.length) {
    return res.status(400).json({
      error: "no_sheets_matched",
      message:
        "No se encontraron hojas llamadas 201 y 202 (o Grupo 201, Grupo 202). Revisa los nombres de las pestañas del Excel.",
      skippedSheets,
      expectedGroupCodes: groupCodes,
    });
  }

  const unsetHash = await placeholderPasswordHash();
  const results: {
    groupCode: string;
    sheetName: string;
    summary: { total: number; created: number; updated: number };
  }[] = [];

  for (const sheet of sheets) {
    const group = groups.find((g) => g.code === sheet.groupCode);
    if (!group) continue;
    const summary = await importStudentRows(group, sheet.students, unsetHash);
    results.push({ groupCode: sheet.groupCode, sheetName: sheet.sheetName, summary });
  }

  return res.json({
    results,
    skippedSheets,
    message: `Importados ${results.length} grupo(s) desde el archivo.`,
  });
});

teacherGroupsRouter.put(
  "/groups/:groupId/students/:studentId/reset-password",
  async (req: AuthedRequest, res) => {
    const groupId = String(req.params.groupId);
    const studentId = String(req.params.studentId);
    const body = z
      .object({
        newPassword: z.string().min(4).max(64),
      })
      .safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_body" });

    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: "STUDENT",
        groupId,
        group: { teacherId: req.auth!.userId },
      },
    });
    if (!student) return res.status(404).json({ error: "student_not_found" });

    const passwordHash = await bcrypt.hash(body.data.newPassword, 10);
    await prisma.user.update({
      where: { id: studentId },
      data: {
        passwordHash,
        passwordSet: true,
        recoverablePassword: body.data.newPassword,
      },
    });

    return res.json({
      studentId,
      controlNumber: student.controlNumber,
      displayName: student.displayName,
      newPassword: body.data.newPassword,
      message: "Contraseña restablecida. Compártela con el alumno.",
    });
  },
);

function parseGradeImportMode(value: unknown): GradeImportMode {
  if (value === "activitiesOnly" || value === "gradesOnly" || value === "full") return value;
  return "full";
}

teacherGroupsRouter.post(
  "/groups/:groupId/grades/import",
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const groupId = String(req.params.groupId);
    const group = await prisma.classGroup.findFirst({
      where: { id: groupId, teacherId: req.auth!.userId },
    });
    if (!group) return res.status(404).json({ error: "group_not_found" });

    if (!req.file?.buffer) {
      return res.status(400).json({ error: "file_required" });
    }

    const ext = req.file.originalname.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      return res.status(400).json({
        error: "invalid_file_type",
        message: "Usa un archivo .xlsx o .xls",
      });
    }

    const parsed = parseGradesExcel(req.file.buffer, group.code);
    if (!parsed?.activities.length) {
      return res.status(400).json({
        error: "empty_file",
        message: `No se encontró una hoja llamada "${group.code}" (o "Grupo ${group.code}") con actividades. Usa el archivo completo con hojas 201 y 202, o renombra la pestaña del Excel.`,
      });
    }

    const mode = parseGradeImportMode(req.query.mode);
    const summary = await importGradesForGroup(group, parsed, req.auth!.userId, mode);

    return res.json({
      group: { id: group.id, code: group.code, shift: group.shift },
      sheetName: parsed.sheetName,
      mode,
      summary,
    });
  },
);

teacherGroupsRouter.post("/grades/import-workbook", upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: "file_required" });
  }

  const ext = req.file.originalname.toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
    return res.status(400).json({
      error: "invalid_file_type",
      message: "Para varias hojas (201 y 202) usa .xlsx o .xls",
    });
  }

  const groups = await ensureTeacherGroups(req.auth!.userId);
  const groupCodes = groups.map((g) => g.code);
  const groupByCode = new Map(groups.map((g) => [g.code, g]));
  const { sheets, skippedSheets } = parseGradesWorkbook(req.file.buffer, groupCodes);

  if (!sheets.length) {
    return res.status(400).json({
      error: "no_sheets_matched",
      message:
        "No se encontraron hojas 201/202 con actividades y calificaciones. Revisa los nombres de las pestañas.",
      skippedSheets,
      expectedGroupCodes: groupCodes,
    });
  }

  const mode = parseGradeImportMode(req.query.mode);
  const results: {
    groupCode: string;
    sheetName: string;
    summary: Awaited<ReturnType<typeof importGradesForGroup>>;
  }[] = [];

  for (const sheet of sheets) {
    const group = groupByCode.get(sheet.groupCode);
    if (!group) continue;
    const summary = await importGradesForGroup(group, sheet, req.auth!.userId, mode);
    results.push({ groupCode: sheet.groupCode, sheetName: sheet.sheetName, summary });
  }

  return res.json({ mode, results, skippedSheets });
});

teacherGroupsRouter.get("/groups/:groupId/grades/template", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const csv = [
    "No.,NOMBRE DEL ALUMNO,CARATULA,ESTACION RADIO,ACTIVIDADES SOCIOEMOCIONALES",
    "1,Garcia Lopez Juan,1000,500,500",
    "2,Martinez Perez Ana,1500,0,500",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="calificaciones_grupo_${group.code}.csv"`,
  );
  return res.send(csv);
});

teacherGroupsRouter.get("/groups/:groupId/students/template", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const csv =
    "Numero de control,Nombre completo\n20210001,Garcia Lopez Juan\n20210002,Martinez Perez Ana\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="lista_grupo_${group.code}_${group.shift}.csv"`,
  );
  return res.send(csv);
});

teacherGroupsRouter.get("/reports/totals.xlsx", async (req: AuthedRequest, res) => {
  const groups = await ensureTeacherGroups(req.auth!.userId);
  const exports: GradesMatrixExport[] = [];

  for (const g of groups) {
    const data = await loadGroupGradesMatrixExport(g.id, req.auth!.userId);
    if (data) exports.push(data);
  }

  if (!exports.length) return res.status(404).json({ error: "group_not_found" });

  const wb = buildCombinedGradesWorkbook(exports);
  return sendXlsx(res, wb, "calificaciones_201_202.xlsx");
});
