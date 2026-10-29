export const INTERFACE_ACTIVITY_NAME = "Diseño de Interfaces Proyecto";
export const INTERFACE_MAX_POINTS = 3000;
export const INTERFACE_CLOSE_ISO = "2026-10-28";
export const INTERFACE_WARNING_POINTS = 50;

export const INTERFACE_DAYS = [
  { iso: "2026-10-19", label: "Lun 19" },
  { iso: "2026-10-20", label: "Mar 20" },
  { iso: "2026-10-21", label: "Mié 21" },
  { iso: "2026-10-22", label: "Jue 22" },
  { iso: "2026-10-26", label: "Lun 26" },
  { iso: "2026-10-28", label: "Mié 28" },
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
    code: "profesional",
    label: "Diseño profesional y amigable con el usuario",
    points: 700,
    detail: "Se ve profesional, funciona y alguien de otro equipo entiende qué tocar, sin explicación.",
    aliases: ["funcional", "usable"],
  },
  {
    code: "entrega",
    label: "Entrega en tiempo y forma",
    points: 350,
    detail: "Llegó el día indicado y el diseño está completo, como se pidió.",
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

export function interfaceDesignClosed(now = new Date()) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return iso >= INTERFACE_CLOSE_ISO;
}

type InterfaceGradeSource = {
  peer?: { teams: Array<{ key: string; peerAverage: number | null }> };
  teams: Array<{
    key: string;
    awardedDays: string[];
    members: Array<{ studentId: string }>;
    notes: Array<{ points: number; day: string; studentId: string | null }>;
  }>;
};

/** Promedio que cuenta: cotejo del docente y, si hay, el de los líderes. */
export function interfaceGradeRows(session: InterfaceGradeSource, activityId: string) {
  const closed = interfaceDesignClosed();
  const rows: Array<{ activityId: string; studentId: string; points: number }> = [];
  for (const team of session.teams) {
    const counted =
      team.awardedDays.length > 0
        ? team.notes.filter((note) => team.awardedDays.includes(note.day))
        : closed
          ? team.notes
          : [];
    const teacherCut = counted
      .filter((note) => !note.studentId)
      .reduce((acc, note) => acc + note.points, 0);
    const teacher = Math.max(0, INTERFACE_MAX_POINTS - teacherCut);
    const peer = session.peer?.teams.find((item) => item.key === team.key)?.peerAverage ?? null;
    const base = peer == null ? teacher : Math.round((teacher + peer) / 2);
    for (const member of team.members) {
      const personal = counted
        .filter((note) => note.studentId === member.studentId)
        .reduce((acc, note) => acc + note.points, 0);
      rows.push({
        activityId,
        studentId: member.studentId,
        points: Math.max(0, Math.min(INTERFACE_MAX_POINTS, base - personal)),
      });
    }
  }
  return rows;
}
