import type { OfficeProgram } from "@prisma/client";
import { prisma } from "../prisma.js";
import { OFFICE_EXAM_QUESTIONS } from "./questionsData.js";
import { computeSubjectGrade } from "./subjectGrade.js";

export const EXAM_INSTRUCTIONS = `INSTRUCCIONES DEL EXAMEN — Office 2019 (Word, PowerPoint y Excel)

• El examen consta de 75 preguntas de opción múltiple (A, B, C, D): 25 de Word, 25 de PowerPoint y 25 de Excel.
• Tiempo máximo recomendado: 1 hora. Organiza tu tiempo.
• IMPORTANTE: No cambies de pestaña, ventana ni aplicación durante el examen; hacerlo puede invalidar tu evaluación según el reglamento del curso.
• Tus respuestas se guardan automáticamente en este dispositivo. Si pierdes conexión, no cierres el navegador: al volver a tener internet podrás continuar.
• Al finalizar verás tu calificación del examen y tu calificación de la materia según las reglas del parcial.
• Si estás EXENTADO (Top 10), el examen es opcional y no modifica tu calificación final de 10.`;

export async function ensureOfficeExam(teacherId: string) {
  let exam = await prisma.officeExam.findUnique({
    where: { teacherId },
    include: { _count: { select: { questions: true } } },
  });

  if (!exam) {
    exam = await prisma.officeExam.create({
      data: {
        teacherId,
        title: "Evaluación Office 2019 — Word, PowerPoint y Excel",
      },
      include: { _count: { select: { questions: true } } },
    });
  }

  if (exam._count.questions === 0) {
    await prisma.officeExamQuestion.createMany({
      data: OFFICE_EXAM_QUESTIONS.map((q, index) => ({
        examId: exam!.id,
        program: q.program as OfficeProgram,
        sortOrder: index,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
      })),
    });
  }

  return prisma.officeExam.findUniqueOrThrow({
    where: { id: exam.id },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { attempts: true } },
    },
  });
}

export function scoreAnswers(
  questions: { id: string; correctOption: string }[],
  answers: Record<string, string>,
) {
  let correct = 0;
  for (const q of questions) {
    const picked = (answers[q.id] ?? "").toUpperCase();
    if (picked && picked === q.correctOption.toUpperCase()) correct++;
  }
  return correct;
}

export async function finalizeAttempt(attemptId: string, answers: Record<string, string>) {
  const attempt = await prisma.officeExamAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      exam: { include: { questions: true } },
      student: { select: { id: true, groupId: true } },
    },
  });

  if (!attempt.student.groupId) {
    throw new Error("student_without_group");
  }

  const correctCount = scoreAnswers(attempt.exam.questions, answers);
  const breakdown = await computeSubjectGrade(
    attempt.student.id,
    attempt.student.groupId,
    correctCount,
    attempt.exam.questions.length,
  );

  return prisma.officeExamAttempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      answers,
      correctCount,
      examScore4: breakdown.examScore4,
      firmasScore6: breakdown.firmasScore6,
      finalGrade: breakdown.finalGrade,
      isExempt: breakdown.isExempt,
      submittedAt: new Date(),
      lastSavedAt: new Date(),
    },
  });
}

/** Recalcula calificaciones de intentos enviados con el ranking y puntos actuales. */
export async function recalculateAllSubmittedAttempts(teacherId: string) {
  const exam = await ensureOfficeExam(teacherId);
  const attempts = await prisma.officeExamAttempt.findMany({
    where: { examId: exam.id, status: "SUBMITTED" },
    include: { student: { select: { id: true, groupId: true } } },
  });

  let updated = 0;
  for (const attempt of attempts) {
    if (!attempt.student.groupId) continue;
    const breakdown = await computeSubjectGrade(
      attempt.studentId,
      attempt.student.groupId,
      attempt.correctCount ?? 0,
      exam.questions.length,
    );
    await prisma.officeExamAttempt.update({
      where: { id: attempt.id },
      data: {
        examScore4: breakdown.examScore4,
        firmasScore6: breakdown.firmasScore6,
        finalGrade: breakdown.finalGrade,
        isExempt: breakdown.isExempt,
      },
    });
    updated++;
  }

  return { updated, total: attempts.length };
}

export function publicQuestion(q: {
  id: string;
  program: OfficeProgram;
  sortOrder: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}) {
  return {
    id: q.id,
    program: q.program,
    sortOrder: q.sortOrder,
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
  };
}
