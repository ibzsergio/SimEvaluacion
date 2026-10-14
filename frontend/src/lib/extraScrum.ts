export const EXTRA_MINUTOS = 45;
export const EXTRA_TITULO = "¡EXTRA, EXTRA!";
export const EXTRA_PROGRAMA = "El periódico del producto";
export const EXTRA_PUNTOS_MAX = 1000;

export const EXTRA_MATERIALES = [
  "Cartulina (la página de la portada)",
  "Hojas de color",
  "Pegamento y diurex",
  "Periódico y/o revistas para recortar",
];

export const EXTRA_SECCIONES = [
  {
    id: "titular",
    rol: "Product Owner",
    titulo: "El titular que vende",
    detalle: "Nombre del producto + una promesa en una frase (qué problema resuelve). Que se lea desde lejos.",
  },
  {
    id: "collage",
    rol: "Diseño / UI",
    titulo: "La foto de portada",
    detalle: "Collage con recortes de revista/periódico y hojas de color. Que se vea de revista, no de recado.",
  },
  {
    id: "como",
    rol: "Desarrollador",
    titulo: "Cómo funciona",
    detalle: "Un recuadro con 3 viñetas simples: qué hace el sistema por dentro, sin párrafos largos.",
  },
  {
    id: "sello",
    rol: "QA / Docs",
    titulo: "Sello de calidad",
    detalle: "Caja “Revisado”: créditos del equipo, que no falte nada y que no se despegue al levantarla.",
  },
  {
    id: "cierre",
    rol: "Scrum Master",
    titulo: "Cierre a tiempo",
    detalle: "Reparte zonas en la cartulina, vigila el reloj y que todos peguen. De preferencia es el líder.",
  },
  {
    id: "reportero",
    rol: "Sexto integrante (si hay)",
    titulo: "Reportero gráfico",
    detalle: "Más recortes, orilla, “precio” o fecha de edición. Ayuda a que la página se vea llena y limpia.",
  },
] as const;

export const EXTRA_PASOS = [
  "Lean en equipo. No recorten ni peguen hasta que el líder active el reloj.",
  "Usan los mismos equipos de color de las butacas.",
  "Elijan un líder (de preferencia el Scrum Master). Esa persona arranca los 45 minutos.",
  "En una cartulina armen la portada de un periódico o revista que anuncie el LANZAMIENTO de su producto.",
  "Tienen que verse las 4 zonas: titular, collage, “cómo funciona” y sello de calidad.",
  "Al acabarse el tiempo: manos arriba. No sigan pegando. La portada se tiene que sostener sola (que no se desarme).",
  "Cada equipo presenta su titular en 20 segundos. Gana la más clara, creativa y firme.",
];

export const EXTRA_PUNTAJE = [
  { lugar: 1, etiqueta: "1° · portada estrella", puntos: 1000 },
  { lugar: 2, etiqueta: "2° · muy vendible", puntos: 800 },
  { lugar: 3, etiqueta: "3° · buena edición", puntos: 650 },
  { lugar: 4, etiqueta: "4° · se entiende", puntos: 500 },
  { lugar: 5, etiqueta: "5° · le faltó punch", puntos: 350 },
  { lugar: 6, etiqueta: "6° · se armó tarde", puntos: 200 },
] as const;

export function remainingSeconds(
  startedAt: string | null | undefined,
  minutes = EXTRA_MINUTOS,
  pausedAt?: string | null,
) {
  if (!startedAt) return minutes * 60;
  const frozenAt = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((frozenAt - new Date(startedAt).getTime()) / 1000));
  return Math.max(0, minutes * 60 - elapsed);
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
