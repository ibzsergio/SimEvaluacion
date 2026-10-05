import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { COLUMN_LETTERS, loadSeatingBuckets } from "./lecturaSession.js";

export const TORRE_MINUTES = 45;

export type TorreMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
};

export type TorreTeam = {
  key: string;
  readingIndex: number;
  colorName: string;
  hex: string;
  columna: string;
  members: TorreMember[];
  leaderId: string | null;
  leaderName: string | null;
  startedAt: string | null;
};

export type TorreSession = {
  groupId: string;
  groupCode: string;
  released: boolean;
  releasedAt: string | null;
  paused: boolean;
  pausedAt: string | null;
  minutes: number;
  teamCount: number;
  teams: TorreTeam[];
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

function hydrateTeams(
  buckets: Awaited<ReturnType<typeof loadSeatingBuckets>>["buckets"],
  stored: StoredPayload,
): TorreTeam[] {
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
    const leaderStillInTeam = prev?.leaderId
      ? members.some((m) => m.studentId === prev.leaderId)
      : false;
    const leaderId = leaderStillInTeam ? prev!.leaderId : null;
    const leaderName = leaderId ? (members.find((m) => m.studentId === leaderId)?.displayName ?? null) : null;
    return {
      key: bucket.key,
      readingIndex: index,
      colorName: bucket.colorName,
      hex: bucket.hex,
      columna: COLUMN_LETTERS[bucket.sortCol - 1] ?? String(bucket.sortCol),
      members,
      leaderId,
      leaderName,
      startedAt: leaderId ? prev?.startedAt ?? null : null,
    };
  });
}

function toPayload(teams: TorreTeam[], pausedAt: string | null): StoredPayload {
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
  teams: TorreTeam[],
  extra: {
    torreReleased?: boolean;
    torreReleasedAt?: Date | null;
    pausedAt?: string | null;
  } = {},
) {
  let pausedAt = extra.pausedAt;
  if (pausedAt === undefined) {
    const current = await prisma.classGroup.findUnique({
      where: { id: groupId },
      select: { torrePayload: true },
    });
    pausedAt = parsePayload(current?.torrePayload).pausedAt;
  }
  const payload = JSON.parse(JSON.stringify(toPayload(teams, pausedAt ?? null))) as Prisma.InputJsonValue;
  await prisma.classGroup.update({
    where: { id: groupId },
    data: {
      torrePayload: payload,
      ...(extra.torreReleased !== undefined ? { torreReleased: extra.torreReleased } : {}),
      ...(extra.torreReleasedAt !== undefined ? { torreReleasedAt: extra.torreReleasedAt } : {}),
    },
  });
  if (pausedAt) {
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `torrePayload` = JSON_SET(`torrePayload`, '$.pausedAt', ?) WHERE `id` = ?",
      pausedAt,
      groupId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `torrePayload` = JSON_REMOVE(`torrePayload`, '$.pausedAt') WHERE `id` = ?",
      groupId,
    );
  }
}

export async function getTorreSession(groupId: string): Promise<TorreSession | null> {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      code: true,
      teacherId: true,
      torreReleased: true,
      torreReleasedAt: true,
      torrePayload: true,
    },
  });
  if (!group) return null;
  const { buckets } = await loadSeatingBuckets(groupId, group.code, group.teacherId);
  const stored = parsePayload(group.torrePayload);
  const teams = hydrateTeams(buckets, stored);
  return {
    groupId: group.id,
    groupCode: group.code,
    released: group.torreReleased ?? false,
    releasedAt: group.torreReleasedAt ? group.torreReleasedAt.toISOString() : null,
    paused: Boolean(stored.pausedAt),
    pausedAt: stored.pausedAt,
    minutes: TORRE_MINUTES,
    teamCount: teams.length,
    teams,
  };
}

