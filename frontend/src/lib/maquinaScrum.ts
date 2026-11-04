export const MAQUINA_MINUTOS = 50;
export const MAQUINA_TITULO = "La máquina";
export const MAQUINA_PROGRAMA = "Actividad Scrum";
export const MAQUINA_FIRMAS_MAX = 1000;
export const MAQUINA_ACTIVITY_NAME = "La máquina";

export const MAQUINA_PRODUCTO =
  "Una máquina de cartón, palos y unicel. La ficha recorre sola las 12 etapas de su proyecto, de la entrada a la salida. Al frente va la frase de su programa.";

export const MAQUINA_PRODUCTO_NO =
  "No es un cartel ni un pop-up: la ficha recorre el camino de verdad. Si en una corrida oficial alguien la empuja, sopla o la guía, esa corrida no cuenta.";

export const MAQUINA_PRODUCTO_DEBE = [
  "Base de cartón de al menos 40 cm, de boca a boca. Si las 12 etapas no se leen de lejos, la alargan.",
  "Entrada arriba: un hoyo o embudo con el letrero ENTRADA. Por ahí sueltan la ficha, sin empujarla.",
  "Doce estaciones, en el orden del proyecto: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 y 12. En la foto el número es el lugar. En su máquina cada letrero lleva el nombre de esa etapa, el que ya usan.",
  "La ficha pasa por las 12, sola. En el camino tiene que caer por una rampa, girar en una curva y desviarse en un arco o una pared, como en la foto.",
  "Salida abajo: una boca o charola con el letrero SALIDA. La ficha llega y se detiene sola.",
  "Al frente, letras grandes que se leen desde el otro lado del salón: «Entra ___ y sale ___». Los huecos son lo que entra y lo que sale en su programa.",
  "Misma ficha en todas las pruebas: tapadera, bola de papel bien apretada o canica. Tiene que caber en las dos bocas.",
];

export const MAQUINA_MATERIALES = [
  "Ya en la mesa: hojas de color para ENTRADA, las 12 etapas, SALIDA y la frase, pegamento, diurex y tijeras.",
  "Al iniciar el reloj pueden salir una sola vez por cartón (base y paredes), palos de madera (rieles y rampa) y unicel (curva y arco).",
  "Una ficha, elegida antes de armar: tapadera, bola de papel bien apretada o canica. Esa misma se usa en las tres pruebas y en las dos corridas oficiales.",
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
    tarea: "Avisa los cortes de los minutos 8, 30, 42 y 50. En las dos corridas oficiales nadie toca la ficha.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Arma el camino para que la ficha pase sola por las 12 etapas: una rampa, una curva y un arco o pared.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "Corta ENTRADA, el nombre de las 12 etapas en orden, SALIDA y la frase. Se leen desde el otro lado del salón.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Elige la ficha y comprueba que cabe. Revisa que estén las 12 etapas, en orden y con su nombre. Hace las tres pruebas y las dos corridas.",
  },
] as const;

export const MAQUINA_SPRINTS = [
  {
    id: "diseno",
    nombre: "Acto 1 — El recorrido",
    desde: 0,
    hasta: 8,
    detalle:
      "Escriben las 12 etapas en orden, con el nombre del proyecto, y completan «Entra ___ y sale ___». Dibujan dónde va cada letrero. Eligen la ficha y comprueban que cabe en las dos bocas.",
  },
  {
    id: "obra",
    nombre: "Acto 2 — La construyen",
    desde: 8,
    hasta: 30,
    detalle:
      "Salen una vez por cartón, palos y unicel. Arman la base, de al menos 40 cm, con pendiente. Pegan ENTRADA, las 12 etapas, SALIDA y la frase grande al frente.",
  },
  {
    id: "prueba",
    nombre: "Acto 3 — Tres pruebas",
    desde: 30,
    hasta: 42,
    detalle:
      "Sueltan la ficha tres veces desde ENTRADA, sin tocarla, y tiene que pasar por las 12 etapas. Si se atora, corrigen la pendiente. No cambian los nombres.",
  },
  {
    id: "oficial",
    nombre: "Acto 4 — Dos corridas",
    desde: 42,
    hasta: 50,
    detalle:
      "Silencio. Dos corridas frente a otro equipo: sueltan la ficha y nadie la toca. Si la empujan, esa corrida no cuenta. El otro equipo dice qué entra, qué sale y si vio las 12 etapas en orden. A los 50, manos arriba.",
  },
] as const;

export const MAQUINA_PASOS = [
  "Son los equipos de Roles / Equipos. No se arman equipos nuevos.",
  "El camino es ENTRADA, las 12 etapas del proyecto en orden y SALIDA. El número de la foto es el lugar; el letrero lleva el nombre de esa etapa.",
  "El docente libera la actividad e inicia los 50 minutos de todo el grupo.",
  "Al sonar el inicio salen una sola vez por cartón, palos de madera y unicel. Hojas, pegamento, diurex y tijeras ya están en la mesa.",
  "Miden 40 cm o más de boca a boca antes de las corridas oficiales.",
  "En las dos corridas sueltan la ficha y nadie la empuja, sopla ni la guía. Si la tocan, esa corrida no cuenta.",
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
