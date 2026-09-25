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
    "La escala (máximo 6) usa los mismos puntos del ranking: trabajos + estrellas de participación. Quien va 1° obtiene 6. El resto: sus puntos ÷ puntos del 1° × 6. El examen (hasta 4) no se calcula: lo llenas tú en LISTAS F1.",
} as const;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function rankingScoreForScale(activityPoints: number, participationStars: number) {
  return Math.max(0, activityPoints) + Math.max(0, participationStars);
}

/** Escala 0–6 relativa al 1er lugar del ranking (trabajos + participación). */
export function computeScale6(params: {
  rankingScore: number;
  firstPlaceScore: number;
}): { scale6: number } {
  const score = Math.max(0, params.rankingScore);
  const first = Math.max(0, params.firstPlaceScore);
  if (first <= 0) return { scale6: 0 };
  return { scale6: round1(clamp((score / first) * SCALE_MAX, 0, SCALE_MAX)) };
}

/** % oficial: solo la falta injustificada (F) baja. Presente, retardo y justificada cuentan. */
export function attendanceRatePercent(summary: {
  classDays: number;
  absent: number;
}): number {
  if (summary.classDays <= 0) return 100;
  const missed = Math.min(Math.max(0, summary.absent), summary.classDays);
  return Math.round(((summary.classDays - missed) / summary.classDays) * 100);
}
