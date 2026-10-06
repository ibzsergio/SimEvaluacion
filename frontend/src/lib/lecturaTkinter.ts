/** Lectura colaborativa. En 301 cada equipo lee un widget distinto de Tkinter. */

export const LECTURA_PROGRAMA = "Leer lo cambia todo";
export const LECTURA_TEMA_301 = "Widgets de Tkinter: un widget por equipo";
export const LECTURA_MINUTOS = 50;

export const LECTURA_WIDGETS = [
  "Frame",
  "Label",
  "Radiobutton",
  "Checkbutton",
  "Text",
  "Entry",
] as const;

export const LECTURA_PASOS = [
  "Lean estas instrucciones en equipo. No empiecen la lectura en cadena hasta que el líder active el reloj.",
  "Usen los mismos equipos de color de las butacas.",
  "Elijan un líder. Cualquiera del equipo puede marcarlo; solo el líder activa los 50 minutos.",
  "Cada equipo tiene un widget distinto (Frame, Label, Radiobutton, Checkbutton, Text o Entry). No lean ni copien el texto de otro color.",
  "Cuando el reloj arranque: cada integrante lee EN VOZ ALTA su párrafo largo (el recuadro con su nombre), de adelante hacia atrás.",
  "Con lo leído, TODO el equipo arma UN solo organizador gráfico o mapa cognitivo en Canva y lo expone. No es un trabajo por persona.",
];

export function rutaLectura(teamCount: number) {
  const n = Math.max(1, teamCount);
  const readEnd = 2 + Math.min(14, n * 2);
  const mapEnd = readEnd + 16;
  const galleryEnd = Math.min(48, mapEnd + n);
  return [
    {
      min: "0–2",
      title: "Armado y líder",
      detail: `Cada columna es un equipo (${n}). Lean la indicación, elijan líder y esperen a que active el reloj de ${LECTURA_MINUTOS} min.`,
    },
    {
      min: `2–${readEnd}`,
      title: "Lectura en cadena",
      detail:
        "En cada equipo, cada integrante lee EN VOZ ALTA su propio párrafo largo (el recuadro con su nombre). Van en orden, de adelante hacia atrás.",
    },
    {
      min: `${readEnd}–${mapEnd}`,
      title: "Un solo producto",
      detail:
        "Todo el equipo arma UN organizador gráfico o mapa cognitivo en Canva (u otra herramienta digital). No es uno por persona.",
    },
    {
      min: `${mapEnd}–${galleryEnd}`,
      title: "Exposición",
      detail: `${n} equipo(s) proyectan su Canva. Cualquier integrante puede explicar; el mapa es de todos.`,
    },
    {
      min: `${galleryEnd}–${LECTURA_MINUTOS}`,
      title: "Cierre",
      detail: "Una idea que se llevan y un error que ya no van a cometer.",
    },
  ];
}

export function remainingSeconds(startedAt: string | null | undefined, minutes = LECTURA_MINUTOS) {
  if (!startedAt) return minutes * 60;
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return Math.max(0, minutes * 60 - elapsed);
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
