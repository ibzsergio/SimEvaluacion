export type ExemptionTier = "exempt" | "can_exempt" | "keep_going" | "none";

export type ExemptionStatus = {
  tier: ExemptionTier;
  /** Mensaje principal (banner). */
  label: string;
  /** Texto corto para tablas. */
  shortLabel: string;
};

/** La exención del examen final solo se confirma en el 3er parcial. */
export const EXEMPTION_PARTIAL = 3;

export function isExemptionPartial(currentPartial = 1) {
  return (currentPartial ?? 1) >= EXEMPTION_PARTIAL;
}

/** Estatus de exención: EXENTADO solo en 3er parcial, al cerrar, Top 10. */
export function getExemptionStatus(
  place: number,
  partialClosed = false,
  currentPartial = 1,
): ExemptionStatus {
  const confirmExempt = partialClosed && isExemptionPartial(currentPartial);
  if (confirmExempt && place <= 10) {
    return {
      tier: "exempt",
      label: "¡EXENTADO!",
      shortLabel: "EXENTADO",
    };
  }
  if (place <= 20) {
    return {
      tier: "can_exempt",
      label: "¡TÚ PUEDES EXENTAR!",
      shortLabel: "PUEDES EXENTAR",
    };
  }
  return {
    tier: "keep_going",
    label: "¡ESTÁS CERCA, NO DECAIGAS!",
    shortLabel: "NO DECAIGAS",
  };
}

export function getDiplomaHeadline(place: number): string {
  if (place === 1) return "Referente excepcional del parcial";
  if (place === 2) return "Excelencia que inspira al grupo";
  if (place === 3) return "Talento de podio, carácter de líder";
  if (place <= 10) return "Élite del desempeño: Top 10";
  if (place <= 20) return "Cerca de la cima, con rumbo claro";
  return "Constancia que construye un gran futuro";
}

export function getDiplomaEncouragement(
  place: number,
  totalStudents: number,
  firstName?: string,
  currentPartial = 1,
): string {
  const name = firstName?.trim() || "";
  const vocative = name ? `${name}, ` : "";
  const total = Math.max(1, totalStudents);

  if (place === 1) {
    return `${vocative}ocupaste el lugar #1 de ${total}. No fue casualidad: tu constancia, la calidad de tus entregas y tu presencia en clase te convierten en el referente excepcional de este parcial. Este diploma reconoce una trayectoria que ya marca la diferencia. ¡Felicitaciones por un desempeño extraordinario!`;
  }
  if (place === 2) {
    return `${vocative}llegaste al lugar #2 de ${total}. Estuviste a un paso de la cima y tu trabajo se siente en cada actividad. Eres ejemplo de excelencia y de cómo el esfuerzo constante inspira a todo el grupo. ¡Sigue brillando con esa misma fuerza!`;
  }
  if (place === 3) {
    return `${vocative}cerraste el parcial en el lugar #3 de ${total}. Subiste al podio con mérito propio: disciplina, entrega y carácter. Este reconocimiento celebra a alguien que ya lidera con resultados. ¡El siguiente salto está a tu alcance!`;
  }
  if (place <= 10) {
    const exemptLine = isExemptionPartial(currentPartial)
      ? "Quedas EXENTADO del examen final por un desempeño digno de este diploma. ¡Orgullo merecido!"
      : "La exención del examen final se confirma solo en el tercer parcial. Llega ahí con este mismo nivel. ¡Orgullo merecido!";
    return `${vocative}formaste parte de la élite: lugar #${place} de ${total}. Tu lugar en el Top 10 no es un premio menor; es la prueba de un semestre trabajado con seriedad. ${exemptLine}`;
  }
  if (place <= 20) {
    return `${vocative}concluiste en el lugar #${place} de ${total}. Estás en la zona alta del grupo y muy cerca de la élite. La exención se juega en el tercer parcial: una racha más de entregas impecables te puede llevar al Top 10. ¡No aflojes ahora!`;
  }
  return `${vocative}finalizaste en el lugar #${place} de ${total}. Tu esfuerzo cuenta y se nota. Este diploma no cierra tu historia: afirma que ya empezaste el camino. Cada actividad bien hecha te acerca a un lugar más alto. ¡Sigue, porque tu mejor parcial todavía puede escribirse!`;
}

export const DIPLOMA_TEACHER_NAME = "Ing. Sergio Ibañez Montiel";
export const DIPLOMA_SUBJECT_NAME = "Desarrolla Software de Sistemas Informaticos";
