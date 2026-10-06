/** Fecha local YYYY-MM-DD (sin desfase UTC). */
export function todayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Extrae YYYY-MM-DD de un valor de API sin desfase por zona horaria. */
export function calendarDateIso(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1]!;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convierte fecha de API (ISO o YYYY-MM-DD) a valor para input type="date". */
export function toDateInputValue(value: string) {
  return calendarDateIso(value);
}

/** Muestra fecha de calendario sin correr un día por zona horaria. */
export function formatCalendarDate(value: string) {
  const iso = calendarDateIso(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Extrae el número si el nombre trae «Práctica 3», «PRACTICA #2», etc. */
export function extractPracticaNumber(name: string): number | null {
  const match = (name ?? "").match(/pr[aá]cti[cç]a\s*[#\-:]?\s*(\d+)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function looksLikePractica(name: string) {
  return /pr[aá]cti[cç]a/i.test(name ?? "");
}

/** Siguiente número de práctica según las ya publicadas (1 si aún no hay). */
export function nextPracticaNumber(names: string[]) {
  let max = 0;
  for (const name of names) {
    const n = extractPracticaNumber(name);
    if (n && n > max) max = n;
  }
  return max + 1;
}

/**
 * Si el texto es una práctica sin número, inserta el que sigue.
 * «PRÁCTICA» → «Práctica 4»; «PRÁCTICA DECISIÓN» → «Práctica 4 DECISIÓN».
 */
export function ensurePracticaNumber(name: string, nextNumber: number) {
  const text = name ?? "";
  if (!looksLikePractica(text) || extractPracticaNumber(text) != null) return text;
  return text.replace(/(pr[aá]cti[cç]a)(\s*)/i, (_all, word: string, spaces: string) => {
    return `${word} ${nextNumber}${spaces || " "}`;
  });
}
export function getActivityKindLabel(index: number, name: string) {
  const text = name ?? "";
  const practica = text.match(/pr[aá]cti[cç]a\s*[#]?\s*(\d+)/i);
  if (practica) return `Práctica ${practica[1]}`;
  const actividad = text.match(/actividad\s*[#]?\s*(\d+)/i);
  if (actividad) return `Actividad ${actividad[1]}`;
  return `#${index + 1}`;
}

export function partialLabel(n: number) {
  if (n === 1) return "Primer parcial";
  if (n === 2) return "Segundo parcial";
  if (n === 3) return "Tercer parcial";
  if (n === 4) return "Cuarto parcial";
  return `Parcial ${n}`;
}
