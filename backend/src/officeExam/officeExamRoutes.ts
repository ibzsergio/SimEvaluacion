import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, requireTeacher, type AuthedRequest } from "../middleware.js";
import { ensureTeacherGroups } from "../groups.js";
import { getGroupRanking } from "../groupRanking.js";
import { computeSubjectGrade, computeSubjectGradeWithoutExam } from "./subjectGrade.js";
import { getStudentTotalFirmas } from "./firmas.js";
import {
  ensureOfficeExam,
  EXAM_INSTRUCTIONS,
  finalizeAttempt,
  publicQuestion,
  recalculateAllSubmittedAttempts,
} from "./examService.js";
import { getOfficeExamGradeRows } from "./gradeRows.js";
import { buildOfficeGradesWorkbook, sendOfficeGradesXlsx } from "./gradesExport.js";

export const officeExamTeacherRouter = Router();
officeExamTeacherRouter.use(requireAuth, requireTeacher);

officeExamTeacherRouter.get("/", async (req: AuthedRequest, res) => {
  await recalculateAllSubmittedAttempts(req.auth!.userId);
  const exam = await ensureOfficeExam(req.auth!.userId);
  const rows = await getOfficeExamGradeRows(req.auth!.userId);

  const attempts = await prisma.officeExamAttempt.findMany({
    where: { examId: exam.id },
    select: { status: true },
  });
  const submitted = attempts.filter((a) => a.status === "SUBMITTED").length;
  const inProgress = attempts.filter((a) => a.status === "IN_PROGRESS").length;

  return res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      enabledForStudents: exam.enabledForStudents,
      enabledAt: exam.enabledAt,
      timeLimitMinutes: exam.timeLimitMinutes,
      questionCount: exam.questions.length,
      instructions: EXAM_INSTRUCTIONS,
      questionsPreview: exam.questions.map((q) => ({
        id: q.id,
        program: q.program,
        sortOrder: q.sortOrder,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
      })),
    },
    summary: {
      totalStudents: rows.length,
      submitted,
      inProgress,
      notStarted: rows.length - submitted - inProgress,
      wordCount: exam.questions.filter((q) => q.program === "WORD").length,
      powerpointCount: exam.questions.filter((q) => q.program === "POWERPOINT").length,
      excelCount: exam.questions.filter((q) => q.program === "EXCEL").length,
    },
    rows,
  });
});

officeExamTeacherRouter.get("/preview", async (req: AuthedRequest, res) => {
  const exam = await ensureOfficeExam(req.auth!.userId);
  return res.json({
    instructions: EXAM_INSTRUCTIONS,
    questions: exam.questions.map(publicQuestion),
  });
});

officeExamTeacherRouter.post("/recalculate", async (req: AuthedRequest, res) => {
  const result = await recalculateAllSubmittedAttempts(req.auth!.userId);
  return res.json(result);
});

officeExamTeacherRouter.get("/grades.xlsx", async (req: AuthedRequest, res) => {
  await recalculateAllSubmittedAttempts(req.auth!.userId);
  const groups = await ensureTeacherGroups(req.auth!.userId);
  const rows = await getOfficeExamGradeRows(req.auth!.userId);
  const wb = buildOfficeGradesWorkbook(groups, rows);
  return sendOfficeGradesXlsx(res, wb, "calificaciones_examen_office_201_202.xlsx");
});

officeExamTeacherRouter.get("/grades/:groupId.xlsx", async (req: AuthedRequest, res) => {
  const groupId = String(req.params.groupId);
  const groups = await ensureTeacherGroups(req.auth!.userId);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return res.status(404).json({ error: "group_not_found" });

  await recalculateAllSubmittedAttempts(req.auth!.userId);
  const rows = await getOfficeExamGradeRows(req.auth!.userId);
  const wb = buildOfficeGradesWorkbook([group], rows);
  return sendOfficeGradesXlsx(res, wb, `calificaciones_examen_office_grupo_${group.code}.xlsx`);
});

officeExamTeacherRouter.put("/settings", async (req: AuthedRequest, res) => {
  const body = z
    .object({
      enabledForStudents: z.boolean(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body" });

  const exam = await ensureOfficeExam(req.auth!.userId);
  const updated = await prisma.officeExam.update({
    where: { id: exam.id },
    data: {
      enabledForStudents: body.data.enabledForStudents,
      enabledAt: body.data.enabledForStudents ? new Date() : null,
    },
  });

  return res.json({ exam: updated });
});

export async function getStudentOfficeExamState(userId: string) {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, groupId: true, group: { select: { teacherId: true } } },
  });
  if (!student?.groupId || !student.group?.teacherId) {
    return { available: false, reason: "no_group" as const };
  }

  const exam = await prisma.officeExam.findUnique({
    where: { teacherId: student.group.teacherId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!exam) {
    return { available: false, reason: "not_configured" as const };
  }

  const gradePreview = await computeSubjectGradeWithoutExam(student.id, student.groupId);
  const attempt = await prisma.officeExamAttempt.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId: student.id } },
  });

  const base = {
    enabled: exam.enabledForStudents,
    instructions: EXAM_INSTRUCTIONS,
    timeLimitMinutes: exam.timeLimitMinutes,
    questionCount: exam.questions.length,
    isExempt: gradePreview.isExempt,
    place: gradePreview.place,
    totalFirmas: gradePreview.totalFirmas,
    firmasReference: gradePreview.firmasReference,
    firmasScore6: gradePreview.firmasScore6,
    projectedGradeWithoutExam: gradePreview.finalGrade,
    examAffectsGrade: !gradePreview.isExempt,
  };

  if (!exam.enabledForStudents) {
    return { available: false, reason: "disabled" as const, ...base };
  }

  if (attempt?.status === "SUBMITTED") {
    const breakdown = await computeSubjectGrade(
      student.id,
      student.groupId,
      attempt.correctCount ?? 0,
      exam.questions.length,
    );
    return {
      available: true,
      status: "SUBMITTED" as const,
      attemptId: attempt.id,
      correctCount: attempt.correctCount,
      examScore4: breakdown.examScore4,
      firmasScore6: breakdown.firmasScore6,
      finalGrade: breakdown.finalGrade,
      submittedAt: attempt.submittedAt,
      isExempt: breakdown.isExempt,
      place: gradePreview.place,
      totalFirmas: gradePreview.totalFirmas,
      instructions: EXAM_INSTRUCTIONS,
      timeLimitMinutes: exam.timeLimitMinutes,
      questionCount: exam.questions.length,
      examAffectsGrade: breakdown.examAffectsGrade,
    };
  }

  if (attempt?.status === "IN_PROGRESS") {
    return {
      available: true,
      status: "IN_PROGRESS" as const,
      attemptId: attempt.id,
      answers: attempt.answers as Record<string, string>,
      questions: exam.questions.map(publicQuestion),
      startedAt: attempt.startedAt,
      lastSavedAt: attempt.lastSavedAt,
      ...base,
    };
  }

  return {
    available: true,
    status: "NOT_STARTED" as const,
    questions: exam.questions.map(publicQuestion),
    ...base,
  };
}

