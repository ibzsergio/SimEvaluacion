export const MAQUINA_MINUTOS = 50;
export const MAQUINA_TITULO = "La máquina";
export const MAQUINA_PROGRAMA = "Actividad Scrum";
export const MAQUINA_FIRMAS_MAX = 1000;
export const MAQUINA_ACTIVITY_NAME = "La máquina";

export const MAQUINA_PRODUCTO =
  "Una máquina de cartón, palos y unicel, con la entrada y la salida como en las fotos. Cada etapa del proyecto es un obstáculo. La ficha, canica, moneda o pelota lo recorre sola.";

export const MAQUINA_PRODUCTO_NO =
  "No es un cartel ni un pop-up: la pieza recorre los obstáculos de verdad. Si en una corrida oficial alguien la empuja, sopla o la guía, esa corrida no cuenta.";

export const MAQUINA_PRODUCTO_DEBE = [
  "Base de cartón de al menos 40 cm, de boca a boca. Si los 12 obstáculos no se leen de lejos, la alargan.",
  "Entrada como en la foto: boca redonda y flecha verde con el letrero ENTRADA. Por esa boca sueltan la pieza, sin empujarla.",
  "Cada etapa del proyecto es un obstáculo en el camino: rampa, curva, arco, pared o hueco. Van en orden, del 1 al 12, y el letrero lleva el nombre de esa etapa.",
  "La ficha, canica, moneda o pelota pasa sola los 12 obstáculos. En cada uno cambia de camino: cae, gira o se desvía.",
  "Salida como en la foto: boca redonda y flecha roja con el letrero SALIDA. La pieza sale por esa boca y se detiene sola.",
  "Al frente, letras grandes que se leen desde el otro lado del salón: «Entra ___ y sale ___». Los huecos son lo que entra y lo que sale en su programa.",
  "La misma pieza en todas las pruebas: una ficha, una canica, una moneda o una pelota. Tiene que caber en las dos bocas.",
];

export const MAQUINA_MATERIALES = [
  "Ya en la mesa: hojas de color para ENTRADA, las 12 etapas, SALIDA y la frase, pegamento, diurex y tijeras.",
  "Al iniciar el reloj pueden salir una sola vez por cartón (base, bocas y paredes), palos de madera (rieles y rampas) y unicel (curvas, arcos y obstáculos).",
  "Una sola pieza, elegida antes de armar: ficha, canica, moneda o pelota. Esa misma se usa en las tres pruebas y en las dos corridas oficiales.",
];

export const MAQUINA_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Escribe las 12 etapas en el orden del proyecto, con el nombre que ya usan, y llena «Entra ___ y sale ___».",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Avisa los cortes de los minutos 8, 30, 42 y 50. En las dos corridas oficiales nadie toca la pieza.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Arma la entrada y la salida como en las fotos. Cada etapa es un obstáculo que la pieza cruza sola.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "Corta la flecha verde ENTRADA, el nombre de las 12 etapas, la flecha roja SALIDA y la frase. Se leen desde el otro lado del salón.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Elige ficha, canica, moneda o pelota y comprueba que cabe en las dos bocas. Revisa que cada etapa sea un obstáculo. Hace las tres pruebas y las dos corridas.",
  },
] as const;

export const MAQUINA_SPRINTS = [
  {
    id: "diseno",
    nombre: "Acto 1 — El recorrido",
    desde: 0,
    hasta: 8,
    detalle:
      "Escriben las 12 etapas en orden y qué obstáculo será cada una. Completan «Entra ___ y sale ___». Dibujan la boca de entrada y la de salida como en las fotos. Eligen ficha, canica, moneda o pelota.",
  },
  {
    id: "obra",
    nombre: "Acto 2 — La construyen",
    desde: 8,
    hasta: 30,
    detalle:
      "Salen una vez por cartón, palos y unicel. Arman las dos bocas como en las fotos y un obstáculo por etapa. Pegan ENTRADA, los 12 nombres, SALIDA y la frase.",
  },
  {
    id: "prueba",
    nombre: "Acto 3 — Tres pruebas",
    desde: 30,
    hasta: 42,
    detalle:
      "Sueltan la pieza tres veces en la boca de ENTRADA, sin tocarla. Tiene que cruzar los 12 obstáculos y salir por la boca de SALIDA. Si se atora, corrigen ese obstáculo.",
  },
  {
    id: "oficial",
    nombre: "Acto 4 — Dos corridas",
    desde: 42,
    hasta: 50,
    detalle:
      "Silencio. Dos corridas frente a otro equipo: sueltan la pieza en la entrada y nadie la toca. Si la empujan, esa corrida no cuenta. El otro equipo dice qué entra, qué sale y si vio las 12 etapas. A los 50, manos arriba.",
  },
] as const;

export const MAQUINA_PASOS = [
  "Son los equipos de Roles / Equipos. No se arman equipos nuevos.",
  "La entrada y la salida quedan como en las imágenes: boca redonda, flecha verde ENTRADA y flecha roja SALIDA.",
  "Cada etapa del proyecto es un obstáculo para la ficha, canica, moneda o pelota. El letrero lleva el nombre de esa etapa, en orden del 1 al 12.",
  "El docente libera la actividad e inicia los 50 minutos de todo el grupo.",
  "Al sonar el inicio salen una sola vez por cartón, palos de madera y unicel. Hojas, pegamento, diurex y tijeras ya están en la mesa.",
  "Miden 40 cm o más de boca a boca antes de las corridas oficiales.",
  "En las dos corridas sueltan la pieza en la entrada y nadie la empuja, sopla ni la guía. Si la tocan, esa corrida no cuenta.",
  "Otro equipo ve una corrida y dice en una frase qué entra y qué sale.",
  "Parten de 1000 Firmas. Cada nota del docente resta 250.",
];

export type MaquinaNotePreset = {
  code: string;
  label: string;
  points: number;
};

export const MAQUINA_NOTAS: MaquinaNotePreset[] = [
  { code: "estaciones", label: "Faltan etapas o la frase no sirve", points: 250 },
  { code: "sola", label: "La pieza no viaja sola", points: 250 },
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
