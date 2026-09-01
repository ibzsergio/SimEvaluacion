import type { ClassGroup } from "./types";

/** Ej. "301 + 302" */
export function formatGroupCodesPlus(groups: ClassGroup[]) {
  const codes = [...new Set(groups.map((g) => g.code))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
  if (!codes.length) return "tus grupos";
  return codes.join(" + ");
}

/** Ej. "301 y 302" */
export function formatGroupCodesAnd(groups: ClassGroup[]) {
  const codes = [...new Set(groups.map((g) => g.code))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
  if (!codes.length) return "tus grupos";
  if (codes.length === 1) return codes[0]!;
  return codes.join(" y ");
}

/** Ej. "301_302" para nombres de archivo */
export function formatGroupCodesFileSuffix(groups: ClassGroup[]) {
  const codes = [...new Set(groups.map((g) => g.code))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
  if (!codes.length) return "grupos";
  return codes.join("_");
}

export function formatTeacherGroupsSubtitle(groups: ClassGroup[], teacherName = "Sergio Ibañez Montiel") {
  const shift = groups[0]?.shift ?? "matutino";
  const codes = formatGroupCodesAnd(groups);
  return `Grupos ${codes} · Turno ${shift} — ${teacherName}`;
}
