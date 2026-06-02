import { Router } from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { parseStudentsExcel, parseStudentsWorkbook } from "./excel.js";
import { parseGradesExcel, parseGradesWorkbook } from "./importGradesExcel.js";
import { ensureTeacherGroups, placeholderPasswordHash } from "./groups.js";
import { dedupeStudentsForTeacher } from "./dedupeStudents.js";
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

teacherGroupsRouter.get("/groups", async (req: AuthedRequest, res) => {
  const groups = await ensureTeacherGroups(req.auth!.userId);
  const counts = await prisma.user.groupBy({
    by: ["groupId"],
    where: { role: "STUDENT", groupId: { in: groups.map((g) => g.id) } },
    _count: { _all: true },
  });
  const countByGroup = new Map(counts.map((c) => [c.groupId, c._count._all]));

  return res.json({
    groups: groups.map((g) => ({
      ...g,
      studentCount: countByGroup.get(g.id) ?? 0,
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

  return res.json({
    group,
    ranking,
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
    select: { id: true, code: true, shift: true },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    orderBy: { displayName: "asc" },
  });

  const totals = await prisma.grade.groupBy({
    by: ["studentId"],
    where: { student: { groupId } },
    _sum: { points: true },
  });
  const scoreByStudent = new Map(totals.map((t) => [t.studentId, t._sum.points ?? 0]));

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
    rows: students.map((s) => ({
      studentId: s.id,
      displayName: s.displayName,
      listNumber: s.listNumber ?? null,
      controlNumber: s.controlNumber ?? null,
      totalPoints: scoreByStudent.get(s.id) ?? 0,
      weeksWon: winCountByStudent.get(s.id) ?? 0,
      weeklyWinnerScoreSum: winScoreSumByStudent.get(s.id) ?? 0,
    })),
  });
});

teacherGroupsRouter.get("/groups/:groupId/students", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const group = await prisma.classGroup.findFirst({
    where: { id: groupId, teacherId: req.auth!.userId },
  });
  if (!group) return res.status(404).json({ error: "group_not_found" });

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
