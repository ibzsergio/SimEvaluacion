export const AVION_MINUTOS = 30;
export const AVION_TITULO = "Sprint aéreo";
export const AVION_PROGRAMA = "Actividad Scrum";
export const AVION_PUNTOS_MAX = 1000;

export const AVION_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Escribe en una hoja la Definition of Done: vuelo válido, línea de lanzamiento, cómo se mide y qué descalifica. Prioriza distancia, no adornos.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Parte los 30 minutos en sprints, anuncia el tiempo y quita bloqueos. No construye el avión por los demás.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Arma el prototipo mezclando materiales. Cada cambio sale de una hipótesis de QA, no de ocurrencias.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "Nombre del avión, marcas de equipo y un flap o timón recortado. La identidad no puede romper el vuelo.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Bitácora de 3 vuelos de prueba: hipótesis, material que movieron, distancia y qué falló. Mide el lanzamiento oficial.",
  },
] as const;

export const AVION_MATERIALES = [
  "Hojas bond (varias)",
  "Cartulina o cartón delgado",
  "Popotes",
  "Palitos de madera (paleta)",
  "Clips",
  "Cinta adhesiva",
  "Ligas",
  "Plastilina o un peso chico (lastre)",
  "Marcadores",
  "Tijeras y regla",
];

export const AVION_REQUISITOS = [
  "No vale un avión de solo hoja doblada: tienen que combinar al menos 3 materiales de la lista.",
  "Debe llevar lastre movible (clip o plastilina) para experimentar el centro de gravedad.",
  "Debe tener una superficie de control recortada (flap, alerón o timón) que puedan doblar entre pruebas.",
  "El avión lleva nombre de prototipo escrito y visible.",
  "QA entrega la bitácora de 3 pruebas; sin bitácora no entran a la medición oficial.",
];

export const AVION_SPRINTS = [
  {
    nivel: 1,
    nombre: "Sprint 0 — Definition of Done",
    detalle: "Acuerden qué vuelo cuenta, la línea de lanzamiento y cómo miden. El PO lo escribe. Nadie construye todavía.",
  },
  {
    nivel: 2,
    nombre: "Sprint 1 — prototipo mixto",
    detalle: "Primer modelo con papel + al menos otros dos materiales. Que vuele, aunque sea feo.",
  },
  {
    nivel: 3,
    nombre: "Sprint 2 — lastre y flap",
    detalle: "Prueban mover el peso y el flap. Un cambio por vuelo. QA anota hipótesis y distancia.",
  },
  {
    nivel: 4,
    nombre: "Sprint 3 — release",
    detalle: "Un solo avión final, nombre visible, bitácora lista. Ese es el que miden al acabar el reloj.",
  },
] as const;

export const AVION_PASOS = [
  "Lean estas instrucciones en equipo. No empiecen a construir hasta que el líder active el reloj.",
  "Cada integrante toma un rol Scrum (el de la encuesta, o el que les falte en el equipo).",
  "Elijan un líder. Cualquiera puede marcarlo; el líder es quien activa los 30 minutos.",
  "Planeen 1 minuto: forma del ala, dónde va el lastre y qué material refuerza el fuselaje. Luego construyan.",
  "El Product Owner decide si un vuelo cuenta. QA mide y llena la bitácora. El Scrum Master vigila el tiempo.",
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
