export const MAQUINA_MINUTOS = 50;
export const MAQUINA_TITULO = "La máquina";
export const MAQUINA_PROGRAMA = "Actividad Scrum";
export const MAQUINA_FIRMAS_MAX = 1000;
export const MAQUINA_ACTIVITY_NAME = "La máquina";

export const MAQUINA_PRODUCTO =
  "Una máquina de cartón, palos y unicel, de por lo menos 40 cm de largo. Tiene boca de entrada y boca de salida. Meten una ficha (tapadera, bola de papel o canica) y ella sola recorre 3 estaciones de SU programa. En cada estación algo cambia: cae, gira o se desvía. Al frente, en grande: «Entra ___ y sale ___».";

export const MAQUINA_PRODUCTO_NO =
  "No es un cartel. No es un pop-up. Si alguien empuja la ficha en la prueba oficial, esa corrida no cuenta.";

export const MAQUINA_PRODUCTO_DEBE = [
  "Por lo menos 40 cm de largo",
  "Boca de entrada y boca de salida",
  "3 estaciones con nombre real de su programa",
  "La ficha viaja sola, sin que la empujen",
  "La frase «Entra ___ y sale ___» se lee de lejos",
];

export const MAQUINA_MATERIALES = [
  "Lo que ya tienen: hojas de color, pegamento, diurex y tijeras",
  "En cuanto inicie el reloj pueden salir por cartón, palos de madera y unicel",
  "Una ficha: tapadera, bola de papel o canica",
];

export const MAQUINA_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Escribe las 3 estaciones reales del programa y la frase «Entra ___ y sale ___».",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Cuida el reloj, avisa los cortes y hace cumplir el silencio de las dos corridas oficiales.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Arma el recorrido para que la ficha avance sola de la entrada a la salida.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "Deja la frase y el nombre de cada estación legibles de lejos.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Hace las dos corridas oficiales y anota si la ficha llegó sola y si el otro equipo entendió el programa.",
  },
] as const;

export const MAQUINA_SPRINTS = [
  {
    id: "diseno",
    nombre: "Acto 1 — El recorrido",
    desde: 0,
    hasta: 8,
    detalle: "Eligen la ficha y las 3 estaciones reales del programa. Dibujan el camino de la entrada a la salida.",
  },
  {
    id: "obra",
    nombre: "Acto 2 — La construyen",
    desde: 8,
    hasta: 30,
    detalle: "La arman. En este tramo pueden salir por cartón, palos de madera y unicel.",
  },
  {
    id: "prueba",
    nombre: "Acto 3 — Tres pruebas",
    desde: 30,
    hasta: 42,
    detalle: "La prueban tres veces. Si la ficha se atora, corrigen el recorrido.",
  },
  {
    id: "oficial",
    nombre: "Acto 4 — Dos corridas",
    desde: 42,
    hasta: 50,
    detalle:
      "Silencio. Dos corridas oficiales frente a otro equipo. Ese equipo dice, en una frase, qué hace el programa. A los 50, manos arriba.",
  },
] as const;

export const MAQUINA_PASOS = [
  "Son los equipos de Roles / Equipos. No se arman equipos nuevos.",
  "Construyen una máquina de su programa, no un cartel ni un pop-up.",
  "El docente libera la actividad e inicia los 50 minutos de todo el grupo.",
  "Al iniciar el reloj pueden salir por cartón, palos de madera y unicel.",
  "La ficha tiene que viajar sola. En la prueba oficial nadie la empuja.",
  "Otro equipo mira una corrida y explica el programa en una frase.",
  "Parte de 1000 Firmas. Cada nota del docente resta.",
];

export type MaquinaNotePreset = {
  code: string;
  label: string;
  points: number;
};

export const MAQUINA_NOTAS: MaquinaNotePreset[] = [
  { code: "estaciones", label: "Estaciones o frase no sirven", points: 250 },
  { code: "sola", label: "La ficha no viaja sola", points: 250 },
  { code: "salida", label: "No llega en las dos corridas", points: 250 },
  { code: "explica", label: "El otro equipo no lo explica", points: 250 },
];

export function maquinaRoleLabel(role?: string | null) {
  if (!role) return "";
  return MAQUINA_ROLES.find((item) => item.id === role)?.label ?? role;
}

export function maquinaRoleTask(role?: string | null) {
  return MAQUINA_ROLES.find((item) => item.id === role)?.tarea ?? "Construye con el equipo. Nadie se queda mirando.";
}

export function remainingSeconds(
  startedAt: string | null | undefined,
  minutes = MAQUINA_MINUTOS,
  pausedAt?: string | null,
) {
  if (!startedAt) return minutes * 60;
  const frozenAt = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((frozenAt - new Date(startedAt).getTime()) / 1000));
  return Math.max(0, minutes * 60 - elapsed);
}

export function elapsedSeconds(
  startedAt: string | null | undefined,
  minutes = MAQUINA_MINUTOS,
  pausedAt?: string | null,
) {
  return Math.max(0, minutes * 60 - remainingSeconds(startedAt, minutes, pausedAt));
}

export function maquinaSprintAt(totalElapsedSeconds: number) {
  const minute = totalElapsedSeconds / 60;
  return (
    MAQUINA_SPRINTS.find((sprint) => minute >= sprint.desde && minute < sprint.hasta) ??
    MAQUINA_SPRINTS[MAQUINA_SPRINTS.length - 1]!
  );
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
