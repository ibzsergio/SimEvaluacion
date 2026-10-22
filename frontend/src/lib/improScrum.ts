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

export const IMPRO_MEDIDA = "30 cm de ancho por 30 cm de alto";

export const IMPRO_PRODUCTO =
  "Un pop-up de programación: muestra una parte de SU programa (una pantalla, una función o lo que el programa hace). Mide mínimo 30 cm de ancho por 30 cm de alto y se para solo. Al abrirlo, alguien de otro equipo entiende en 60 segundos esa parte del programa. Algo se mueve: una pestaña, una puerta o una tira que se jala.";

export const IMPRO_PRODUCTO_NO =
  "No es un cartel pegado en la mesa. No es un dibujo ajeno al programa. Si mide menos de 30 × 30 cm, si no se para o si nada se mueve, no cuenta.";

export const IMPRO_PRODUCTO_DEBE = [
  "Enfocado en programación: una pantalla, una función o lo que hace su programa",
  "Mínimo 30 cm de ancho y 30 cm de alto",
  "Nombre del programa, grande, que se lea de lejos",
  "Una sola frase: «El programa logra ___»",
  "Una pieza que se mueva al jalar o al abrir",
  "Que se sostenga sin que nadie lo detenga con la mano",
];

export const IMPRO_MATERIALES = [
  "Lo que ya tienen: hojas de color, pegamento, diurex y tijeras",
  "En cuanto inicie el reloj pueden salir a buscar más: cartón, palos de madera, unicel y lo que haga falta para llegar a 30 × 30 cm",
];

export const IMPRO_PROHIBIDO = [
  "Un pop-up que no explique una parte de su programa",
  "Un pop-up más chico de 30 cm de ancho o de 30 cm de alto",
  "Un dibujo plano que no se pare",
  "Seguir armando cuando el reloj llega a 00:00",
  "Hablar en el tramo de silencio o durante la prueba de 60 segundos",
];

export const IMPRO_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Elige una sola parte del programa y escribe «El programa logra ___». Si el pop-up enseña otra cosa, la recorta.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Activa el reloj. En ese momento el equipo ya puede salir por material. Anuncia los cortes (12, 22, 42 y 50), hace cumplir el silencio y también construye.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Arma la estructura de al menos 30 × 30 cm con el cartón, los palos o el unicel que traigan, y la pieza que se mueve. No lo arma solo.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "El nombre del programa se lee de lejos. La pantalla, la función o el flujo se entiende con la forma, no con un párrafo.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Mide ancho y alto. Si no llega a 30 × 30 cm, no cumple. Invita a alguien de otro equipo y anota si entendió esa parte del programa en 60 segundos.",
  },
] as const;

export const IMPRO_SPRINTS = [
  {
    id: "busqueda",
    nombre: "Acto 1 — A buscar",
    desde: 0,
    hasta: 12,
    detalle:
      "El líder activa los 50 minutos. En ese instante ya pueden salir a buscar cartón, palos de madera, unicel y lo que haga falta. El pop-up es de programación y medirá mínimo 30 cm de ancho por 30 cm de alto. El Product Owner escribe qué parte del programa van a mostrar: «El programa logra ___».",
  },
  {
    id: "silencio",
    nombre: "Acto 2 — Silencio",
    desde: 12,
    hasta: 22,
    detalle:
      "De vuelta en el salón, nadie habla. Armen la estructura de 30 × 30. Si alguien habla, el Scrum Master lo corta.",
  },
  {
    id: "ensamble",
    nombre: "Acto 3 — El armado",
    desde: 22,
    hasta: 42,
    detalle:
      "Ya pueden hablar. Peguen hojas, cartón, palos y unicel. Tiene que mostrar una parte del programa, pararse, medir al menos 30 × 30 cm y tener una pieza que se mueva. Ensayen los 60 segundos.",
  },
  {
    id: "release",
    nombre: "Acto 4 — El estreno",
    desde: 42,
    hasta: 50,
    detalle:
      "QA mide ancho y alto. Inviten a una persona de otro equipo: abre el pop-up y entiende esa parte del programa. Ustedes no explican. A los 50, manos arriba.",
  },
] as const;

export const IMPRO_PASOS = [
  "Son los equipos de Roles / Equipos, los mismos del proyecto. No se arman equipos nuevos.",
  "El pop-up está enfocado en programación: una pantalla, una función o lo que hace su programa.",
  "El líder del proyecto activa los 50 minutos. El docente también puede arrancar el reloj de todos.",
  "En cuanto inicie el tiempo, pueden salir a buscar cartón, palos de madera, unicel y lo que necesiten.",
  "El pop-up mide como mínimo 30 cm de ancho por 30 cm de alto.",
  "Del minuto 12 al 22 trabajan en silencio. Se comunican por escrito.",
  "Alguien de otro equipo lo opera en 60 segundos, sin explicación.",
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
  { code: "medida", label: "No llega a 30 × 30 cm", points: 200, scope: "team" },
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
