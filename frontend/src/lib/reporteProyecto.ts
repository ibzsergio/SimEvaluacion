export const REPORTE_TITULO = "REPORTE PROYECTO";
export const REPORTE_INICIO = "2026-11-20T00:00:00-06:00";
export const REPORTE_CIERRE = "2026-11-26T00:00:00-06:00";
export const REPORTE_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const REPORTE_CIERRE_TEXTO =
  "El reporte se llena del viernes 20 al miércoles 25 de noviembre. Después de ese día ya no se puede modificar.";

export const REPORTE_DIAS = [
  { id: "2026-11-20", label: "Vie 20" },
  { id: "2026-11-21", label: "Sáb 21" },
  { id: "2026-11-22", label: "Dom 22" },
  { id: "2026-11-23", label: "Lun 23" },
  { id: "2026-11-24", label: "Mar 24" },
  { id: "2026-11-25", label: "Mié 25" },
] as const;

export function reporteAbierto(at = Date.now()) {
  return at >= new Date(REPORTE_INICIO).getTime() && at < new Date(REPORTE_CIERRE).getTime();
}

export function reporteHoy(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function reporteDiaInicial(today = reporteHoy()) {
  const first = REPORTE_DIAS[0];
  const last = REPORTE_DIAS[REPORTE_DIAS.length - 1];
  if (!first || !last) return "2026-11-20";
  if (REPORTE_DIAS.some((day) => day.id === today)) return today;
  if (today < first.id) return first.id;
  return last.id;
}