export async function setTorreReleased(groupId: string, released: boolean) {
  const session = await getTorreSession(groupId);
  if (!session) return null;
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { teacherId: true, code: true },
  });
  if (!group) return null;
  await persist(groupId, session.teams, {
    torreReleased: released,
    torreReleasedAt: released ? new Date() : null,
  });
  if (released) {
    const existing = await prisma.announcement.findFirst({
      where: { teacherId: group.teacherId, title: "Nueva actividad: Torre Tkinter" },
      orderBy: { createdAt: "desc" },
    });
    if (!existing || Date.now() - existing.createdAt.getTime() > 12 * 60 * 60 * 1000) {
      await prisma.announcement.create({
        data: {
          teacherId: group.teacherId,
          groupId,
          title: "Nueva actividad: Torre Tkinter",
          body: `Grupo ${group.code}: construyan la torre más alta con popotes y pegamento. Cada nivel lleva banderillas de papel de color con palabras de Tkinter. En la cima, una bandera que diga Tkinter. Al acabarse los 45 minutos: levanten las manos y no sigan construyendo. El ganador obtiene 1000 puntos por integrante.`,
        },
      });
    }
  }
  return getTorreSession(groupId);
}

export async function resetTorreSession(groupId: string) {
  const session = await getTorreSession(groupId);
  if (!session) return null;
  const teams = session.teams.map((t) => ({ ...t, leaderId: null, leaderName: null, startedAt: null }));
  await persist(groupId, teams, { pausedAt: null });
  return getTorreSession(groupId);
}

export async function setTorrePaused(groupId: string, paused: boolean) {
  const session = await getTorreSession(groupId);
  if (!session) return null;
  if (paused) {
    if (session.pausedAt) return session;
    await persist(groupId, session.teams, { pausedAt: new Date().toISOString() });
    return getTorreSession(groupId);
  }
  if (!session.pausedAt) return session;
  const pauseMs = Date.now() - new Date(session.pausedAt).getTime();
  const teams = session.teams.map((t) => {
    if (!t.startedAt) return t;
    const shifted = new Date(new Date(t.startedAt).getTime() + Math.max(0, pauseMs)).toISOString();
    return { ...t, startedAt: shifted };
  });
  await persist(groupId, teams, { pausedAt: null });
  return getTorreSession(groupId);
}

export function studentTorreAssignment(session: TorreSession, studentId: string) {
  if (!session.released) return null;
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) return null;
  const me = team.members.find((m) => m.studentId === studentId)!;
  return {
    minutes: session.minutes,
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

export async function chooseTorreLeader(groupId: string, studentId: string, nomineeId: string) {
  const session = await getTorreSession(groupId);
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
  return getTorreSession(groupId);
}

export async function startTorreTimer(groupId: string, studentId: string) {
  const session = await getTorreSession(groupId);
  if (!session?.released) throw new Error("not_released");
  if (session.paused) throw new Error("paused");
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) throw new Error("not_in_team");
  if (team.leaderId !== studentId) throw new Error("not_leader");
  if (team.startedAt) return session;
  const startedAt = new Date().toISOString();
  const teams = session.teams.map((t) => (t.key === team.key ? { ...t, startedAt } : t));
  await persist(groupId, teams, { pausedAt: session.pausedAt });
  return getTorreSession(groupId);
}

export function torreErrorHttp(msg: string) {
  if (msg === "not_released" || msg === "not_in_team" || msg === "not_leader" || msg === "paused") {
    return { status: 403 as const, error: msg, message: torreErrorMessage(msg) };
  }
  if (msg === "already_started") {
    return { status: 409 as const, error: msg, message: torreErrorMessage(msg) };
  }
  if (msg === "invalid_leader") {
    return { status: 400 as const, error: msg, message: torreErrorMessage(msg) };
  }
  return { status: 500 as const, error: "torre_failed", message: "No se pudo actualizar el reto de la torre." };
}

function torreErrorMessage(msg: string) {
  if (msg === "not_released") return "El docente aún no libera la actividad.";
  if (msg === "not_in_team") return "No estás en un equipo de butacas para este reto.";
  if (msg === "not_leader") return "Solo el líder del equipo puede activar el reloj.";
  if (msg === "paused") return "El docente pausó el reto. El reloj está congelado.";
  if (msg === "already_started") return "El reloj ya está corriendo. Ya no se puede cambiar de líder.";
  if (msg === "invalid_leader") return "Elige a alguien de tu mismo equipo.";
  return "No se pudo actualizar el reto de la torre.";
}
