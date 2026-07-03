import { prisma } from "./prisma.js";
import { getExemptionStatus } from "./exemptionStatus.js";
import { buildGroupRanking, type RankingEntry } from "./ranking.js";

export const RANKING_RULE =
  "El lugar depende de la suma de puntos de todas las actividades. Si hay empate, gana quien fue calificado antes (primera calificación por actividad).";

export type GroupRankingRow = RankingEntry & {
  controlNumber: string | null;
  exemption: ReturnType<typeof getExemptionStatus>;
};

export async function getGroupRanking(groupId: string) {
  const activities = await prisma.activity.findMany({
    where: { groupId },
    select: { id: true },
  });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    orderBy: { listNumber: "asc" },
  });

  const totals = await prisma.grade.groupBy({
    by: ["studentId"],
    where: { student: { groupId } },
    _sum: { points: true },
  });
  const scoreByStudent = new Map(totals.map((t) => [t.studentId, t._sum.points ?? 0]));

  // Usar gradedAt (primera calificación): no se actualiza al recalificar.
  const allGrades = await prisma.grade.findMany({
    where: { activity: { groupId } },
    select: { activityId: true, studentId: true, gradedAt: true },
  });

  const ranking = buildGroupRanking(
    students.map((s) => ({
      studentId: s.id,
      displayName: s.displayName,
      listNumber: s.listNumber,
      score: scoreByStudent.get(s.id) ?? 0,
    })),
    activities.map((a) => a.id),
    allGrades.map((g) => ({
      activityId: g.activityId,
      studentId: g.studentId,
      submittedAt: g.gradedAt,
    })),
  );

  const controlById = new Map(students.map((s) => [s.id, s.controlNumber]));

  return {
    activityCount: activities.length,
    ranking: ranking.map((r) => ({
      ...r,
      controlNumber: controlById.get(r.studentId) ?? null,
      exemption: getExemptionStatus(r.place),
    })),
  };
}
