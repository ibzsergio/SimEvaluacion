const ROLE_SHORT: Record<string, string> = {
  scrum_master: "Scrum Master",
  product_owner: "Product Owner",
  developer: "Desarrollador",
  ui_designer: "Diseño / UI",
  qa_docs: "QA / Docs",
};

export function extraRoleLabel(role?: string | null) {
  if (!role) return "";
  return ROLE_SHORT[role] ?? role;
}

export const EXTRA_MINUTOS = 0;
export const EXTRA_TITULO = "Plan de Acción Proyecto";
export const EXTRA_PROGRAMA = "Paso 3 · Interfaces";
export const EXTRA_FIRMAS_MAX = 3000;
export const EXTRA_PUNTOS_MAX = EXTRA_FIRMAS_MAX;
export const EXTRA_ACTIVITY_NAME = "Plan de Acción Proyecto";

export const EXTRA_PASOS_PREVIOS = [
  { n: 1, titulo: "Análisis de requerimientos", detalle: "Ya lo entregaron: qué hace el sistema, para quién y qué no entra." },
  { n: 2, titulo: "Diagramas y cronograma", detalle: "Ya lo entregaron: clases, casos de uso y el calendario del equipo." },
  { n: 3, titulo: "Interfaces (hoy)", detalle: "Con el material armán las pantallas de papel de SU aplicación Tkinter." },
];

export const EXTRA_PRODUCTO =
  "Las interfaces de SU proyecto: ventanas de escritorio en Python + Tkinter (botones, cajas, menús) que ya definieron en requerimientos y diagramas. Una cartulina por pantalla principal; si hay más, las pegan como un flujo.";

export const EXTRA_PRODUCTO_NO =
  "No inventen otra app. No es un anuncio genérico ni una app de celular. Es la interfaz del sistema que ya están diseñando.";

export const EXTRA_PRODUCTO_DEBE = [
  "Nombre de la app (el de su proyecto)",
  "Pantalla principal: qué ve el usuario al abrir",
  "Controles reales (botones, cajas, listas) según sus casos de uso",
  "Flujo: de qué ventana se pasa a cuál",
];

export const EXTRA_MATERIALES = [
  "Cartulina (la ventana / pantalla)",
  "Hojas de color (botones, zonas, menús)",
  "Pegamento y diurex",
  "Periódico y/o revistas para recortar íconos y texturas",
];

export type ExtraNotePreset = {
  code: string;
  label: string;
  points: number;
  scope: "team" | "member";
};

export const EXTRA_NOTAS: ExtraNotePreset[] = [
  { code: "ruido", label: "Mucho ruido", points: 400, scope: "team" },
  { code: "no_trabaja", label: "No trabaja el equipo", points: 800, scope: "team" },
  { code: "otro_equipo", label: "Integrante en otro equipo", points: 500, scope: "member" },
  { code: "sin_material", label: "No trajo material", points: 400, scope: "member" },
  { code: "fuera_tiempo", label: "Entrega fuera de tiempo", points: 600, scope: "team" },
];

export const EXTRA_SECCIONES = [
  {
    id: "po",
    rol: "Product Owner",
    titulo: "Qué pantalla y para quién",
    detalle: "Nombra la ventana y el caso de uso. Que se lea desde lejos.",
  },
  {
    id: "ui",
    rol: "Diseño / UI",
    titulo: "La ventana en papel",
    detalle: "Marco, zonas, botones y cajas con recortes y hojas de color. Que se vea interfaz, no recado.",
  },
  {
    id: "dev",
    rol: "Desarrollador",
    titulo: "Cómo responde",
    detalle: "3 viñetas: qué elige o escribe el usuario, qué hace el programa, qué muestra después.",
  },
  {
    id: "qa",
    rol: "QA / Docs",
    titulo: "Revisión",
    detalle: "Que no falte un control de sus casos de uso. Créditos del equipo. Que no se despegue.",
  },
  {
    id: "sm",
    rol: "Scrum Master",
    titulo: "Cierre a tiempo",
    detalle: "Reparte zonas y que todos peguen. Coordina al equipo.",
  },
  {
    id: "sexto",
    rol: "Sexto integrante (si hay)",
    titulo: "Pantalla extra o flujo",
    detalle: "Segunda ventana o flechas de navegación. Ayuda a que el prototipo se entienda.",
  },
] as const;

export const EXTRA_PASOS = [
  "301 y 302: equipos de proyecto de Roles / Equipos (el mismo del análisis y los diagramas).",
  "Armen en cartulina las interfaces de SU app Tkinter: pantalla principal y, si cabe, el flujo a otra ventana.",
  "Tienen que verse: nombre de la app, controles, 3 funciones y créditos.",
  "Las pantallas se tienen que sostener solas (que no se desarmen).",
  "Vale 3000 Firmas. El docente anota en vivo; cada nota baja ese valor.",
];

export function extraNotePreset(code: string) {
  return EXTRA_NOTAS.find((n) => n.code === code) ?? null;
}

export function extraMemberFirmas(
  notes: Array<{ points: number; studentId?: string | null }>,
  studentId: string,
  max = EXTRA_FIRMAS_MAX,
) {
  const cut = notes
    .filter((n) => !n.studentId || n.studentId === studentId)
    .reduce((acc, n) => acc + Math.max(0, n.points), 0);
  return Math.max(0, max - cut);
}

export function remainingSeconds(
  startedAt: string | null | undefined,
  minutes = EXTRA_MINUTOS,
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
