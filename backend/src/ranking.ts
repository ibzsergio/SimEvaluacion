export type RankingStudent = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  score: number;
};

export type RankingEntry = RankingStudent & {
  place: number;
  /** Veces que fue el primero calificado en una actividad (desempate). */
  firstGradings: number;
  /** Primera calificación registrada en el grupo. */
  firstGradedAt: string | null;
  /** Promedio de fechas de calificación (ISO). */
  avgGradedAt: string | null;
  gradedActivityCount: number;
};

type SubmissionRow = {
  activityId: string;
  studentId: string;
  submittedAt: Date;
};

/**
 * Orden del grupo: suma de puntos de todas las actividades (mayor primero).
 * Empate en puntos: quien fue calificado antes en más actividades (menor suma de posición por actividad).
 * Luego: más veces primero en ser calificado, promedio de fecha más temprano, número de lista, nombre.
 * Cada alumno tiene un lugar único (1, 2, 3…).
 */
export function buildGroupRanking(
  students: RankingStudent[],
  activityIds: string[],
  submissions: SubmissionRow[],
): RankingEntry[] {
  const studentCount = students.length;
  const penaltyRank = studentCount + 1;

  const rankByStudentActivity = new Map<string, number>();
  const firstCountByStudent = new Map<string, number>();

  for (const activityId of activityIds) {
    const ordered = submissions
      .filter((s) => s.activityId === activityId)
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

    ordered.forEach((sub, index) => {
      const rank = index + 1;
      rankByStudentActivity.set(`${sub.studentId}:${activityId}`, rank);
      if (rank === 1) {
        firstCountByStudent.set(sub.studentId, (firstCountByStudent.get(sub.studentId) ?? 0) + 1);
      }
    });
  }

  const withTieBreak = students.map((s) => {
    let deliveryRankSum = 0;
    let submissionTimeSum = 0;
    let submissionCount = 0;
    let minGradedAt = Number.MAX_SAFE_INTEGER;

    for (const activityId of activityIds) {
      const rank = rankByStudentActivity.get(`${s.studentId}:${activityId}`);
      deliveryRankSum += rank ?? penaltyRank;
    }

    for (const sub of submissions) {
      if (sub.studentId !== s.studentId) continue;
      const t = sub.submittedAt.getTime();
      submissionTimeSum += t;
      submissionCount += 1;
      if (t < minGradedAt) minGradedAt = t;
    }

    const avgSubmissionTime =
      submissionCount > 0 ? submissionTimeSum / submissionCount : Number.MAX_SAFE_INTEGER;

    return {
      ...s,
      deliveryRankSum,
      firstSubmissions: firstCountByStudent.get(s.studentId) ?? 0,
      avgSubmissionTime,
      minGradedAt,
      gradedActivityCount: submissionCount,
    };
  });

  withTieBreak.sort(
    (a, b) =>
      b.score - a.score ||
      a.deliveryRankSum - b.deliveryRankSum ||
      b.firstSubmissions - a.firstSubmissions ||
      a.avgSubmissionTime - b.avgSubmissionTime ||
      (a.listNumber ?? 999) - (b.listNumber ?? 999) ||
      a.displayName.localeCompare(b.displayName, "es"),
  );

  return withTieBreak.map((entry, index) => ({
    studentId: entry.studentId,
    displayName: entry.displayName,
    listNumber: entry.listNumber,
    score: entry.score,
    place: index + 1,
    firstGradings: entry.firstSubmissions,
    firstGradedAt:
      entry.minGradedAt === Number.MAX_SAFE_INTEGER ? null : new Date(entry.minGradedAt).toISOString(),
    avgGradedAt:
      entry.gradedActivityCount > 0 ? new Date(entry.avgSubmissionTime).toISOString() : null,
    gradedActivityCount: entry.gradedActivityCount,
  }));
}
