import { prisma } from "./prisma.js";
import { COLUMN_LETTERS, loadSeatingBuckets } from "./lecturaSession.js";
import { COLUMN_PALETTE } from "./seatingService.js";

export const EXTRA_MINUTES = 50;
export const EXTRA_ANNOUNCEMENT_TITLE = "Nueva actividad: ¡EXTRA, EXTRA!";

export type ExtraMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  role?: string | null;
};

export type ExtraTeam = {
  key: string;
  readingIndex: number;
  colorName: string;
  hex: string;
  columna: string;
  name: string;
  members: ExtraMember[];
  leaderId: string | null;
  leaderName: string | null;
  startedAt: string | null;
};

export type ExtraSession = {
  groupId: string;
  groupCode: string;
  rosterMode: "project" | "seating";
  released: boolean;
  releasedAt: string | null;
  paused: boolean;
  pausedAt: string | null;
  minutes: number;
  teamCount: number;
  teams: ExtraTeam[];
};

type StoredTeamState = {
  key: string;
  leaderId: string | null;
  startedAt: string | null;
};

type StoredPayload = {
  teams: StoredTeamState[];
  pausedAt: string | null;
};

function parsePayload(raw: unknown): StoredPayload {
  if (!raw || typeof raw !== "object") return { teams: [], pausedAt: null };
  const data = raw as StoredPayload;
  const teams = data.teams;
  if (!Array.isArray(teams)) return { teams: [], pausedAt: data.pausedAt ?? null };
  const pausedAt = typeof data.pausedAt === "string" && data.pausedAt ? data.pausedAt : null;
  return {
    pausedAt,
    teams: teams.map((t) => ({
      key: String(t.key ?? ""),
      leaderId: t.leaderId ?? null,
      startedAt: t.startedAt ?? null,
    })),
  };
}

function resolveLeader(
  members: ExtraMember[],
  storedLeaderId: string | null | undefined,
  fallbackLeaderId: string | null | undefined,
) {
  const pick =
    (storedLeaderId && members.some((m) => m.studentId === storedLeaderId) ? storedLeaderId : null) ??
    (fallbackLeaderId && members.some((m) => m.studentId === fallbackLeaderId) ? fallbackLeaderId : null);
  return {
    leaderId: pick,
    leaderName: pick ? (members.find((m) => m.studentId === pick)?.displayName ?? null) : null,
  };
}

function hydrateSeatingTeams(
  buckets: Awaited<ReturnType<typeof loadSeatingBuckets>>["buckets"],
  stored: StoredPayload,
): ExtraTeam[] {
  const byKey = new Map(stored.teams.map((t) => [t.key, t]));
  return buckets.map((bucket, index) => {
    const prev = byKey.get(bucket.key);
    const members = [...bucket.members]
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map((m) => ({
        studentId: m.studentId,
        displayName: m.displayName,
        listNumber: m.listNumber,
      }));
    const { leaderId, leaderName } = resolveLeader(members, prev?.leaderId, null);
    const letter = COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol);
    return {
      key: bucket.key,
      readingIndex: index,
      colorName: bucket.colorName,
      hex: bucket.hex,
      columna: letter,
      name: `${bucket.colorName} · ${letter}`,
      members,
      leaderId,
      leaderName,
      startedAt: leaderId ? prev?.startedAt ?? null : null,
    };
  });
}

function hydrateProjectTeams(
  projectTeams: Array<{
    id: string;
    name: string;
    leaderId: string | null;
    members: Array<{
      studentId: string;
      role: string;
      student: { displayName: string; listNumber: number | null };
    }>;
  }>,
  stored: StoredPayload,
): ExtraTeam[] {
  const byKey = new Map(stored.teams.map((t) => [t.key, t]));
  return projectTeams.map((team, index) => {
    const key = `project:${team.id}`;
    const prev = byKey.get(key);
    const swatch = COLUMN_PALETTE[index % COLUMN_PALETTE.length]!;
    const members = team.members.map((m) => ({
      studentId: m.studentId,
      displayName: m.student.displayName,
      listNumber: m.student.listNumber,
      role: m.role,
    }));
    const { leaderId, leaderName } = resolveLeader(members, prev?.leaderId, team.leaderId);
    return {
      key,
      readingIndex: index,
      colorName: swatch.name,
      hex: swatch.hex,
      columna: team.name,
      name: team.name,
      members,
      leaderId,
      leaderName,
      startedAt: leaderId ? prev?.startedAt ?? null : null,
    };
  });
}

