import { prisma } from "../prisma.js";
import { ensureTeacherGroups } from "../groups.js";
import { computeSubjectGrade, computeSubjectGradeWithoutExam } from "./subjectGrade.js";
import { ensureOfficeExam } from "./examService.js";

export type OfficeExamGradeRow = {
  studentId: string;
  displayName: string;
  controlNumber: string | null;
  listNumber: number | null;
  groupId: string;
  groupCode: string;
  place: number;
  isExempt: boolean;
  totalFirmas: number;
  firmasScore6: number;
  examScore4: number;
  finalGrade: number;
  examStatus: string;
  examCorrect: number | null;
  submittedAt: Date | null;
};

export async function getOfficeExamGradeRows(teacherId: string): Promise<OfficeExamGradeRow[]> {
  const exam = await ensureOfficeExam(teacherId);
  const groups = await ensureTeacherGroups(teacherId);
  const groupIds = groups.map((g) => g.id);

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId: { in: groupIds } },
    select: {
      id: true,
      displayName: true,
      controlNumber: true,
      listNumber: true,
      groupId: true,
      group: { select: { code: true } },
    },
  });

  const attempts = await prisma.officeExamAttempt.findMany({
    where: { examId: exam.id, studentId: { in: students.map((s) => s.id) } },
  });
  const attemptByStudent = new Map(attempts.map((a) => [a.studentId, a]));

  const rows = await Promise.all(
    students.map(async (s) => {
      if (!s.groupId) return null;
      const gradePreview = await computeSubjectGradeWithoutExam(s.id, s.groupId);
      const attempt = attemptByStudent.get(s.id);
      let finalGrade = gradePreview.finalGrade;
      let examScore4 = gradePreview.examScore4;
      let firmasScore6 = gradePreview.firmasScore6;

      if (attempt?.status === "SUBMITTED") {
        const breakdown = await computeSubjectGrade(
          s.id,
          s.groupId,
          attempt.correctCount ?? 0,
          exam.questions.length,
        );
        finalGrade = breakdown.finalGrade;
        examScore4 = breakdown.examScore4;
        firmasScore6 = breakdown.firmasScore6;
      }

      return {
        studentId: s.id,
        displayName: s.displayName,
        controlNumber: s.controlNumber,
        listNumber: s.listNumber,
        groupId: s.groupId,
        groupCode: s.group?.code ?? "",
        place: gradePreview.place,
        isExempt: gradePreview.isExempt,
        totalFirmas: gradePreview.totalFirmas,
        firmasScore6,
        examScore4,
        finalGrade,
        examStatus: attempt?.status ?? "NOT_STARTED",
        examCorrect: attempt?.correctCount ?? null,
        submittedAt: attempt?.submittedAt ?? null,
      };
    }),
  );

  return rows.filter((r): r is OfficeExamGradeRow => r != null);
}

export function sortGradeRowsAlphabetically(rows: OfficeExamGradeRow[]): OfficeExamGradeRow[] {
  return [...rows].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" }),
  );
}
