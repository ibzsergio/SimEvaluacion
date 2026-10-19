export const INTERFACE_ACTIVITY_NAME = "Diseño de Interfaces Proyecto";
export const INTERFACE_MAX_POINTS = 3000;
export const INTERFACE_CLOSE_ISO = "2026-10-22";
export const INTERFACE_WARNING_POINTS = 50;

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
