import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { COLUMN_PALETTE, getSeatingPlan, type SeatingTheme } from "./seatingService.js";
import { generateBloque, speakScriptForRole, type GeneratedBloque } from "./lecturaGenerate.js";

const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

const ROLES = [
  { name: "Lector" },
  { name: "Cazador" },
  { name: "Cartógrafo" },
  { name: "Crítico" },
  { name: "Vocero" },
  { name: "Verificador" },
] as const;

export type LecturaMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  row: number;
  col: number;
  roleName: string;
  roleTask: string;
  speakScript: string;
};

export type LecturaTeam = {
  readingIndex: number;
  colorName: string;
  hex: string;
  columna: string;
  titulo: string;
  mision: string;
  texto: string;
  clave: string[];
  preguntaGuia: string;
  organizador: GeneratedBloque["organizador"];
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
  topic: string;
  sessionNumber: number;
  generatedAt: string | null;
  released: boolean;
  releasedAt: string | null;
  theme: SeatingTheme | null;
  teamCount: number;
  skipped: LecturaSkipped[];
  teams: LecturaTeam[];
  hasContent: boolean;
};

type StoredTeam = {
  key: string;
  readingIndex: number;
  colorName: string;
  hex: string;
  columna: string;
  bloque: GeneratedBloque;
};

type StoredPayload = {
  topic: string;
  sessionNumber: number;
  generatedAt: string;
  teams: StoredTeam[];
};

function normalizePersonName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

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

function roleNameForOrder(index: number) {
  return ROLES[Math.min(index, ROLES.length - 1)]!.name;
}

type RawBucket = {
  key: string;
  sortCol: number;
  sortRow: number;
  colorName: string;
  hex: string;
  members: Array<{
    studentId: string;
    displayName: string;
    listNumber: number | null;
    row: number;
    col: number;
  }>;
};

async function loadSeatingBuckets(groupId: string, groupCode: string, teacherId: string) {
  const plan = await getSeatingPlan(teacherId, groupId, todayClassDayDate());
  const theme = (plan?.theme as SeatingTheme | undefined) ?? null;
  const skippedMap = new Map<string, LecturaSkipped>();
  const buckets = new Map<string, RawBucket>();

  for (const cell of plan?.grid ?? []) {
    if (!cell.student) continue;
    const reason = exclusionForLectura(groupCode, cell.student.displayName);
    if (reason) {
      skippedMap.set(cell.student.id, { displayName: cell.student.displayName, reason });
      continue;
    }
    const hex = cell.color ?? COLUMN_PALETTE[(cell.col || 1) - 1]?.hex ?? "#94a3b8";
    const colorName = cell.colorName ?? colorNameForHex(hex);
    const key = teamKey(theme, cell.col, cell.row, colorName, cell.color);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, sortCol: cell.col, sortRow: cell.row, colorName, hex, members: [] };
      buckets.set(key, bucket);
    }
    bucket.members.push({
      studentId: cell.student.id,
      displayName: cell.student.displayName,
      listNumber: cell.student.listNumber ?? null,
      row: cell.row,
      col: cell.col,
    });
  }

  const sorted = [...buckets.values()]
    .filter((b) => b.members.length > 0)
    .sort((a, b) => a.sortCol - b.sortCol || a.sortRow - b.sortRow);

  return { theme, skipped: [...skippedMap.values()], buckets: sorted };
}

function hydrateTeam(bucket: RawBucket, index: number, bloque: GeneratedBloque | null): LecturaTeam {
  const fallback: GeneratedBloque = bloque ?? {
    titulo: "Falta generar la lectura de esta semana",
    mision: "El docente debe escribir el tema y pulsar Generar.",
    texto: "",
    clave: [],
    preguntaGuia: "",
    organizador: [],
  };
  const members: LecturaMember[] = [...bucket.members]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((m, i) => {
      const roleName = roleNameForOrder(i);
      const spoken = speakScriptForRole(roleName, fallback, m.displayName);
      return { ...m, roleName, roleTask: spoken.roleTask, speakScript: spoken.speakScript };
    });
  return {
    readingIndex: index,
    colorName: bucket.colorName,
    hex: bucket.hex,
    columna: COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol),
    titulo: fallback.titulo,
    mision: fallback.mision,
    texto: fallback.texto,
    clave: fallback.clave,
    preguntaGuia: fallback.preguntaGuia,
    organizador: fallback.organizador,
    members,
  };
}

