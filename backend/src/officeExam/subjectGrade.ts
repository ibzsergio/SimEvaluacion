import { getExemptionStatus } from "../exemptionStatus.js";
import { getGroupRanking } from "../groupRanking.js";
import { getStudentTotalFirmas } from "./firmas.js";

export type SubjectGradeBreakdown = {
  place: number;
  isExempt: boolean;
  totalFirmas: number;
  firmasReference: number;
  firmasScore6: number;
  examScore4: number;
  finalGrade: number;
  examAffectsGrade: boolean;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Calificación final de la materia (escala 0–10). */
export async function computeSubjectGrade(
  studentId: string,
  groupId: string,
  examCorrectCount: number,
  totalQuestions: number,
): Promise<SubjectGradeBreakdown> {
  const { ranking } = await getGroupRanking(groupId);
  const entry = ranking.find((r) => r.studentId === studentId);
  const place = entry?.place ?? ranking.length;
  const isExempt = getExemptionStatus(place).tier === "exempt";

  const totalFirmas = await getStudentTotalFirmas(studentId, groupId);
  const place11 = ranking[10];
  const firmasReference = place11 ? await getStudentTotalFirmas(place11.studentId, groupId) : 0;

  const examScore4 =
    totalQuestions > 0 ? round1((examCorrectCount / totalQuestions) * 4) : 0;

  if (isExempt) {
    return {
      place,
      isExempt: true,
      totalFirmas,
      firmasReference,
      firmasScore6: 6,
      examScore4,
      finalGrade: 10,
      examAffectsGrade: false,
    };
  }

  const firmasScore6 =
    firmasReference > 0
      ? round1(clamp((totalFirmas / firmasReference) * 6, 0, 6))
      : 0;
  const finalGrade = round1(clamp(firmasScore6 + examScore4, 0, 10));

  return {
    place,
    isExempt: false,
    totalFirmas,
    firmasReference,
    firmasScore6,
    examScore4,
    finalGrade,
    examAffectsGrade: true,
  };
}

/** Calificación sin examen (solo firmas + exención). */
export async function computeSubjectGradeWithoutExam(
  studentId: string,
  groupId: string,
): Promise<SubjectGradeBreakdown> {
  return computeSubjectGrade(studentId, groupId, 0, 75);
}
