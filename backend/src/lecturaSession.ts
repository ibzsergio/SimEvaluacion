import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { COLUMN_PALETTE, getSeatingPlan, type SeatingTheme } from "./seatingService.js";

const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

const ROLES = [
  {
    name: "Lector",
    task: "Lee en voz alta el bloque de tu equipo cuando toque su turno.",
  },
  {
    name: "Cazador",
    task: "Anota las palabras clave y una frase del texto con tus palabras.",
  },
  {
    name: "Cartógrafo",
    task: "Dibuja el organizador del equipo (cajas y flechas). No copies el párrafo.",
  },
  {
    name: "Crítico",
    task: "Escribe el análisis: para qué sirve esto en un programa real.",
  },
  {
    name: "Vocero",
    task: "Expone 60 segundos al salón. Si el equipo es chico, el de más atrás también habla.",
  },
  {
    name: "Verificador",
    task: "Revisa que el mapa coincida con el texto y agrega un ejemplo extra.",
  },
] as const;

export type LecturaRole = (typeof ROLES)[number];

export type LecturaMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  row: number;
  col: number;
  roleName: string;
  roleTask: string;
};

export type LecturaTeam = {
  readingIndex: number;
  colorName: string;
  hex: string;
  columna: string;
  members: LecturaMember[];
};

export type LecturaSkipped = {
  displayName: string;
  reason: "baja" | "incapacidad";
};

export type LecturaSession = {
  groupId: string;
  groupCode: string;
  shift: string;
  released: boolean;
  releasedAt: string | null;
  theme: SeatingTheme | null;
  teamCount: number;
  skipped: LecturaSkipped[];
  teams: LecturaTeam[];
};

function normalizePersonName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** 301: Julieta y Getsemaní (baja); Maya y Natalia (incapacidad). */
export function exclusionForLectura(groupCode: string, displayName: string): LecturaSkipped["reason"] | null {
  if (groupCode.trim() !== "301") return null;
  const n = normalizePersonName(displayName);
  if (/\bjulieta\b/.test(n)) return "baja";
  if (/\bgetseman/.test(n)) return "baja";
  if (/\bmaya\b/.test(n)) return "incapacidad";
  if (/\bnatalia\b/.test(n)) return "incapacidad";
  return null;
}

function colorNameForHex(hex: string) {
  const found = COLUMN_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return found?.name ?? "Equipo";
}

function teamKey(theme: SeatingTheme | null, col: number, row: number, colorName: string | null, color: string | null) {
  if (theme === "row_colors") return `row:${row}`;
  if (theme === "team_pairs") return `color:${(colorName ?? color ?? "").toLowerCase()}`;
  return `col:${col}`;
}

function roleForOrder(index: number): LecturaRole {
  return ROLES[Math.min(index, ROLES.length - 1)]!;
}

export async function getLecturaSession(groupId: string): Promise<LecturaSession | null> {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      code: true,
      shift: true,
      teacherId: true,
      lecturaReleased: true,
      lecturaReleasedAt: true,
    },
  });
  if (!group) return null;

  const plan = await getSeatingPlan(group.teacherId, groupId, todayClassDayDate());
  const theme = (plan?.theme as SeatingTheme | undefined) ?? null;
  const skippedMap = new Map<string, LecturaSkipped>();
  const buckets = new Map<
    string,
    { sortCol: number; sortRow: number; colorName: string; hex: string; members: LecturaMember[] }
  >();

  for (const cell of plan?.grid ?? []) {
    if (!cell.student) continue;
    const reason = exclusionForLectura(group.code, cell.student.displayName);
    if (reason) {
      skippedMap.set(cell.student.id, { displayName: cell.student.displayName, reason });
      continue;
    }
    const hex = cell.color ?? COLUMN_PALETTE[(cell.col || 1) - 1]?.hex ?? "#94a3b8";
    const colorName = cell.colorName ?? colorNameForHex(hex);
    const key = teamKey(theme, cell.col, cell.row, colorName, cell.color);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        sortCol: cell.col,
        sortRow: cell.row,
        colorName,
        hex,
        members: [],
      };
      buckets.set(key, bucket);
    }
    bucket.members.push({
      studentId: cell.student.id,
      displayName: cell.student.displayName,
      listNumber: cell.student.listNumber ?? null,
      row: cell.row,
      col: cell.col,
      roleName: "",
      roleTask: "",
    });
  }

  const teams: LecturaTeam[] = [...buckets.values()]
    .filter((b) => b.members.length > 0)
    .sort((a, b) => a.sortCol - b.sortCol || a.sortRow - b.sortRow)
    .map((bucket, readingIndex) => {
      const members = [...bucket.members]
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((m, i) => {
          const role = roleForOrder(i);
          return { ...m, roleName: role.name, roleTask: role.task };
        });
      return {
        readingIndex,
        colorName: bucket.colorName,
        hex: bucket.hex,
        columna: COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol),
        members,
      };
    });

  return {
    groupId: group.id,
    groupCode: group.code,
    shift: group.shift,
    released: group.lecturaReleased ?? false,
    releasedAt: group.lecturaReleasedAt ? group.lecturaReleasedAt.toISOString() : null,
    theme,
    teamCount: teams.length,
    skipped: [...skippedMap.values()],
    teams,
  };
}

export function studentLecturaAssignment(session: LecturaSession, studentId: string, displayName: string) {
  if (!session.released) return null;
  if (exclusionForLectura(session.groupCode, displayName)) return null;
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) return null;
  const me = team.members.find((m) => m.studentId === studentId)!;
  return {
    readingIndex: team.readingIndex,
    teamCount: session.teamCount,
    colorName: team.colorName,
    hex: team.hex,
    columna: team.columna,
    roleName: me.roleName,
    roleTask: me.roleTask,
    teammates: team.members.map((m) => ({
      studentId: m.studentId,
      displayName: m.displayName,
      roleName: m.roleName,
      isMe: m.studentId === studentId,
    })),
  };
}
