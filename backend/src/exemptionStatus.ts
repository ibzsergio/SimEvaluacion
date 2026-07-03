export type ExemptionTier = "exempt" | "can_exempt" | "keep_going";

export type ExemptionStatus = {
  tier: ExemptionTier;
  /** Mensaje principal (banner). */
  label: string;
  /** Texto corto para tablas. */
  shortLabel: string;
};

/** Estatus de exención según lugar en el ranking del parcial. */
export function getExemptionStatus(place: number): ExemptionStatus {
  if (place <= 10) {
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

export function getDiplomaEncouragement(place: number, totalStudents: number): string {
  if (place <= 10) {
    return `Obtuviste el lugar #${place} de ${totalStudents} en el ranking del parcial. Tu constancia, puntualidad y calidad en las actividades te hacen merecedor(a) de este reconocimiento. ¡Felicitaciones por tu excelente desempeño!`;
  }
  if (place <= 20) {
    return `Concluiste el parcial en el lugar #${place} de ${totalStudents}. Has demostrado compromiso y avance sólido en la materia. Sigue con esa actitud: estás muy cerca de alcanzar la exención del examen final.`;
  }
  return `Finalizaste el parcial en el lugar #${place} de ${totalStudents}. Tu esfuerzo en la materia es valioso y visible. No te detengas: cada actividad te acerca más a tus metas académicas.`;
}

export const DIPLOMA_TEACHER_NAME = "Ing. Sergio Ibañez Montiel";
export const DIPLOMA_SUBJECT_NAME = "Desarrolla Software de Sistemas Informaticos";
