import { prisma } from "../prisma.js";
import { getGroupRanking } from "../groupRanking.js";
import { getStudentParticipationStars } from "../classDayService.js";

/**
 * Total de firmas/puntos del alumno según la plataforma.
 * Incluye estrellas de participación en clase (1 estrella = 1 punto).
 * Usa la suma de `signatures` por actividad cuando existe; si no, los puntos totales del ranking.
 */
export async function getStudentTotalFirmas(studentId: string, groupId: string): Promise<number> {
  const participationStars = await getStudentParticipationStars(studentId, groupId);

  const grades = await prisma.grade.findMany({
    where: { studentId, activity: { groupId } },
    select: { signatures: true },
  });

  const sigSum = grades.reduce((acc, g) => acc + (g.signatures ?? 0), 0) + participationStars;
  if (sigSum > 0) return sigSum;

  const { ranking } = await getGroupRanking(groupId);
  const entry = ranking.find((r) => r.studentId === studentId);
  return entry?.score ?? 0;
}

export async function getFirmasByStudentForGroup(
  groupId: string,
): Promise<Map<string, number>> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true },
  });

  const participation = await prisma.classDayRecord.groupBy({
    by: ["studentId"],
    where: { groupId },
    _sum: { stars: true },
  });
  const starsByStudent = new Map(
    participation.map((p) => [p.studentId, p._sum.stars ?? 0]),
  );

  const gradeRows = await prisma.grade.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, activity: { groupId } },
    select: { studentId: true, signatures: true },
  });
  const sigByStudent = new Map<string, number>();
  for (const g of gradeRows) {
    sigByStudent.set(g.studentId, (sigByStudent.get(g.studentId) ?? 0) + (g.signatures ?? 0));
  }

  const { ranking } = await getGroupRanking(groupId);
  const rankingByStudent = new Map(ranking.map((r) => [r.studentId, r.score]));

  const map = new Map<string, number>();
  for (const s of students) {
    const sigSum = (sigByStudent.get(s.id) ?? 0) + (starsByStudent.get(s.id) ?? 0);
    map.set(s.id, sigSum > 0 ? sigSum : rankingByStudent.get(s.id) ?? 0);
  }
  return map;
}
