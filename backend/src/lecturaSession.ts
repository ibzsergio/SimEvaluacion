import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import {
  COLUMN_PALETTE,
  getSeatingPlan,
  resolveSeatSwatch,
  type SeatingTheme,
} from "./seatingService.js";
import { generateBloque, assignParagraphs, type GeneratedBloque } from "./lecturaGenerate.js";
import { bloqueDesdeWidget, widgetTemaForTeam } from "./lecturaTemasTkinter.js";

export const LECTURA_MINUTES = 50;
export const LECTURA_301_TOPIC = "Widgets de Tkinter: un widget por equipo";

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
  key: string;
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
  leaderId: string | null;
  leaderName: string | null;
  startedAt: string | null;
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
  minutes: number;
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
  leaderId?: string | null;
  startedAt?: string | null;
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
  if (/\bghetseman|\bgetseman/.test(n)) return "baja";
  return null;
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
    const swatch = resolveSeatSwatch(theme ?? "column_colors", cell.row, cell.col, cell.color);
    const hex = swatch.hex;
    const colorName = swatch.name;
    const key = teamKey(theme, cell.col, cell.row, colorName, hex);
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

function hydrateTeam(
  bucket: RawBucket,
  index: number,
  bloque: GeneratedBloque | null,
  storedLeaderId: string | null = null,
  storedStartedAt: string | null = null,
): LecturaTeam {
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
  const leaderStillInTeam = storedLeaderId
    ? members.some((m) => m.studentId === storedLeaderId)
    : false;
  const leaderId = leaderStillInTeam ? storedLeaderId : null;
  const leaderName = leaderId ? (members.find((m) => m.studentId === leaderId)?.displayName ?? null) : null;
  const columna = COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol);
  const painted = paintByColumn(columna, bucket.hex);
  return {
    key: bucket.key,
    readingIndex: index,
    colorName: painted.name,
    hex: painted.hex,
    columna,
    titulo: fallback.titulo,
    mision: fallback.mision,
    texto: parrafos.join("\n\n") || fallback.texto,
    clave: fallback.clave,
    preguntaGuia: fallback.preguntaGuia,
    producto: fallback.producto || "",
    organizador: fallback.organizador ?? [],
    members,
    leaderId,
    leaderName,
    startedAt: leaderId ? storedStartedAt : null,
  };
}

function parsePayload(raw: unknown): StoredPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as StoredPayload;
  if (!Array.isArray(p.teams) || typeof p.sessionNumber !== "number") return null;
  return p;
}

function paintByColumn(columna: string, storedHex?: string | null) {
  const col = COLUMN_LETTERS.indexOf(columna as (typeof COLUMN_LETTERS)[number]) + 1;
  if (col > 0) {
    const swatch = COLUMN_PALETTE[col - 1] ?? COLUMN_PALETTE[0];
    return { name: swatch.name, hex: swatch.hex };
  }
  return resolveSeatSwatch("column_colors", 1, 1, storedHex);
}

function paintLecturaTeam<T extends { columna: string; hex: string; colorName: string }>(team: T): T {
  const painted = paintByColumn(team.columna, team.hex);
  return { ...team, hex: painted.hex, colorName: painted.name };
}

