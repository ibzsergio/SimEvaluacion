import { firstNameFromDisplayName, getDailyMotivation } from "./dailyMotivation.js";
import { getExemptionStatus, isExemptionPartial, type ExemptionStatus } from "./exemptionStatus.js";
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
  exemption: ExemptionStatus;
};

export function buildStudentMotivation(
  studentId: string,
  displayName: string,
  place: number,
  totalStudents: number,
  myScore: number,
  ranking: RankingEntry[],
  partialClosed = false,
  currentPartial = 1,
): StudentMotivation {
  const daily = getDailyMotivation(studentId);
  const exemption = getExemptionStatus(place, partialClosed, currentPartial);
  const exemptNow = exemption.tier === "exempt";
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
      title: partialClosed ? exemption.label : "¡LUGAR #1!",
      message: exemptNow
        ? "Vas en el 1er lugar del tercer parcial. Tu desempeño te coloca como EXENTADO del examen final."
        : "Vas en el 1er lugar del parcial. Mantén el ritmo: la exención se confirma solo en el tercer parcial.",
      pointsToTop10: null,
      exemption,
    };
  }

  if (place === 2) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: true,
      emoji: "🥈",
      title: partialClosed ? exemption.label : "¡LUGAR #2!",
      message: exemptNow
        ? "Estás en 2° lugar del tercer parcial. Formas parte del Top 10 y quedas EXENTADO del examen final."
        : "Estás en 2° lugar. Sigue con constancia: la exención se confirma solo en el tercer parcial.",
      pointsToTop10: null,
      exemption,
    };
  }

  if (place === 3) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: true,
      emoji: "🥉",
      title: partialClosed ? exemption.label : "¡LUGAR #3!",
      message: exemptNow
        ? "Vas en 3er lugar del tercer parcial. Estás en el podio y dentro del Top 10: quedas EXENTADO del examen final."
        : "Vas en 3er lugar. Estás en el podio: la exención se confirma solo en el tercer parcial.",
      pointsToTop10: null,
      exemption,
    };
  }

  if (place <= 10) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: true,
      emoji: "⭐",
      title: partialClosed ? exemption.label : `Top 10 · lugar #${place}`,
      message: exemptNow
        ? `Estás en el lugar #${place} del Top 10 del tercer parcial. Quedas EXENTADO del examen final.`
        : isExemptionPartial(currentPartial)
          ? `Estás en el lugar #${place} del Top 10. La exención se confirma al cerrar el tercer parcial.`
          : `Estás en el lugar #${place} del Top 10. La exención del examen final se confirma solo en el tercer parcial.`,
      pointsToTop10: null,
      exemption,
    };
  }

  if (place <= 20) {
    return {
      ...base,
      place,
      totalStudents,
      inTop10: false,
      emoji: "🎯",
      title: exemption.label,
      message:
        "Estás entre los lugares 11 y 20. Vas muy bien: la exención se confirma en el tercer parcial, Top 10.",
      pointsToTop10: tenth ? Math.max(0, tenth.score - myScore) : null,
      exemption,
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
    title: exemption.label,
    message: `Vas en el lugar #${place} de ${totalStudents}. Sigue sumando puntos y no decaigas.${gapText}`,
    pointsToTop10,
    exemption,
  };
}
