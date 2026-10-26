export const INTERFACE_ACTIVITY_NAME = "Diseño de Interfaces Proyecto";
export const INTERFACE_MAX_POINTS = 3000;
export const INTERFACE_CLOSE_ISO = "2026-10-22";
export const INTERFACE_WARNING_POINTS = 50;

export const INTERFACE_DAYS = [
  { iso: "2026-10-19", label: "Lun 19" },
  { iso: "2026-10-20", label: "Mar 20" },
  { iso: "2026-10-21", label: "Mié 21" },
  { iso: "2026-10-22", label: "Jue 22" },
  { iso: "2026-10-26", label: "Lun 26" },
] as const;

export type InterfaceDay = (typeof INTERFACE_DAYS)[number]["iso"];

export function interfaceDayLabel(iso: string) {
  return INTERFACE_DAYS.find((day) => day.iso === iso)?.label ?? iso;
}

export type InterfaceNotePreset = {
  code: string;
  label: string;
  points: number;
  scope: "team" | "member";
};

/** Lista de cotejo del diseño. Si no se cumple, se resta. Suma 3,000. */
export const INTERFACE_COTEJO = [
  {
    code: "trabajo",
    label: "Trabajo en equipo",
    points: 300,
    detail: "Todos construyen, se reparten el diseño y nadie se queda mirando.",
  },
  {
    code: "funcional",
    label: "Diseño funcional",
    points: 400,
    detail: "La interfaz sirve para lo que el programa tiene que hacer. Se puede usar.",
  },
  {
    code: "profesional",
    label: "Diseño atractivo y profesional",
    points: 350,
    detail: "Se ve como un producto terminado, con forma y acabado claros.",
  },
  {
    code: "color",
    label: "Colorimetría",
    points: 250,
    detail: "Los colores combinan, contrastan y se leen. No pelean entre sí.",
  },
  {
    code: "tipo",
    label: "Tipografía adecuada",
    points: 200,
    detail: "El texto se lee. El tamaño y el peso distinguen títulos, botones y contenido.",
  },
  {
    code: "usable",
    label: "Diseño amigable con el usuario",
    points: 300,
    detail: "Alguien de otro equipo entiende qué tocar, sin explicación.",
  },
  {
    code: "docente",
    label: "Vista del docente",
    points: 300,
    detail: "Hay una pantalla propia para el docente, distinta de la del directivo.",
  },
  {
    code: "directivo",
    label: "Vista del directivo",
    points: 300,
    detail: "Hay una pantalla propia para el directivo, con lo que esa persona necesita ver.",
  },
  {
    code: "responsivo",
    label: "Diseño 100% responsivo",
    points: 300,
    detail: "Se usa bien en teléfono, tableta y computadora. Nada se corta ni se sale de la pantalla.",
  },
  {
    code: "navegacion",
    label: "Navegación clara",
    points: 150,
    detail: "Se sabe cómo pasar de una pantalla a otra y cómo volver.",
  },
  {
    code: "alineacion",
    label: "Alineación y espaciado",
    points: 150,
    detail: "Los elementos están alineados y respiran. Nada queda encimado.",
  },
] as const;

export const INTERFACE_COTEJO_TOTAL = INTERFACE_COTEJO.reduce((acc, item) => acc + item.points, 0);

export const INTERFACE_NOTES: InterfaceNotePreset[] = [
  { code: "silencio", label: "Sin orden y silencio", points: 50, scope: "team" },
  { code: "tarde", label: "Entrega fuera de tiempo", points: 50, scope: "team" },
  { code: "diseno", label: "Diseño, forma o presentación", points: 50, scope: "team" },
  { code: "organizacion", label: "Organización del equipo", points: 50, scope: "team" },
  { code: "fuera", label: "Fuera del equipo", points: 50, scope: "member" },
];

export const INTERFACE_CRITERIA = [
  ...INTERFACE_COTEJO.map((item) => ({
    title: item.label,
    detail: item.detail,
    penalty: `−${item.points.toLocaleString("es-MX")}`,
  })),
  {
    title: "Orden y silencio",
    detail: "Nota que el equipo ya tenía. Si no hay orden, son 50 firmas menos.",
    penalty: "−50",
  },
  {
    title: "Entrega en tiempo",
    detail: "Nota que el equipo ya tenía. Entregar fuera de tiempo resta 50.",
    penalty: "−50",
  },
  {
    title: "Integrante fuera del equipo",
    detail: "50 firmas menos por cada llamada de atención a una persona.",
    penalty: "−50 c/u",
  },
] as const;
