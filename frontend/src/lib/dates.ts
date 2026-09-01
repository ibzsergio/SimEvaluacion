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

/** Etiqueta corta: Práctica 3, Actividad 2, o #4 según el nombre o el orden. */
export function getActivityKindLabel(index: number, name: string) {
  const practica = name.match(/pr[aá]cti[cç]a\s*[#]?\s*(\d+)/i);
  if (practica) return `Práctica ${practica[1]}`;
  const actividad = name.match(/actividad\s*[#]?\s*(\d+)/i);
  if (actividad) return `Actividad ${actividad[1]}`;
  return `#${index + 1}`;
}