async function loadProjectTeams(groupId: string) {
  return prisma.projectTeam.findMany({
    where: { groupId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    include: {
      members: {
        include: {
          student: { select: { displayName: true, listNumber: true } },
        },
      },
    },
  });
}

function toPayload(teams: ExtraTeam[], pausedAt: string | null): StoredPayload {
  return {
    pausedAt,
    teams: teams.map((t) => ({
      key: t.key,
      leaderId: t.leaderId,
      startedAt: t.startedAt,
    })),
  };
}

async function persist(
  groupId: string,
  teams: ExtraTeam[],
  extra: {
    extraReleased?: boolean;
    extraReleasedAt?: Date | null;
    pausedAt?: string | null;
  } = {},
) {
  const rows = await prisma.$queryRaw<Array<{ extraPayload: unknown }>>`
    SELECT extraPayload FROM ClassGroup WHERE id = ${groupId}
  `;
  const current = parsePayload(rows[0]?.extraPayload);
  const pausedAt = extra.pausedAt === undefined ? current.pausedAt : extra.pausedAt;
  const payload = JSON.stringify(toPayload(teams, pausedAt ?? null));
  if (extra.extraReleased !== undefined) {
    const releasedAt = extra.extraReleasedAt ?? (extra.extraReleased ? new Date() : null);
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `extraPayload` = ?, `extraReleased` = ?, `extraReleasedAt` = ? WHERE `id` = ?",
      payload,
      extra.extraReleased ? 1 : 0,
      releasedAt,
      groupId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `extraPayload` = ? WHERE `id` = ?",
      payload,
      groupId,
    );
  }
}

export async function getExtraSession(groupId: string): Promise<ExtraSession | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      teacherId: string;
      extraReleased: number | boolean | null;
      extraReleasedAt: Date | string | null;
      extraPayload: unknown;
    }>
  >`
    SELECT id, code, teacherId, extraReleased, extraReleasedAt, extraPayload
    FROM ClassGroup WHERE id = ${groupId}
  `;
  const group = rows[0];
  if (!group) return null;
  const stored = parsePayload(group.extraPayload);
  const code = group.code.trim();
  const useProject = code === "301";
  let teams: ExtraTeam[] = [];
  let rosterMode: ExtraSession["rosterMode"] = "seating";
  if (useProject) {
    rosterMode = "project";
    const projectTeams = await loadProjectTeams(groupId);
    teams = hydrateProjectTeams(projectTeams, stored);
  } else {
    const { buckets } = await loadSeatingBuckets(groupId, group.code, group.teacherId);
    teams = hydrateSeatingTeams(buckets, stored);
  }
  const releasedAt =
    group.extraReleasedAt instanceof Date
      ? group.extraReleasedAt.toISOString()
      : group.extraReleasedAt
        ? String(group.extraReleasedAt)
        : null;
  return {
    groupId: group.id,
    groupCode: group.code,
    rosterMode,
    released: Boolean(group.extraReleased),
    releasedAt,
    paused: Boolean(stored.pausedAt),
    pausedAt: stored.pausedAt,
    minutes: EXTRA_MINUTES,
    teamCount: teams.length,
    teams,
  };
}

export async function setExtraReleased(groupId: string, released: boolean) {
  const session = await getExtraSession(groupId);
  if (!session) return null;
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { teacherId: true, code: true },
  });
  if (!group) return null;
  await persist(groupId, session.teams, {
    extraReleased: released,
    extraReleasedAt: released ? new Date() : null,
  });
  if (released) {
    const existing = await prisma.announcement.findFirst({
      where: { teacherId: group.teacherId, title: EXTRA_ANNOUNCEMENT_TITLE },
      orderBy: { createdAt: "desc" },
    });
    if (!existing || Date.now() - existing.createdAt.getTime() > 12 * 60 * 60 * 1000) {
      await prisma.announcement.create({
        data: {
          teacherId: group.teacherId,
          groupId,
          title: EXTRA_ANNOUNCEMENT_TITLE,
          body: `Grupo ${group.code}: en 50 minutos armen la portada de un periódico o revista que anuncie el LANZAMIENTO de su aplicación de escritorio en Python + Tkinter (nombre de la app, quién la usa y qué problema del plantel o de la vida diaria resuelve). No es una app de celular ni un objeto. Usen cartulina, hojas de color, pegamento, diurex, periódico y/o revistas. ${group.code.trim() === "301" ? "Usan los equipos de proyecto (Roles / Equipos): cada equipo anuncia SU app del semestre." : "Usan su columna de butacas: se ponen de acuerdo en UNA sola app Tkinter."} Eligen líder; el líder arranca el reloj. Al acabar: manos arriba, no sigan pegando. Gana la portada más clara, creativa y que no se desarme.`,
        },
      });
    }
  }
  return getExtraSession(groupId);
}

