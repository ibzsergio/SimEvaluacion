import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { COLUMN_PALETTE, getSeatingPlan, type SeatingTheme } from "./seatingService.js";
import { generateBloque, assignParagraphs, type GeneratedBloque } from "./lecturaGenerate.js";

export const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export type LecturaMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  row: number;
  col: number;
  roleName: string;
  roleTask: string;
  speakScript: string;
  paragraphIndex: number;
  paragraph: string;
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
  producto: string;
  organizador: GeneratedBloque["organizador"];
  members: LecturaMember[];
};

export type LecturaSkipped = {
  displayName: string;
  reason: "baja" | "incapacidad";
};

export type LecturaArchive = {
  sessionNumber: number;
  topic: string;
  generatedAt: string | null;
  teams: LecturaTeam[];
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
  history: LecturaArchive[];
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
  history?: LecturaArchive[];
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
  return `Párrafo ${index + 1}`;
}

export type RawBucket = {
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

export type SeatingBucket = RawBucket;

export async function loadSeatingBuckets(groupId: string, groupCode: string, teacherId: string) {
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
    parrafos: [],
    clave: [],
    preguntaGuia: "",
    producto: "",
    organizador: [],
  };
  const sorted = [...bucket.members].sort((a, b) => a.row - b.row || a.col - b.col);
  const storedParas = Array.isArray(fallback.parrafos) ? fallback.parrafos : [];
  const parrafos = assignParagraphs(
    storedParas.length ? storedParas : fallback.texto ? fallback.texto.split(/\n\n+/).filter(Boolean) : [],
    sorted.length,
  );
  const members: LecturaMember[] = sorted.map((m, i) => {
    const paragraph = parrafos[i] ?? "";
    const roleName = roleNameForOrder(i);
    return {
      ...m,
      roleName,
      roleTask: `Lee en voz alta el párrafo ${i + 1}. Es el recuadro con tu nombre.`,
      speakScript: paragraph,
      paragraphIndex: i,
      paragraph,
    };
  });
  return {
    readingIndex: index,
    colorName: bucket.colorName,
    hex: bucket.hex,
    columna: COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol),
    titulo: fallback.titulo,
    mision: fallback.mision,
    texto: parrafos.join("\n\n") || fallback.texto,
    clave: fallback.clave,
    preguntaGuia: fallback.preguntaGuia,
    producto: fallback.producto || "",
    organizador: fallback.organizador ?? [],
    members,
  };
}

function parsePayload(raw: unknown): StoredPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as StoredPayload;
  if (!Array.isArray(p.teams) || typeof p.sessionNumber !== "number") return null;
  return p;
}

function parseHistory(raw: StoredPayload | null): LecturaArchive[] {
  if (!raw || !Array.isArray(raw.history)) return [];
  return raw.history.filter(
    (item): item is LecturaArchive =>
      Boolean(item) &&
      typeof item.sessionNumber === "number" &&
      typeof item.topic === "string" &&
      Array.isArray(item.teams),
  );
}

function snapshotArchive(session: LecturaSession): LecturaArchive {
  return {
    sessionNumber: session.sessionNumber,
    topic: session.topic,
    generatedAt: session.generatedAt,
    teams: session.teams,
  };
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
    history: parseHistory(stored),
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
      lecturaPayload: true,
    },
  });
  if (!group) return null;

  const topic = topicRaw.replace(/\s+/g, " ").trim();
  if (topic.length < 4) throw new Error("topic_required");

  const { buckets } = await loadSeatingBuckets(groupId, group.code, group.teacherId);
  if (!buckets.length) throw new Error("no_teams");

  const previous = await getLecturaSession(groupId);
  const existing = parsePayload(group.lecturaPayload);
  let history = parseHistory(existing);
  if (previous?.hasContent) {
    const snap = snapshotArchive(previous);
    history = [snap, ...history.filter((h) => h.sessionNumber !== snap.sessionNumber)].slice(0, 16);
  }

  const sessionNumber = (group.lecturaSessionNumber ?? 0) + 1;
  const storedTeams: StoredTeam[] = buckets.map((bucket, teamIndex) => {
    const bloque = generateBloque({
      topic,
      teamIndex,
      teamCount: buckets.length,
      sessionNumber,
      teamLabel: bucket.key,
      memberCount: bucket.members.length,
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
    history,
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

function assignmentFromTeam(
  sessionMeta: { topic: string; sessionNumber: number; teamCount: number },
  team: LecturaTeam,
  studentId: string,
) {
  const me = team.members.find((m) => m.studentId === studentId);
  if (!me || !team.texto) return null;
  return {
    topic: sessionMeta.topic,
    sessionNumber: sessionMeta.sessionNumber,
    readingIndex: team.readingIndex,
    teamCount: sessionMeta.teamCount,
    colorName: team.colorName,
    hex: team.hex,
    columna: team.columna,
    titulo: team.titulo,
    mision: team.mision,
    texto: team.texto,
    clave: team.clave,
    preguntaGuia: team.preguntaGuia,
    producto: team.producto,
    organizador: team.organizador,
    displayName: me.displayName,
    roleName: me.roleName,
    roleTask: me.roleTask,
    speakScript: me.speakScript,
    paragraphIndex: me.paragraphIndex,
    paragraph: me.paragraph,
    teammates: team.members.map((m) => ({
      studentId: m.studentId,
      displayName: m.displayName,
      roleName: m.roleName,
      roleTask: m.roleTask,
      speakScript: m.speakScript,
      paragraphIndex: m.paragraphIndex,
      paragraph: m.paragraph,
      isMe: m.studentId === studentId,
    })),
  };
}

export function studentLecturaAssignment(session: LecturaSession, studentId: string, displayName: string) {
  if (exclusionForLectura(session.groupCode, displayName)) return null;

  const pastReadings = session.history
    .map((archive) => {
      const team = archive.teams.find((t) => t.members.some((m) => m.studentId === studentId));
      if (!team) return null;
      return assignmentFromTeam(
        { topic: archive.topic, sessionNumber: archive.sessionNumber, teamCount: archive.teams.length },
        team,
        studentId,
      );
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const currentTeam = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  const current =
    session.released && session.hasContent && currentTeam
      ? assignmentFromTeam(
          { topic: session.topic, sessionNumber: session.sessionNumber, teamCount: session.teamCount },
          currentTeam,
          studentId,
        )
      : null;

  if (current) return { ...current, pastReadings };
  if (!pastReadings.length) return null;
  const latest = pastReadings[0]!;
  return { ...latest, pastReadings };
}
