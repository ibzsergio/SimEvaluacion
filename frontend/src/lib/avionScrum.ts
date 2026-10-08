export const AVION_MINUTOS = 30;
export const AVION_TITULO = "Sprint aéreo";
export const AVION_PROGRAMA = "Actividad Scrum";
export const AVION_PUNTOS_MAX = 1000;

export const AVION_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Define qué cuenta como listo: debe volar, llegar entero y medirse en metros. Prioriza distancia, no adornos.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Cuida el tiempo, quita bloqueos y hace que el equipo hable. No construye el avión por los demás.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Pliega y arma el prototipo. Integra los cambios de cada prueba sin romper lo que ya vuela.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "Identidad del equipo en alas o fuselaje, sin estorbar el vuelo. El avión debe reconocerse de lejos.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Hace 3 vuelos de prueba, anota distancia y falla, y propone el ajuste. Mide el lanzamiento final.",
  },
] as const;

export const AVION_SPRINTS = [
  {
    nivel: 1,
    nombre: "Sprint 0 — Definition of Done",
    detalle: "Acuerden en 3 minutos: qué es un vuelo válido, desde dónde se lanza y cómo se mide.",
  },
  {
    nivel: 2,
    nombre: "Sprint 1 — prototipo",
    detalle: "Primer avión que vuele. No busquen belleza todavía.",
  },
  {
    nivel: 3,
    nombre: "Sprint 2 — pruebas",
    detalle: "QA lanza, el equipo ajusta. Un cambio a la vez.",
  },
  {
    nivel: 4,
    nombre: "Sprint 3 — release",
    detalle: "Un solo avión final. Identidad visible. Listos para la medición grupal.",
  },
] as const;

export const AVION_PASOS = [
  "Lean estas instrucciones en equipo. No empiecen a plegar hasta que el líder active el reloj.",
  "Usen los mismos equipos de color de las butacas.",
  "Cada integrante toma un rol Scrum (el de la encuesta, o el que les falte en el equipo).",
  "Elijan un líder. Cualquiera puede marcarlo; el líder es quien activa los 30 minutos.",
  "Materiales: hojas, cinta y un marcador. Un avión por equipo para la medición final.",
  "El Product Owner decide si un vuelo cuenta. QA mide. El Scrum Master vigila el tiempo.",
  "Gana el avión que vuele más lejos en el lanzamiento oficial al terminar el reloj.",
];

export const AVION_PUNTAJE = [
  { lugar: 1, etiqueta: "1° · el que vuela más lejos", puntos: 1000 },
  { lugar: 2, etiqueta: "2° · segundo más lejos", puntos: 800 },
  { lugar: 3, etiqueta: "3° · tercero", puntos: 650 },
  { lugar: 4, etiqueta: "4° · cuarto", puntos: 500 },
  { lugar: 5, etiqueta: "5° · quinto", puntos: 350 },
  { lugar: 6, etiqueta: "6° · el más corto", puntos: 200 },
] as const;

export function remainingSeconds(
  startedAt: string | null | undefined,
  minutes = AVION_MINUTOS,
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
