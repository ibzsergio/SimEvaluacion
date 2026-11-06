export const EXAMEN_TITULO = "EXAMEN";
export const EXAMEN_PROGRAMA = "Cierre del parcial · solo grupo 302";
export const EXAMEN_GRUPO = "302";
export const EXAMEN_PDF_MAX_BYTES = 3 * 1024 * 1024;
export const EXAMEN_CIERRE_ISO = "2026-11-06T17:00:00-06:00";
export const EXAMEN_CIERRE_TEXTO = "El examen solo se puede subir hoy, hasta las 5:00 p. m.";

export const EXAMEN_REGLAS = [
  "Es tu examen. Un PDF por alumno.",
  "El PDF empieza con carátula.",
  "En la carátula aparece tu nombre completo y la fecha.",
  "El PDF trae fotos de todo el examen y se leen.",
  "Cada hoja lleva margen amarillo. Si no lo trae, no se toma en cuenta.",
  "El PDF no pasa de 3 MB.",
  EXAMEN_CIERRE_TEXTO,
];

export const EXAMEN_CHECKS = [
  { id: "caratula", text: "El PDF empieza con carátula." },
  { id: "nombre", text: "En la carátula está mi nombre completo." },
  { id: "fecha", text: "En la carátula está la fecha." },
  { id: "fotos", text: "Están las fotos de todo mi examen." },
  { id: "legibles", text: "Las fotos se leen: se ve la letra, no están oscuras ni cortadas." },
  { id: "margen", text: "Todas las hojas tienen margen amarillo. Si falta, el examen no se toma en cuenta." },
] as const;

export function examenAbierto(now = Date.now()) {
  return now < new Date(EXAMEN_CIERRE_ISO).getTime();
}

export function examenEsGrupo(groupCode?: string | null) {
  return groupCode?.trim() === EXAMEN_GRUPO;
}

export function formatExamenSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
