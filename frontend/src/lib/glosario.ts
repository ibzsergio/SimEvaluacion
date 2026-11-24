export const GLOSARIO_TITULO = "Glosario Bilingüe";

export const GLOSARIO_NOTAS = [
  { code: "participa", label: "No participó", points: 200 },
  { code: "caratula", label: "Falta la carátula de Canva", points: 200 },
  { code: "descripcion", label: "La palabra clave no trae descripción", points: 200 },
  { code: "reporte", label: "Falta el reporte general", points: 300 },
  { code: "integrantes", label: "No se indica qué hizo cada integrante", points: 200 },
] as const;
export const GLOSARIO_PDF_MAX_BYTES = 3 * 1024 * 1024;
export function glosarioCierre(groupCode: string | null | undefined) {
  const code = groupCode?.trim();
  if (code === "301" || code === "302") {
    return "Después de las 6:00 p. m. del miércoles 25 de noviembre, ya no se permite subir el PDF.";
  }
  return "Esta entrega no está abierta para este grupo.";
}

const ENTREGA = {
  until: "2026-11-25T18:00:00-06:00",
  points: 1000,
  texto: "Si lo suben hasta las 6:00 p. m. del miércoles 25 de noviembre, la máxima es 1000 puntos.",
} as const;

const HORARIOS = {
  "301": [ENTREGA],
  "302": [ENTREGA],
} as const;

export function glosarioTramos(groupCode: string | null | undefined) {
  const code = groupCode?.trim();
  if (code === "301" || code === "302") return HORARIOS[code];
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
