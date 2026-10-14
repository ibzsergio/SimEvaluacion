const ROLE_SHORT: Record<string, string> = {
  scrum_master: "Scrum Master",
  product_owner: "Product Owner",
  developer: "Desarrollador",
  ui_designer: "Diseño / UI",
  qa_docs: "QA / Docs",
};

export function extraRoleLabel(role?: string | null) {
  if (!role) return "";
  return ROLE_SHORT[role] ?? role;
}

export const EXTRA_MINUTOS = 50;
export const EXTRA_TITULO = "¡EXTRA, EXTRA!";
export const EXTRA_PROGRAMA = "Lanzan su app Tkinter";
export const EXTRA_PUNTOS_MAX = 1000;

/** Qué anuncian: no es un objeto genérico ni una app de celular. */
export const EXTRA_PRODUCTO =
  "Una aplicación de escritorio en Python + Tkinter: una ventana con botones, cajas de texto y menús que resuelve un problema real del plantel o de la vida diaria (pase de lista, calificaciones, cafetería, biblioteca, horarios, inventario del taller, registro de incidencias, etc.).";

export const EXTRA_PRODUCTO_NO =
  "No anuncian perfume, ropa, un juego sin ventana ni una app de celular. Es el sistema que van a programar con Tkinter.";

export const EXTRA_PRODUCTO_DEBE = [
  "Nombre corto de la app (inventado por el equipo)",
  "Quién la usa (alumno, docente, prefecto, cafetería…)",
  "El problema que resuelve, en una frase que se lea desde lejos",
  "3 funciones de la ventana (qué hace el usuario y qué responde el programa)",
];

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
    detalle:
      "Nombre de la app Tkinter + promesa: para quién es y qué problema del plantel o de la vida diaria resuelve. Que se lea desde lejos.",
  },
  {
    id: "collage",
    rol: "Diseño / UI",
    titulo: "La “pantalla” de portada",
    detalle:
      "Collage que se vea como la ventana del programa (marco, botones, cajas). Recortes de revista/periódico y hojas de color. Que se vea de revista, no de recado.",
  },
  {
    id: "como",
    rol: "Desarrollador",
    titulo: "Cómo funciona",
    detalle:
      "Recuadro con 3 viñetas: qué escribe o elige el usuario, qué hace Python, qué muestra la ventana. Sin párrafos largos.",
  },
  {
    id: "sello",
    rol: "QA / Docs",
    titulo: "Sello de calidad",
    detalle: "Caja “Revisado”: créditos del equipo, que no falte nombre de la app ni las 3 funciones, y que no se despegue.",
  },
  {
    id: "cierre",
    rol: "Scrum Master",
    titulo: "Cierre a tiempo",
    detalle: "Reparte zonas en la cartulina, vigila el reloj de 50 minutos y que todos peguen. De preferencia es el líder.",
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
  "En 301: equipos de proyecto de Roles / Equipos (su app del semestre). En 302: la columna de butacas se pone de acuerdo en UNA sola app Tkinter.",
  "Elijan un líder (de preferencia el Scrum Master). Esa persona arranca los 50 minutos.",
  "En una cartulina armen la portada de un periódico o revista que anuncie el LANZAMIENTO de su aplicación de escritorio en Python + Tkinter (nombre, usuario y problema).",
  "Tienen que verse las 4 zonas: titular, collage de la ventana, “cómo funciona” (3 funciones) y sello de calidad.",
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
