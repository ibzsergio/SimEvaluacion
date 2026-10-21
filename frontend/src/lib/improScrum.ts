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
export const IMPRO_TITULO = "Sprint improvisado";
export const IMPRO_PROGRAMA = "Actividad Scrum";
export const IMPRO_FIRMAS_MAX = 1000;
export const IMPRO_ACTIVITY_NAME = "Sprint improvisado";

export const IMPRO_PRODUCTO =
  "Un puesto de mesa que se sostiene solo. Alguien de otro equipo lo opera en 60 segundos, sin que ustedes hablen, y entiende el caso de uso más importante de SU aplicación.";

export const IMPRO_PRODUCTO_NO =
  "No es un dibujo en una hoja. No es toda la app ni otra app. No vale un kit armado en casa. Tiene que ser un objeto que se toca.";

export const IMPRO_PRODUCTO_DEBE = [
  "Nombre del proyecto, legible a unos 2 metros",
  "Una sola frase: «El usuario logra ___»",
  "Una pieza que se mueva (pestaña, ficha, ventana o palanca)",
  "Que se sostenga sin que nadie lo detenga con la mano",
  "Al menos 4 materiales improvisados distintos",
];

export const IMPRO_MATERIALES = [
  "Hojas, folders o páginas de cuaderno",
  "Plumas, lápices o marcadores",
  "Clips, ligas o cinta que alguien ya traiga",
  "Botellas, tapas, cajas o envases",
  "Libretas o reglas como estructura",
  "Cartón o bolsas que ya estén en el salón",
];

export const IMPRO_PROHIBIDO = [
  "Salir del salón a comprar o a pedir material",
  "Traer piezas ya recortadas o armadas de casa",
  "Seguir construyendo cuando el reloj llega a 00:00",
  "Hablar en el sprint de silencio o durante la prueba de 60 segundos",
];

export const IMPRO_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Escribe la frase «El usuario logra ___». Si el puesto enseña otra cosa, la recorta. Un solo caso de uso.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Activa el reloj y anuncia los cortes (5, 12, 22, 42 y 50). Hace cumplir el silencio y que nadie se quede mirando. También construye.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Arma la estructura que se sostiene y la pieza que se mueve. Reparte cortes y pegado: no lo arma solo.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "El nombre se lee de lejos. Se entiende con la forma, no con un párrafo. Cuida que se vea producto y no montón.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Anota la lista de materiales, invita a alguien de otro equipo y escribe qué logró operar en 60 segundos y qué no entendió.",
  },
] as const;

export const IMPRO_SPRINTS = [
  {
    id: "arranque",
    nombre: "Sprint 0 — Arranque",
    desde: 0,
    hasta: 5,
    detalle:
      "Elijan líder. El líder activa los 50 minutos. El Product Owner escribe en una tira: «El usuario logra ___». Un solo caso de uso de SU proyecto.",
  },
  {
    id: "caceria",
    nombre: "Sprint 1 — Cacería",
    desde: 5,
    hasta: 12,
    detalle:
      "Reúnan materiales improvisados sin salir del salón. Al minuto 12 se cierra la pila: lo que no esté en la mesa no se usa. QA anota la lista. Mínimo 4 materiales distintos.",
  },
  {
    id: "silencio",
    nombre: "Sprint 2 — Silencio",
    desde: 12,
    hasta: 22,
    detalle:
      "Nadie habla. Solo notas y gestos. Cada rol construye su parte. Si alguien habla, el Scrum Master lo corta.",
  },
  {
    id: "ensamble",
    nombre: "Sprint 3 — Ensamble",
    desde: 22,
    hasta: 42,
    detalle:
      "Ya pueden hablar. Unan el puesto: tiene que sostenerse solo y tener una pieza que se mueva. Ensayen la operación de 60 segundos.",
  },
  {
    id: "release",
    nombre: "Sprint 4 — Release",
    desde: 42,
    hasta: 50,
    detalle:
      "Inviten a una persona de otro equipo. Esa persona opera el puesto. Ustedes no explican. QA anota qué logró y qué no entendió. A los 50, manos arriba.",
  },
] as const;

export const IMPRO_PASOS = [
  "Son los equipos de Roles / Equipos, los mismos del proyecto. No se mezclan con otro equipo.",
  "Lean esto antes de construir. El líder es quien activa los 50 minutos.",
  "Elijan un solo caso de uso. Si intentan mostrar toda la app, el puesto no cumple.",
  "Del minuto 12 al 22 trabajan en silencio. La comunicación es escrita.",
  "El producto se entrega cuando alguien de otro equipo lo opera en 60 segundos sin explicación.",
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
  { code: "no_improvisado", label: "Material no improvisado", points: 200, scope: "team" },
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