export async function startStudentExam(userId: string) {
  const state = await getStudentOfficeExamState(userId);
  if (!state.available) {
    if ("reason" in state && state.reason === "disabled") throw new Error("exam_disabled");
    throw new Error("exam_unavailable");
  }
  if ("status" in state && state.status === "SUBMITTED") throw new Error("already_submitted");

  const student = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { group: { select: { teacherId: true } } },
  });
  const exam = await prisma.officeExam.findUniqueOrThrow({
    where: { teacherId: student.group!.teacherId! },
  });

  if ("status" in state && state.status === "IN_PROGRESS" && state.attemptId) {
    return state;
  }

  await prisma.officeExamAttempt.create({
    data: { examId: exam.id, studentId: userId, answers: {} },
  });

  return getStudentOfficeExamState(userId);
}

export async function saveStudentAnswers(userId: string, answers: Record<string, string>) {
  const student = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { group: { select: { teacherId: true } } },
  });
  const exam = await prisma.officeExam.findUniqueOrThrow({
    where: { teacherId: student.group!.teacherId! },
  });

  const attempt = await prisma.officeExamAttempt.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId: userId } },
  });
  if (!attempt) throw new Error("attempt_not_found");
  if (attempt.status === "SUBMITTED") throw new Error("already_submitted");

  await prisma.officeExamAttempt.update({
    where: { id: attempt.id },
    data: { answers, lastSavedAt: new Date() },
  });

  return { ok: true, lastSavedAt: new Date().toISOString() };
}

export async function submitStudentExam(userId: string, answers: Record<string, string>) {
  const student = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { group: { select: { teacherId: true } } },
  });
  const exam = await prisma.officeExam.findUniqueOrThrow({
    where: { teacherId: student.group!.teacherId! },
  });

  let attempt = await prisma.officeExamAttempt.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId: userId } },
  });
  if (!attempt) {
    attempt = await prisma.officeExamAttempt.create({
      data: { examId: exam.id, studentId: userId, answers },
    });
  }

  const updated = await finalizeAttempt(attempt.id, answers);
  const state = await getStudentOfficeExamState(userId);
  return state;
}

/** Calificación final para diploma (con o sin examen). */
export async function getDiplomaGradeInfo(studentId: string, groupId: string) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { teacherId: true },
  });
  if (!group) {
    const breakdown = await computeSubjectGradeWithoutExam(studentId, groupId);
    return {
      place: breakdown.place,
      totalFirmas: breakdown.totalFirmas,
      finalGrade: breakdown.isExempt ? 10 : breakdown.finalGrade,
      firmasScore6: breakdown.firmasScore6,
      examScore4: 0,
      isExempt: breakdown.isExempt,
    };
  }

  const exam = await prisma.officeExam.findUnique({
    where: { teacherId: group.teacherId },
    select: { id: true, questionCount: true },
  });
  const attempt =
    exam &&
    (await prisma.officeExamAttempt.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId } },
    }));

  const { ranking } = await getGroupRanking(groupId);
  const entry = ranking.find((r) => r.studentId === studentId);
  const place = entry?.place ?? ranking.length;
  const totalFirmas = entry?.score ?? (await getStudentTotalFirmas(studentId, groupId));

  if (attempt?.status === "SUBMITTED") {
    const questionCount = exam?.questionCount ?? 75;
    const breakdown = await computeSubjectGrade(
      studentId,
      groupId,
      attempt.correctCount ?? 0,
      questionCount,
    );
    return {
      place,
      totalFirmas,
      finalGrade: breakdown.finalGrade,
      firmasScore6: breakdown.firmasScore6,
      examScore4: breakdown.examScore4,
      isExempt: breakdown.isExempt,
    };
  }

  const breakdown = await computeSubjectGradeWithoutExam(studentId, groupId);
  return {
    place,
    totalFirmas,
    finalGrade: breakdown.isExempt ? 10 : breakdown.finalGrade,
    firmasScore6: breakdown.firmasScore6,
    examScore4: 0,
    isExempt: breakdown.isExempt,
  };
}
