export const INTERFACE_ACTIVITY_NAME = "Diseño de Interfaces Proyecto";
export const INTERFACE_MAX_POINTS = 3000;
export const INTERFACE_CLOSE_ISO = "2026-10-22";
export const INTERFACE_WARNING_POINTS = 50;

export const INTERFACE_DAYS = [
  { iso: "2026-10-19", label: "Lun 19" },
  { iso: "2026-10-20", label: "Mar 20" },
  { iso: "2026-10-21", label: "Mié 21" },
  { iso: "2026-10-22", label: "Jue 22" },
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

export const INTERFACE_NOTES: InterfaceNotePreset[] = [
  { code: "silencio", label: "Sin orden y silencio", points: 50, scope: "team" },
  { code: "tarde", label: "Entrega fuera de tiempo", points: 50, scope: "team" },
  { code: "diseno", label: "Diseño, forma o presentación", points: 50, scope: "team" },
  { code: "organizacion", label: "Organización del equipo", points: 50, scope: "team" },
  { code: "fuera", label: "Fuera del equipo", points: 50, scope: "member" },
];

export const INTERFACE_CRITERIA = [
  {
    title: "Entrega en tiempo y fecha",
    detail: "Cierra el 22 de octubre. Entregar ese día conserva el puntaje.",
  },
  {
    title: "Diseño, forma y presentación profesional",
    detail: "La interfaz se reconoce como pantalla de un proyecto, con forma y acabado claros.",
  },
  {
    title: "Buena organización del equipo",
    detail: "El equipo trabaja junto y cada quien sabe qué parte del diseño le toca.",
  },
  {
    title: "Orden y silencio",
    detail: "Si no hay orden y silencio, son 50 puntos menos.",
    penalty: "−50",
  },
  {
    title: "Integrante fuera del equipo",
    detail: "50 puntos menos por cada llamada de atención.",
    penalty: "−50 c/u",
  },
] as const;