export async function resetExtraSession(groupId: string) {
  const session = await getExtraSession(groupId);
  if (!session) return null;
  const teams = session.teams.map((t) => ({ ...t, leaderId: null, leaderName: null, startedAt: null }));
  await persist(groupId, teams, { pausedAt: null });
  return getExtraSession(groupId);
}

export async function setExtraPaused(groupId: string, paused: boolean) {
  const session = await getExtraSession(groupId);
  if (!session) return null;
  if (paused) {
    if (session.pausedAt) return session;
    await persist(groupId, session.teams, { pausedAt: new Date().toISOString() });
    return getExtraSession(groupId);
  }
  if (!session.pausedAt) return session;
  const pauseMs = Date.now() - new Date(session.pausedAt).getTime();
  const teams = session.teams.map((t) => {
    if (!t.startedAt) return t;
    const shifted = new Date(new Date(t.startedAt).getTime() + Math.max(0, pauseMs)).toISOString();
    return { ...t, startedAt: shifted };
  });
  await persist(groupId, teams, { pausedAt: null });
  return getExtraSession(groupId);
}

export function studentExtraAssignment(session: ExtraSession, studentId: string) {
  if (!session.released) return null;
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) return null;
  const me = team.members.find((m) => m.studentId === studentId)!;
  return {
    minutes: session.minutes,
    rosterMode: session.rosterMode,
    teamName: team.name,
    colorName: team.colorName,
    hex: team.hex,
    columna: team.columna,
    displayName: me.displayName,
    isLeader: team.leaderId === studentId,
    leaderId: team.leaderId,
    leaderName: team.leaderName,
    startedAt: team.startedAt,
    pausedAt: session.pausedAt,
    members: team.members,
  };
}

export async function chooseExtraLeader(groupId: string, studentId: string, nomineeId: string) {
  const session = await getExtraSession(groupId);
  if (!session?.released) throw new Error("not_released");
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
  await persist(groupId, teams);
  return getExtraSession(groupId);
}

export async function startExtraTimer(groupId: string, studentId: string) {
  const session = await getExtraSession(groupId);
  if (!session?.released) throw new Error("not_released");
  if (session.paused) throw new Error("paused");
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) throw new Error("not_in_team");
  if (team.leaderId !== studentId) throw new Error("not_leader");
  if (team.startedAt) return session;
  const startedAt = new Date().toISOString();
  const teams = session.teams.map((t) => (t.key === team.key ? { ...t, startedAt } : t));
  await persist(groupId, teams, { pausedAt: session.pausedAt });
  return getExtraSession(groupId);
}

export function extraErrorHttp(msg: string) {
  if (msg === "not_released" || msg === "not_in_team" || msg === "not_leader" || msg === "paused") {
    return { status: 403 as const, error: msg, message: extraErrorMessage(msg) };
  }
  if (msg === "already_started") {
    return { status: 409 as const, error: msg, message: extraErrorMessage(msg) };
  }
  if (msg === "invalid_leader") {
    return { status: 400 as const, error: msg, message: extraErrorMessage(msg) };
  }
  return { status: 500 as const, error: "extra_failed", message: "No se pudo actualizar ¡EXTRA, EXTRA!" };
}

function extraErrorMessage(msg: string) {
  if (msg === "not_released") return "El docente aún no libera la actividad.";
  if (msg === "not_in_team") return "No estás en un equipo de este reto (proyecto en 301, columna de butacas en 302).";
  if (msg === "not_leader") return "Solo el líder del equipo puede activar el reloj.";
  if (msg === "paused") return "El docente pausó el reto. El reloj está congelado.";
  if (msg === "already_started") return "El reloj ya está corriendo. Ya no se puede cambiar de líder.";
  if (msg === "invalid_leader") return "Elige a alguien de tu mismo equipo.";
  return "No se pudo actualizar ¡EXTRA, EXTRA!";
}
