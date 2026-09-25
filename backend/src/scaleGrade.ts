/** Escala oficial del parcial: máximo 6 (el examen vale 4 y lo llena el docente). */
export const SCALE_MAX = 6;
export const EXAM_MAX = 4;
export const ACTIVITY_WEIGHT = 5;
export const PARTICIPATION_WEIGHT = 1;
export const STARS_PER_DAY = 3;

export const SCALE_RULE = {
  scaleMax: SCALE_MAX,
  examMax: EXAM_MAX,
  activityWeight: ACTIVITY_WEIGHT,
  participationWeight: PARTICIPATION_WEIGHT,
  starsPerDay: STARS_PER_DAY,
  description:
    "Los 6 puntos de escala salen de trabajos (hasta 5) y participación (hasta 1). Si no hay estrellas registradas, los 6 salen solo de los trabajos. El examen (hasta 4) no se calcula: lo llenas tú en LISTAS F1.",
} as const;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computeScale6(params: {
  activityPoints: number;
  activityMax: number;
  participationStars: number;
  participationMax: number;
  useParticipation: boolean;
}): { activityScore: number; participationScore: number; scale6: number } {
  const activityPoints = Math.max(0, params.activityPoints);
  const activityMax = Math.max(0, params.activityMax);
  const participationStars = Math.max(0, params.participationStars);
  const participationMax = Math.max(0, params.participationMax);

  if (activityMax <= 0 && (!params.useParticipation || participationMax <= 0)) {
    return { activityScore: 0, participationScore: 0, scale6: 0 };
  }

  if (!params.useParticipation || participationMax <= 0) {
    const activityScore = activityMax > 0 ? clamp((activityPoints / activityMax) * SCALE_MAX, 0, SCALE_MAX) : 0;
    return {
      activityScore: round1(activityScore),
      participationScore: 0,
      scale6: round1(activityScore),
    };
  }

  const activityScore =
    activityMax > 0 ? clamp((activityPoints / activityMax) * ACTIVITY_WEIGHT, 0, ACTIVITY_WEIGHT) : 0;
  const participationScore = clamp(
    (participationStars / participationMax) * PARTICIPATION_WEIGHT,
    0,
    PARTICIPATION_WEIGHT,
  );
  return {
    activityScore: round1(activityScore),
    participationScore: round1(participationScore),
    scale6: round1(clamp(activityScore + participationScore, 0, SCALE_MAX)),
  };
}

export function attendanceRatePercent(summary: {
  present: number;
  late: number;
  totalDays: number;
}): number {
  if (summary.totalDays <= 0) return 100;
  return Math.round(((summary.present + summary.late) / summary.totalDays) * 100);
}
