import { prisma } from "./prisma.js";
import { formatClassDayIso, getParticipationStarsByStudent } from "./classDayService.js";
import { getExemptionStatus } from "./exemptionStatus.js";
import {
  applyAttendanceDemotions,
  buildGroupRanking,
  type AttendanceDemotionInput,
  type RankingEntry,
} from "./ranking.js";

export const RANKING_RULE =
  "El lugar sale de los puntos de actividades + estrellas de participación. Cada falta injustificada baja 1 puesto; cada 3 retardos cuentan como 1 falta. Las justificadas no afectan. Si hay empate en puntos, gana quien fue calificado antes.";

export type GroupRankingRow = RankingEntry & {
  controlNumber: string | null;
  exemption: ReturnType<typeof getExemptionStatus>;
};

async function getAttendanceDemotionInputs(
  groupId: string,
  partialNumber: number,
): Promise<AttendanceDemotionInput[]> {
  const rows = await prisma.classDayRecord.findMany({
    where: {
      groupId,
      partialNumber,
      attendance: { in: ["ABSENT", "LATE"] },
    },
    select: { studentId: true, attendance: true, date: true },
    orderBy: { date: "asc" },
  });

  const byStudent = new Map<string, { absentDates: string[]; lateDates: string[] }>();
  for (const row of rows) {
    let bucket = byStudent.get(row.studentId);
    if (!bucket) {
      bucket = { absentDates: [], lateDates: [] };
      byStudent.set(row.studentId, bucket);
    }
    const iso = formatClassDayIso(row.date);
    if (row.attendance === "ABSENT") bucket.absentDates.push(iso);
    else if (row.attendance === "LATE") bucket.lateDates.push(iso);
  }

  return [...byStudent.entries()].map(([studentId, dates]) => ({
    studentId,
    absentDates: dates.absentDates,
    lateDates: dates.lateDates,
  }));
}

/** Ranking oficial del parcial ya cerrado (F1, diplomas, examen). */
export function closedRankingPartial(currentPartial: number) {
  return Math.max(1, (Number(currentPartial) || 1) - 1);
}

export async function getOfficialGroupRanking(groupId: string) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { currentPartial: true },
  });
  return getGroupRanking(groupId, closedRankingPartial(group?.currentPartial ?? 1));
}

export async function getGroupRanking(groupId: string, rankingPartial?: number) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { partialClosed: true, currentPartial: true },
  });
  const partialClosed = group?.partialClosed ?? false;
  const currentPartial = group?.currentPartial ?? 1;
  const partialNumber = rankingPartial ?? currentPartial;

  const activities = await prisma.activity.findMany({
    where: { groupId, partialNumber },
    select: { id: true },
  });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", groupId },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    orderBy: { listNumber: "asc" },
  });

  const totals = await prisma.grade.groupBy({
    by: ["studentId"],
    where: { student: { groupId }, activity: { groupId, partialNumber } },
    _sum: { points: true },
  });
  const scoreByStudent = new Map(totals.map((t) => [t.studentId, t._sum.points ?? 0]));
  const participationByStudent = await getParticipationStarsByStudent(groupId, partialNumber);

  // Usar gradedAt (primera calificación): no se actualiza al recalificar.
  const allGrades = await prisma.grade.findMany({
    where: { activity: { groupId, partialNumber } },
    select: { activityId: true, studentId: true, gradedAt: true },
  });

  const baseRanking = buildGroupRanking(
    students.map((s) => ({
      studentId: s.id,
      displayName: s.displayName,
      listNumber: s.listNumber,
      score: (scoreByStudent.get(s.id) ?? 0) + (participationByStudent.get(s.id) ?? 0),
    })),
    activities.map((a) => a.id),
    allGrades.map((g) => ({
      activityId: g.activityId,
      studentId: g.studentId,
      submittedAt: g.gradedAt,
    })),
  );

  const attendance = await getAttendanceDemotionInputs(groupId, partialNumber);
  const ranking = applyAttendanceDemotions(baseRanking, attendance);

  const controlById = new Map(students.map((s) => [s.id, s.controlNumber]));

  return {
    activityCount: activities.length,
    rankingPartial: partialNumber,
    ranking: ranking.map((r) => ({
      ...r,
      controlNumber: controlById.get(r.studentId) ?? null,
      exemption: getExemptionStatus(r.place, partialClosed, currentPartial),
    })),
  };
}
