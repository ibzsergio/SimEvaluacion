export const TORRE_MINUTOS = 45;
export const TORRE_TITULO = "Torre Tkinter";
export const TORRE_PROGRAMA = "Reto colaborativo";

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
  "La torre más alta que se sostenga sola al terminar el tiempo es la ganadora.",
];

export function remainingSeconds(startedAt: string | null | undefined, minutes = TORRE_MINUTOS) {
  if (!startedAt) return minutes * 60;
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, minutes * 60 - elapsed);
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
