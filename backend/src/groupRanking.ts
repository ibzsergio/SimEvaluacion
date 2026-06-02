import { prisma } from "./prisma.js";
import { buildGroupRanking, type RankingEntry } from "./ranking.js";

export const RANKING_RULE =
  "Más puntos = mejor lugar. Si hay empate en puntos, gana quien entregó antes (orden de entrega por actividad).";

export type GroupRankingRow = RankingEntry & {
  controlNumber: string | null;
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

  const allSubmissions = await prisma.submission.findMany({
    where: { activity: { groupId } },
    select: { activityId: true, studentId: true, submittedAt: true },
  });

  const ranking = buildGroupRanking(
    students.map((s) => ({
      studentId: s.id,
      displayName: s.displayName,
      listNumber: s.listNumber,
      score: scoreByStudent.get(s.id) ?? 0,
    })),
    activities.map((a) => a.id),
    allSubmissions,
  );

  const controlById = new Map(students.map((s) => [s.id, s.controlNumber]));

  return {
    activityCount: activities.length,
    ranking: ranking.map((r) => ({
      ...r,
      controlNumber: controlById.get(r.studentId) ?? null,
    })),
  };
}
