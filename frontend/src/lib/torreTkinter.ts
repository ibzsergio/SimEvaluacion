export const TORRE_MINUTOS = 45;
export const TORRE_TITULO = "Torre Tkinter";
export const TORRE_PROGRAMA = "Reto colaborativo";
export const TORRE_PUNTOS_MAX = 1000;

export const TORRE_NIVELES = [
  {
    nivel: 1,
    nombre: "Base — la ventana",
    palabras: ["Tk()", "title()", "geometry()", "mainloop()"],
  },
  {
    nivel: 2,
    nombre: "Estructura — cajas",
    palabras: ["Frame", "LabelFrame", "pack()", "grid()"],
  },
  {
    nivel: 3,
    nombre: "Widgets — lo que se ve",
    palabras: ["Label", "Button", "Entry", "Text"],
  },
  {
    nivel: 4,
    nombre: "Opciones — una o varias",
    palabras: ["Radiobutton", "Checkbutton", "StringVar", "IntVar"],
  },
  {
    nivel: 5,
    nombre: "Cima — eventos",
    palabras: ["command", "get()", "set()", "place()"],
  },
] as const;

export const TORRE_PASOS = [
  "Lean estas instrucciones en equipo. No empiecen a construir hasta que el líder active el reloj.",
  "Usen los mismos equipos de color de las butacas (los de la lectura de ayer).",
  "Elijan un líder. Cualquiera del equipo puede marcarlo; el líder es quien activa la actividad.",
  "Materiales: popotes, pegamento y hojas de color para hacer banderillas de papel.",
  "Construyan una sola torre. Cada fase o nivel debe llevar banderillas con palabras significativas de Tkinter (las de abajo o equivalentes).",
  "En la cima, la torre deberá llevar una bandera que diga Tkinter.",
  "La torre más alta que se sostenga sola al terminar el tiempo es la ganadora.",
];

/** 6 equipos: el puntaje de cada integrante depende del lugar por altura. El ganador obtiene 1000. */
export const TORRE_PUNTAJE = [
  { lugar: 1, etiqueta: "1° · la más alta (ganador)", puntos: 1000 },
  { lugar: 2, etiqueta: "2° · segunda más alta", puntos: 800 },
  { lugar: 3, etiqueta: "3° · tercera", puntos: 650 },
  { lugar: 4, etiqueta: "4° · cuarta", puntos: 500 },
  { lugar: 5, etiqueta: "5° · quinta", puntos: 350 },
  { lugar: 6, etiqueta: "6° · la más baja", puntos: 200 },
] as const;


export function remainingSeconds(
  startedAt: string | null | undefined,
  minutes = TORRE_MINUTOS,
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