function parsePayload(raw: unknown): StoredPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as StoredPayload;
  if (!Array.isArray(p.teams) || typeof p.sessionNumber !== "number") return null;
  return p;
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
      lecturaTopic: true,
      lecturaSessionNumber: true,
      lecturaPayload: true,
    },
  });
  if (!group) return null;

  const { theme, skipped, buckets } = await loadSeatingBuckets(groupId, group.code, group.teacherId);
  const stored = parsePayload(group.lecturaPayload);
  const byKey = new Map((stored?.teams ?? []).map((t) => [t.key, t]));

  const teams = buckets.map((bucket, index) => {
    const saved = byKey.get(bucket.key);
    return hydrateTeam(bucket, saved?.readingIndex ?? index, saved?.bloque ?? null);
  });

  return {
    groupId: group.id,
    groupCode: group.code,
    shift: group.shift,
    topic: (group.lecturaTopic ?? stored?.topic ?? "").trim(),
    sessionNumber: group.lecturaSessionNumber ?? stored?.sessionNumber ?? 0,
    generatedAt: stored?.generatedAt ?? null,
    released: group.lecturaReleased ?? false,
    releasedAt: group.lecturaReleasedAt ? group.lecturaReleasedAt.toISOString() : null,
    theme,
    teamCount: teams.length,
    skipped,
    teams,
    hasContent: Boolean(stored && stored.teams.length > 0),
  };
}

export async function generateLecturaForGroup(groupId: string, topicRaw: string) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      code: true,
      teacherId: true,
      lecturaSessionNumber: true,
    },
  });
  if (!group) return null;

  const topic = topicRaw.replace(/\s+/g, " ").trim();
  if (topic.length < 4) throw new Error("topic_required");

  const { buckets } = await loadSeatingBuckets(groupId, group.code, group.teacherId);
  if (!buckets.length) throw new Error("no_teams");

  const sessionNumber = (group.lecturaSessionNumber ?? 0) + 1;
  const storedTeams: StoredTeam[] = buckets.map((bucket, teamIndex) => {
    const bloque = generateBloque({
      topic,
      teamIndex,
      teamCount: buckets.length,
      sessionNumber,
      teamLabel: bucket.key,
    });
    return {
      key: bucket.key,
      readingIndex: teamIndex,
      colorName: bucket.colorName,
      hex: bucket.hex,
      columna: COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol),
      bloque,
    };
  });

  const payload: StoredPayload = {
    topic,
    sessionNumber,
    generatedAt: new Date().toISOString(),
    teams: storedTeams,
  };

  await prisma.classGroup.update({
    where: { id: groupId },
    data: {
      lecturaTopic: topic,
      lecturaSessionNumber: sessionNumber,
      lecturaPayload: payload,
      lecturaReleased: false,
      lecturaReleasedAt: null,
    },
  });

  return getLecturaSession(groupId);
}

export function studentLecturaAssignment(session: LecturaSession, studentId: string, displayName: string) {
  if (!session.released || !session.hasContent) return null;
  if (exclusionForLectura(session.groupCode, displayName)) return null;
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team || !team.texto) return null;
  const me = team.members.find((m) => m.studentId === studentId)!;
  return {
    topic: session.topic,
    sessionNumber: session.sessionNumber,
    readingIndex: team.readingIndex,
    teamCount: session.teamCount,
    colorName: team.colorName,
    hex: team.hex,
    columna: team.columna,
    titulo: team.titulo,
    mision: team.mision,
    texto: team.texto,
    clave: team.clave,
    preguntaGuia: team.preguntaGuia,
    organizador: team.organizador,
    roleName: me.roleName,
    roleTask: me.roleTask,
    speakScript: me.speakScript,
    teammates: team.members.map((m) => ({
      studentId: m.studentId,
      displayName: m.displayName,
      roleName: m.roleName,
      roleTask: m.roleTask,
      speakScript: m.speakScript,
      isMe: m.studentId === studentId,
    })),
  };
}
