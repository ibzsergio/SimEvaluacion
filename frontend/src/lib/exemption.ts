import type { ExemptionStatus } from "./types";

/** Estatus de exención según lugar y si el parcial ya está cerrado. */
export function getExemptionStatus(place: number, partialClosed = false): ExemptionStatus {
  if (partialClosed) {
    if (place <= 10) {
      return { tier: "exempt", label: "¡EXENTADO!", shortLabel: "EXENTADO" };
    }
    if (place <= 20) {
      return { tier: "can_exempt", label: "¡TÚ PUEDES EXENTAR!", shortLabel: "PUEDES EXENTAR" };
    }
    return { tier: "keep_going", label: "¡ESTÁS CERCA, NO DECAIGAS!", shortLabel: "NO DECAIGAS" };
  }

  if (place <= 10) {
    return { tier: "none", label: "", shortLabel: "" };
  }
  if (place <= 20) {
    return { tier: "can_exempt", label: "¡TÚ PUEDES EXENTAR!", shortLabel: "PUEDES EXENTAR" };
  }
  return { tier: "keep_going", label: "¡ESTÁS CERCA, NO DECAIGAS!", shortLabel: "NO DECAIGAS" };
}
