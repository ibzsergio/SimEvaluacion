export const GLOSARIO_TITULO = "Glosario Bilingüe";
export const GLOSARIO_PDF_MAX_BYTES = 3 * 1024 * 1024;
export const GLOSARIO_CIERRE =
  "Después de la 1:10 p. m. de hoy, jueves 19 de noviembre, ya no se permite subir el PDF.";

const HORARIO = [
  {
    until: "2026-11-19T09:30:00-06:00",
    points: 1000,
    texto: "Si lo suben hasta las 9:30 a. m., la calificación es 1000 puntos.",
  },
  {
    until: "2026-11-19T11:00:00-06:00",
    points: 500,
    texto: "Si lo suben después de las 9:30 a. m. y hasta las 11:00 a. m., la calificación es 500 puntos.",
  },
  {
    until: "2026-11-19T13:10:00-06:00",
    points: 300,
    texto: "Si lo suben después de las 11:00 a. m. y hasta la 1:10 p. m., la calificación es 300 puntos.",
  },
] as const;

export function glosarioTramos(groupCode: string | null | undefined) {
  const code = groupCode?.trim();
  if (code === "301" || code === "302") return HORARIO;
  return [];
}

export function glosarioEntrega(groupCode: string | null | undefined, at: number | string = Date.now()) {
  const ms = typeof at === "number" ? at : new Date(at).getTime();
  for (const tramo of glosarioTramos(groupCode)) {
    if (ms < new Date(tramo.until).getTime()) return { open: true, points: tramo.points };
  }
  return { open: false, points: 0 };
}

export function formatoHoraGlosario(at: number | string) {
  return new Date(at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
}
