export const AVION_MINUTOS = 45;
export const AVION_TITULO = "Sprint aéreo";
export const AVION_PROGRAMA = "Actividad Scrum";
export const AVION_PUNTOS_MAX = 1000;

export const AVION_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Escribe la Definition of Done: vuelo válido, que no se desarme, nombre del equipo visible, diseño y distancia. Prioriza un avión que vuele y llegue entero.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Parte los 45 minutos, anuncia el tiempo y quita bloqueos. También construye: si solo trabaja una persona, no les va a alcanzar.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Coordina el armado (estructura, alas, encuadre). No arma solo: reparte cortes, pegado y ensamble entre todos.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "El equipo elige un nombre y lo pinta en el avión. Cuida forma, color y creatividad: también se califican.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Llena la tabla de 3 pruebas con todos los parámetros. Sin tabla completa no hay medición oficial.",
  },
] as const;

export const AVION_MATERIALES = [
  "Papel cascarón o papel ilustración (obligatorio)",
  "Palillos",
  "Palos de paleta",
  "Silicón frío",
  "Cinta adhesiva (refuerzo)",
  "Clips o lastre chico",
  "Marcadores",
  "Tijeras y regla",
];

export const AVION_REQUISITOS = [
  "Usen varios materiales que den vuelo y distancia: cascarón o ilustración para alas, palillos y palos de paleta para estructura, silicón frío para que no se desarme.",
  "El avión debe llegar entero: si se desarma al lanzar o al aterrizar, no cuenta.",
  "Debe llevar el nombre del equipo, visible. El equipo elige un nombre (no dejen “sin nombre”).",
  "También se califican diseño y creatividad (forma, acabado, identidad), no solo la distancia.",
  "Un avión de papel doblado no es válido. Sin la tabla de QA no entran a la medición oficial.",
];

export const AVION_SPRINTS = [
  {
    nivel: 1,
    nombre: "Sprint 0 — plan y nombre",
    detalle: "Elijan el nombre del equipo. Acuerden DoD, quién corta, quién pega y quién arma alas. Todos construyen.",
  },
  {
    nivel: 2,
    nombre: "Sprint 1 — estructura",
    detalle: "Fuselaje con palos de paleta y palillos. Alas de cascarón o ilustración. Silicón frío. Que no se mueva.",
  },
  {
    nivel: 3,
    nombre: "Sprint 2 — pruebas QA",
    detalle: "Tres lanzamientos. QA llena la tabla (distancia, resistencia, estabilidad). Un ajuste por prueba, entre todos.",
  },
  {
    nivel: 4,
    nombre: "Sprint 3 — release",
    detalle: "Avión final con nombre visible, entero y con bitácora completa. Ese entra a la medición oficial.",
  },
] as const;

export const AVION_PASOS = [
  "Lean estas instrucciones en equipo. No empiecen a construir hasta que el líder active el reloj.",
  "Cada integrante toma un rol Scrum, pero todos construyen. Si dejan el avión a una sola persona, no les dará tiempo.",
  "Elijan un líder. Cualquiera puede marcarlo; el líder es quien activa los 45 minutos.",
  "Elijan un nombre de equipo y escríbanlo en el avión.",
  "El Product Owner decide si un vuelo cuenta. QA llena la tabla. El Scrum Master vigila el tiempo y también pega o corta.",
  "Se califica distancia, que no se desarme, el nombre visible y el diseño. Gana el mejor vuelo oficial al terminar el reloj.",
];

export const AVION_QA_PARAMETROS = [
  "Nombre del equipo (el que eligieron).",
  "Nombres de todos los integrantes.",
  "Quién lanzó cada prueba.",
  "Distancia en metros (cinta o pasos medidos desde la línea).",
  "Resistencia: ¿se desarmó? ¿se aflojó un ala, un palo o el silicón?",
  "Estabilidad: recto, giro, picada o pérdida de altura.",
  "Cambio que hicieron después de esa prueba (un solo cambio).",
];

export const AVION_QA_COLUMNAS = [
  "Prueba",
  "Quién lanzó",
  "Distancia (m)",
  "¿Se desarmó?",
  "Estabilidad",
  "Cambio para la siguiente",
] as const;

export const AVION_QA_FILAS = ["1", "2", "3", "Oficial"] as const;

export const AVION_PUNTAJE = [
  { lugar: 1, etiqueta: "1° · el que vuela más lejos", puntos: 1000 },
  { lugar: 2, etiqueta: "2° · segundo más lejos", puntos: 800 },
  { lugar: 3, etiqueta: "3° · tercero", puntos: 650 },
  { lugar: 4, etiqueta: "4° · cuarto", puntos: 500 },
  { lugar: 5, etiqueta: "5° · quinto", puntos: 350 },
  { lugar: 6, etiqueta: "6° · el más corto", puntos: 200 },
] as const;

export const AVION_CRITERIOS = [
  { criterio: "Distancia del vuelo oficial", peso: "Principal" },
  { criterio: "Resistencia (no se desarma)", peso: "Obligatorio" },
  { criterio: "Nombre del equipo visible", peso: "Obligatorio" },
  { criterio: "Diseño y creatividad", peso: "Cuenta" },
  { criterio: "Tabla de QA completa", peso: "Obligatorio" },
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
