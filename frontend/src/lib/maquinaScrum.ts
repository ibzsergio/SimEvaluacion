export const MAQUINA_MINUTOS = 50;
export const MAQUINA_TITULO = "La máquina";
export const MAQUINA_PROGRAMA = "Actividad Scrum";
export const MAQUINA_FIRMAS_MAX = 1000;
export const MAQUINA_ACTIVITY_NAME = "La máquina";

export const MAQUINA_PRODUCTO =
  "Una máquina de cartón, palos y unicel. La ficha entra arriba, cae, gira, se desvía y sale sola abajo. Al frente va la frase de su programa.";

export const MAQUINA_PRODUCTO_NO =
  "No es un cartel ni un pop-up: la ficha recorre el camino de verdad. Si en una corrida oficial alguien la empuja, sopla o la guía, esa corrida no cuenta.";

export const MAQUINA_PRODUCTO_DEBE = [
  "Base de cartón de al menos 40 cm, medidos de la boca de entrada a la boca de salida. Una hoja tamaño carta mide unos 28 cm: la máquina tiene que ser más larga que eso.",
  "Entrada arriba: un hoyo o embudo con el letrero ENTRADA. Por ahí sueltan la ficha, sin empujarla.",
  "Estación 1, Cae: una rampa de palo o cartón. La ficha baja. El letrero lleva el nombre real de esa parte de su programa, no «estación 1».",
  "Estación 2, Gira: una curva de palo o unicel. La ficha da vuelta. El letrero lleva el segundo nombre real del programa.",
  "Estación 3, Se desvía: un arco o una pared. La ficha cambia de dirección. El letrero lleva el tercer nombre real del programa.",
  "Salida abajo: una boca o charola con el letrero SALIDA. La ficha llega y se detiene sola.",
  "Al frente, letras grandes que se leen desde el otro lado del salón: «Entra ___ y sale ___». Los huecos son lo que entra y lo que sale en su programa. «Entra dato y sale resultado» de la foto es solo un ejemplo: no lo copien.",
  "Misma ficha en todas las pruebas: tapadera, bola de papel bien apretada o canica. Tiene que caber en las dos bocas.",
];

export const MAQUINA_MATERIALES = [
  "Ya en la mesa: hojas de color para los cinco letreros y la frase, pegamento, diurex y tijeras.",
  "Al iniciar el reloj pueden salir una sola vez por cartón (base y paredes), palos de madera (rieles y rampa) y unicel (curva y arco).",
  "Una ficha, elegida antes de armar: tapadera, bola de papel bien apretada o canica. Esa misma se usa en las tres pruebas y en las dos corridas oficiales.",
];

export const MAQUINA_ROLES = [
  {
    id: "product_owner",
    label: "Product Owner",
    tarea: "Escribe los 3 nombres reales del programa, uno por estación, y llena «Entra ___ y sale ___» con lo que entra y lo que sale.",
  },
  {
    id: "scrum_master",
    label: "Scrum Master",
    tarea: "Avisa los cortes de los minutos 8, 30, 42 y 50. En las dos corridas oficiales nadie toca la ficha.",
  },
  {
    id: "developer",
    label: "Desarrollador",
    tarea: "Arma la pendiente: entrada arriba, rampa para que caiga, curva para que gire, arco o pared para que se desvíe, y salida abajo.",
  },
  {
    id: "ui_designer",
    label: "Diseño / UI",
    tarea: "Corta ENTRADA, los 3 nombres, SALIDA y la frase. Se leen desde el otro lado del salón.",
  },
  {
    id: "qa_docs",
    label: "QA / Docs",
    tarea: "Elige la ficha y comprueba que cabe. Hace las tres pruebas y las dos corridas. Anota si llegó sola y si el otro equipo dijo qué entra y qué sale.",
  },
] as const;

export const MAQUINA_SPRINTS = [
  {
    id: "diseno",
    nombre: "Acto 1 — El recorrido",
    desde: 0,
    hasta: 8,
    detalle:
      "Escriben los 3 nombres reales y completan «Entra ___ y sale ___». Dibujan el camino: entrada arriba, cae, gira, se desvía, salida abajo. Eligen la ficha y comprueban que cabe en las dos bocas.",
  },
  {
    id: "obra",
    nombre: "Acto 2 — La construyen",
    desde: 8,
    hasta: 30,
    detalle:
      "Salen una vez por cartón, palos y unicel. Arman la base de al menos 40 cm con pendiente. Pegan ENTRADA, los 3 nombres, SALIDA y la frase grande al frente.",
  },
  {
    id: "prueba",
    nombre: "Acto 3 — Tres pruebas",
    desde: 30,
    hasta: 42,
    detalle:
      "Sueltan la ficha tres veces desde ENTRADA, sin tocarla. Si se atora, suben la pendiente, abren la boca o alisan la curva. No cambian los nombres del programa.",
  },
  {
    id: "oficial",
    nombre: "Acto 4 — Dos corridas",
    desde: 42,
    hasta: 50,
    detalle:
      "Silencio. Dos corridas frente a otro equipo: sueltan la ficha y nadie la toca. Si la empujan, esa corrida no cuenta. El otro equipo dice en una frase qué entra y qué sale. A los 50, manos arriba.",
  },
] as const;

export const MAQUINA_PASOS = [
  "Son los equipos de Roles / Equipos. No se arman equipos nuevos.",
  "El camino es fijo: ENTRADA arriba, Cae, Gira, Se desvía y SALIDA abajo. Cada estación lleva además el nombre real de su programa.",
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