function parseHistory(raw: StoredPayload | null): LecturaArchive[] {
  if (!raw || !Array.isArray(raw.history)) return [];
  return raw.history
    .filter(
      (item): item is LecturaArchive =>
        Boolean(item) &&
        typeof item.sessionNumber === "number" &&
        typeof item.topic === "string" &&
        Array.isArray(item.teams),
    )
    .map((item) => ({
      ...item,
      teams: item.teams.map((team) => paintLecturaTeam(team)),
    }));
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
    return hydrateTeam(
      bucket,
      saved?.readingIndex ?? index,
      saved?.bloque ?? null,
      saved?.leaderId ?? null,
      saved?.startedAt ?? null,
    );
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
    minutes: LECTURA_MINUTES,
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

  const is301 = group.code.trim() === "301";
  let topic = topicRaw.replace(/\s+/g, " ").trim();
  if (is301 && topic.length < 4) topic = LECTURA_301_TOPIC;
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
    const bloque = is301
      ? bloqueDesdeWidget(widgetTemaForTeam(teamIndex), bucket.members.length)
      : generateBloque({
          topic,
          teamIndex,
          teamCount: buckets.length,
          sessionNumber,
          teamLabel: bucket.key,
          memberCount: bucket.members.length,
        });
    const columna = COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol);
    const painted = paintByColumn(columna, bucket.hex);
    return {
      key: bucket.key,
      readingIndex: teamIndex,
      colorName: painted.name,
      hex: painted.hex,
      columna,
      bloque,
      leaderId: null,
      startedAt: null,
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
  sessionMeta: { topic: string; sessionNumber: number; teamCount: number; minutes?: number },
  team: LecturaTeam,
  studentId: string,
) {
  const me = team.members.find((m) => m.studentId === studentId);
  if (!me || !team.texto) return null;
  const painted = paintByColumn(team.columna, team.hex);
  return {
    topic: sessionMeta.topic,
    sessionNumber: sessionMeta.sessionNumber,
    readingIndex: team.readingIndex,
    teamCount: sessionMeta.teamCount,
    minutes: sessionMeta.minutes ?? LECTURA_MINUTES,
    colorName: painted.name,
    hex: painted.hex,
    columna: team.columna,
    titulo: team.titulo,
    mision: team.mision,
    texto: team.texto,
    clave: team.clave,
    preguntaGuia: team.preguntaGuia,
    producto: team.producto,
    organizador: team.organizador,
    displayName: me.displayName,
    isLeader: team.leaderId === studentId,
    leaderId: team.leaderId,
    leaderName: team.leaderName,
    startedAt: team.startedAt,
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
      const assigned = assignmentFromTeam(
        {
          topic: archive.topic,
          sessionNumber: archive.sessionNumber,
          teamCount: archive.teams.length,
          minutes: LECTURA_MINUTES,
        },
        team,
        studentId,
      );
      if (!assigned) return null;
      return { ...assigned, isLeader: false, leaderId: null, leaderName: null, startedAt: null };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const currentTeam = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  const current =
    session.released && session.hasContent && currentTeam
      ? assignmentFromTeam(
          {
            topic: session.topic,
            sessionNumber: session.sessionNumber,
            teamCount: session.teamCount,
            minutes: session.minutes,
          },
          currentTeam,
          studentId,
        )
      : null;

  if (current) return { ...current, pastReadings };
  if (!pastReadings.length) return null;
  const latest = pastReadings[0]!;
  return { ...latest, pastReadings };
}

async function persistLecturaLeaders(groupId: string, teams: LecturaTeam[]) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { lecturaPayload: true },
  });
  const stored = parsePayload(group?.lecturaPayload);
  if (!stored) throw new Error("no_content");
  const byKey = new Map(teams.map((t) => [t.key, t]));
  const next: StoredPayload = {
    ...stored,
    teams: stored.teams.map((t) => {
      const live = byKey.get(t.key);
      return {
        ...t,
        leaderId: live ? live.leaderId : (t.leaderId ?? null),
        startedAt: live ? live.startedAt : (t.startedAt ?? null),
      };
    }),
  };
  await prisma.classGroup.update({
    where: { id: groupId },
    data: { lecturaPayload: JSON.parse(JSON.stringify(next)) as Prisma.InputJsonValue },
  });
}

export async function resetLecturaTimers(groupId: string) {
  const session = await getLecturaSession(groupId);
  if (!session?.hasContent) return null;
  const teams = session.teams.map((t) => ({ ...t, leaderId: null, leaderName: null, startedAt: null }));
  await persistLecturaLeaders(groupId, teams);
  return getLecturaSession(groupId);
}

export async function chooseLecturaLeader(groupId: string, studentId: string, nomineeId: string) {
  const session = await getLecturaSession(groupId);
  if (!session?.released || !session.hasContent) throw new Error("not_released");
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) throw new Error("not_in_team");
  if (team.startedAt) throw new Error("already_started");
  if (!team.members.some((m) => m.studentId === nomineeId)) throw new Error("invalid_leader");
  const teams = session.teams.map((t) =>
    t.key === team.key
      ? {
          ...t,
          leaderId: nomineeId,
          leaderName: t.members.find((m) => m.studentId === nomineeId)?.displayName ?? null,
        }
      : t,
  );
  await persistLecturaLeaders(groupId, teams);
  return getLecturaSession(groupId);
}

export async function startLecturaTimer(groupId: string, studentId: string) {
  const session = await getLecturaSession(groupId);
  if (!session?.released || !session.hasContent) throw new Error("not_released");
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) throw new Error("not_in_team");
  if (team.leaderId !== studentId) throw new Error("not_leader");
  if (team.startedAt) return session;
  const startedAt = new Date().toISOString();
  const teams = session.teams.map((t) => (t.key === team.key ? { ...t, startedAt } : t));
  await persistLecturaLeaders(groupId, teams);
  return getLecturaSession(groupId);
}

export function lecturaErrorHttp(msg: string) {
  if (msg === "not_released" || msg === "not_in_team" || msg === "not_leader" || msg === "no_content") {
    return { status: 403 as const, error: msg, message: lecturaErrorMessage(msg) };
  }
  if (msg === "already_started") {
    return { status: 409 as const, error: msg, message: lecturaErrorMessage(msg) };
  }
  if (msg === "invalid_leader") {
    return { status: 400 as const, error: msg, message: lecturaErrorMessage(msg) };
  }
  return { status: 500 as const, error: "lectura_failed", message: "No se pudo actualizar la lectura." };
}

function lecturaErrorMessage(msg: string) {
  if (msg === "not_released") return "El docente aún no libera la lectura.";
  if (msg === "not_in_team") return "No estás en un equipo de butacas para esta lectura.";
  if (msg === "not_leader") return "Solo el líder del equipo puede activar el reloj.";
  if (msg === "no_content") return "Aún no hay lecturas generadas para este grupo.";
  if (msg === "already_started") return "El reloj ya está corriendo. Ya no se puede cambiar de líder.";
  if (msg === "invalid_leader") return "Elige a alguien de tu mismo equipo.";
  return "No se pudo actualizar la lectura.";
}
