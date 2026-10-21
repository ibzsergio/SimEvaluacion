const ROLE_SHORT: Record<string, string> = {
  scrum_master: "Scrum Master",
  product_owner: "Product Owner",
  developer: "Desarrollador",
  ui_designer: "Diseño / UI",
  qa_docs: "QA / Docs",
};

export function improRoleLabel(role?: string | null) {
  if (!role) return "";
  return ROLE_SHORT[role] ?? role;
}

export const IMPRO_MINUTOS = 50;
export const IMPRO_TITULO = "Pop-Up";
export const IMPRO_PROGRAMA = "Actividad Scrum";
export const IMPRO_FIRMAS_MAX = 1000;
export const IMPRO_ACTIVITY_NAME = "Pop-Up";

export const IMPRO_PRODUCTO =
  "Un pop-up de su proyecto que se para solo. Al abrirlo, alguien de otro equipo entiende en 60 segundos el caso de uso más importante de SU aplicación. Algo se mueve: una pestaña, una puerta o una tira que se jala.";

export const IMPRO_PRODUCTO_NO =
  "No es un cartel pegado en la mesa. No es toda la app ni otra app. Si no se para y nada se mueve, no cuenta.";

export const IMPRO_PRODUCTO_DEBE = [
  "Nombre del proyecto, grande, que se lea de lejos",
  "Una sola frase: «El usuario logra ___»",
  "Una pieza de papel que se mueva al jalar o al abrir",
  "Que se sostenga sin que nadie lo detenga con la mano",
  "Solo hojas de color, pegamento, diurex y tijeras",
];

export const IMPRO_MATERIALES = [
  "Hojas de color",
  "Pegamento",
  "Diurex",
  "Tijeras",
];

export const IMPRO_PROHIBIDO = [
  "Botellas, palitos, cartón, revistas u otro material fuera de la lista",
  "Un dibujo plano que no se pare",
  "Seguir armando cuando el reloj llega a 00:00",
  "Hablar en el tramo de silencio o durante la prueba de 60 segundos",
];

export const IMPRO_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Escribe la frase «El usuario logra ___». Si el pop-up enseña otra cosa, la recorta. Un solo caso de uso.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Activa el reloj y anuncia los cortes (5, 12, 22, 42 y 50). Hace cumplir el silencio y que nadie se quede mirando. También corta y pega.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Diseña el pliegue que lo para y la pieza que se mueve. Reparte cortes y pegado: no lo arma solo.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "El nombre se lee de lejos. El caso de uso se entiende con colores y forma, no con un párrafo.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Revisa que solo usen el material pedido, invita a alguien de otro equipo y anota qué logró hacer en 60 segundos.",
  },
] as const;

export const IMPRO_SPRINTS = [
  {
    id: "arranque",
    nombre: "Acto 1 — El gancho",
    desde: 0,
    hasta: 5,
    detalle:
      "Elijan líder. El líder activa los 50 minutos. El Product Owner escribe: «El usuario logra ___». Acuerden qué pieza de papel se va a mover.",
  },
  {
    id: "corte",
    nombre: "Acto 2 — El corte",
    desde: 5,
    hasta: 12,
    detalle:
      "Recorten todas las piezas con las hojas de color. Al minuto 12 se cierran las tijeras: ya no salen piezas nuevas, solo se pega.",
  },
  {
    id: "silencio",
    nombre: "Acto 3 — Silencio",
    desde: 12,
    hasta: 22,
    detalle:
      "Nadie habla. Solo notas y gestos. Cada rol arma su parte. Si alguien habla, el Scrum Master lo corta.",
  },
  {
    id: "ensamble",
    nombre: "Acto 4 — El armado",
    desde: 22,
    hasta: 42,
    detalle:
      "Ya pueden hablar. Peguen con pegamento y diurex. El pop-up tiene que pararse solo y la pieza tiene que moverse. Ensayen los 60 segundos.",
  },
  {
    id: "release",
    nombre: "Acto 5 — El estreno",
    desde: 42,
    hasta: 50,
    detalle:
      "Inviten a una persona de otro equipo. Esa persona abre el pop-up y lo opera. Ustedes no explican. QA anota qué entendió. A los 50, manos arriba.",
  },
] as const;

export const IMPRO_PASOS = [
  "Son los equipos de Roles / Equipos, los mismos del proyecto.",
  "Lean esto antes de cortar. El líder es quien activa los 50 minutos.",
  "Elijan un solo caso de uso de SU aplicación. Si intentan mostrar toda la app, no cumple.",
  "Del minuto 12 al 22 trabajan en silencio. Se comunican por escrito.",
  "El estreno es cuando alguien de otro equipo lo opera en 60 segundos, sin explicación.",
  "Parte de 1000 Firmas. El docente anota en vivo; cada nota baja ese valor.",
];

export type ImproNotePreset = {
  code: string;
  label: string;
  points: number;
  scope: "team" | "member";
};

export const IMPRO_NOTAS: ImproNotePreset[] = [
  { code: "ruido", label: "Mucho ruido", points: 100, scope: "team" },
  { code: "no_trabaja", label: "No trabaja el equipo", points: 200, scope: "team" },
  { code: "fuera_equipo", label: "Integrante fuera del equipo", points: 150, scope: "member" },
  { code: "plano", label: "Quedó en cartel plano", points: 200, scope: "team" },
  { code: "fuera_tiempo", label: "Siguen después del tiempo", points: 150, scope: "team" },
  { code: "no_opera", label: "El extraño no pudo operarlo", points: 150, scope: "team" },
];

export function improRoleTask(role?: string | null) {
  return IMPRO_ROLES.find((item) => item.id === role)?.tarea ?? "Construye con el equipo. Nadie se queda mirando.";
}

export function remainingSeconds(
  startedAt: string | null | undefined,
  minutes = IMPRO_MINUTOS,
  pausedAt?: string | null,
) {
  if (!startedAt) return minutes * 60;
  const frozenAt = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((frozenAt - new Date(startedAt).getTime()) / 1000));
  return Math.max(0, minutes * 60 - elapsed);
}

export function elapsedSeconds(
  startedAt: string | null | undefined,
  minutes = IMPRO_MINUTOS,
  pausedAt?: string | null,
) {
  return Math.max(0, minutes * 60 - remainingSeconds(startedAt, minutes, pausedAt));
}

export function improSprintAt(totalElapsedSeconds: number) {
  const minute = totalElapsedSeconds / 60;
  return (
    IMPRO_SPRINTS.find((sprint) => minute >= sprint.desde && minute < sprint.hasta) ??
    IMPRO_SPRINTS[IMPRO_SPRINTS.length - 1]!
  );
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
