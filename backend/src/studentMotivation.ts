import { firstNameFromDisplayName, getDailyMotivation } from "./dailyMotivation.js";
import type { RankingEntry } from "./ranking.js";

export type StudentMotivation = {
  displayName: string;
  firstName: string;
  dailyDate: string;
  dailyEmoji: string;
  dailyMessage: string;
  place: number;
  totalStudents: number;
  inTop10: boolean;
  emoji: string;
  title: string;
  message: string;
  /** Puntos que le faltan al #10 para empatar (solo si va después del 10). */
  pointsToTop10: number | null;
};

export function buildStudentMotivation(
  studentId: string,
  displayName: string,
  place: number,
  totalStudents: number,
  myScore: number,
  ranking: RankingEntry[],
): StudentMotivation {
  const daily = getDailyMotivation(studentId);
  const base = {
    displayName,
    firstName: firstNameFromDisplayName(displayName),
    dailyDate: daily.date,
    dailyEmoji: daily.emoji,
    dailyMessage: daily.message,
  };
  const tenth = ranking[9];
  const pointsToTop10 =
    place > 10 && tenth ? Math.max(0, tenth.score - myScore) : place > 10 ? null : null;

  if (place === 1) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: true,
      emoji: "🥇",
      title: "¡Eres el líder del grupo!",
      message:
        "Vas en el 1er lugar. Mantén el ritmo: entrega a tiempo y no bajes del ranking—todos te están siguiendo.",
      pointsToTop10: null,
    };
  }

  if (place === 2) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: true,
      emoji: "🥈",
      title: "¡Subcampeón del grupo!",
      message:
        "Estás en 2° lugar. Un poco más de constancia y puedes alcanzar el #1. No te relajes: el podio se defiende cada semana.",
      pointsToTop10: null,
    };
  }

  if (place === 3) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: true,
      emoji: "🥉",
      title: "¡En el podio!",
      message:
        "Vas en 3er lugar. Sigue entregando con puntualidad para no perder tu posición en el Top 3.",
      pointsToTop10: null,
    };
  }

  if (place <= 10) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: true,
      emoji: "⭐",
      title: `¡Top 10! Vas en el lugar #${place}`,
      message:
        "Estás entre los 10 mejores del grupo. Cuida tus entregas pendientes: un descuido puede hacerte bajar varios lugares.",
      pointsToTop10: null,
    };
  }

  const gapText =
    pointsToTop10 != null && pointsToTop10 > 0
      ? ` Te faltan ${pointsToTop10} punto${pointsToTop10 === 1 ? "" : "s"} para alcanzar al #10.`
      : pointsToTop10 === 0
        ? " Estás muy cerca del Top 10: con la siguiente actividad bien hecha puedes entrar."
        : "";

  return {
    ...base,
    place,
    totalStudents,
    inTop10: false,
    emoji: "💪",
    title: `Vas en el lugar #${place} de ${totalStudents}`,
    message: `Aún no estás en el Top 10, pero puedes lograrlo.${gapText} Entrega tus actividades pendientes y suma puntos—cada práctica te acerca.`,
    pointsToTop10,
  };
}
