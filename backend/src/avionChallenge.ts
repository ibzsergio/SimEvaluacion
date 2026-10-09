import { prisma } from "./prisma.js";
import { COLUMN_LETTERS, loadSeatingBuckets } from "./lecturaSession.js";
import { PREVIEW_CONTROL_NUMBER } from "./previewConstants.js";

export const AVION_MINUTES = 45;
export const PREVIEW_TEAM_KEY = "preview";

export type AvionMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
};

export type AvionTeam = {
  key: string;
  readingIndex: number;
  colorName: string;
  hex: string;
  columna: string;
  members: AvionMember[];
  leaderId: string | null;
  leaderName: string | null;
  startedAt: string | null;
  preview?: boolean;
};

export type AvionSession = {
  groupId: string;
  groupCode: string;
  released: boolean;
  releasedAt: string | null;
  paused: boolean;
  pausedAt: string | null;
  minutes: number;
  teamCount: number;
  teams: AvionTeam[];
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
  previewMember: AvionMember | null,
): AvionTeam[] {
  const byKey = new Map(stored.teams.map((t) => [t.key, t]));
  const teams: AvionTeam[] = buckets.map((bucket, index) => {
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

  if (previewMember) {
    const prev = byKey.get(PREVIEW_TEAM_KEY);
    const leaderId = prev?.leaderId === previewMember.studentId ? prev.leaderId : null;
    teams.push({
      key: PREVIEW_TEAM_KEY,
      readingIndex: teams.length,
      colorName: "Prueba",
      hex: "#22d3ee",
      columna: "P",
      members: [previewMember],
      leaderId,
      leaderName: leaderId ? previewMember.displayName : null,
      startedAt: leaderId ? prev?.startedAt ?? null : null,
      preview: true,
    });
  }

  return teams;
}

function toPayload(teams: AvionTeam[], pausedAt: string | null): StoredPayload {
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
  teams: AvionTeam[],
  extra: {
    avionReleased?: boolean;
    avionReleasedAt?: Date | null;
    pausedAt?: string | null;
  } = {},
) {
  let pausedAt = extra.pausedAt;
  if (pausedAt === undefined) {
    const rows = await prisma.$queryRaw<Array<{ avionPayload: unknown }>>`
      SELECT avionPayload FROM ClassGroup WHERE id = ${groupId}
    `;
    pausedAt = parsePayload(rows[0]?.avionPayload).pausedAt;
  }
  const payload = JSON.stringify(toPayload(teams, pausedAt ?? null));
  if (extra.avionReleased !== undefined) {
    const releasedAt = extra.avionReleasedAt ?? (extra.avionReleased ? new Date() : null);
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `avionPayload` = ?, `avionReleased` = ?, `avionReleasedAt` = ? WHERE `id` = ?",
      payload,
      extra.avionReleased ? 1 : 0,
      releasedAt,
      groupId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `avionPayload` = ? WHERE `id` = ?",
      payload,
      groupId,
    );
  }
  if (pausedAt) {
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `avionPayload` = JSON_SET(`avionPayload`, '$.pausedAt', ?) WHERE `id` = ?",
      pausedAt,
      groupId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `avionPayload` = JSON_REMOVE(`avionPayload`, '$.pausedAt') WHERE `id` = ?",
      groupId,
    );
  }
}

async function loadPreviewMember(teacherId: string): Promise<AvionMember | null> {
  const user = await prisma.user.findUnique({
    where: { controlNumber: PREVIEW_CONTROL_NUMBER },
    select: {
      id: true,
      displayName: true,
      listNumber: true,
      group: { select: { teacherId: true } },
    },
  });
  if (!user || user.group?.teacherId !== teacherId) return null;
  return { studentId: user.id, displayName: user.displayName, listNumber: user.listNumber };
}

export async function getAvionSession(groupId: string): Promise<AvionSession | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      teacherId: string;
      avionReleased: number | boolean | null;
      avionReleasedAt: Date | string | null;
      avionPayload: unknown;
    }>
  >`
    SELECT id, code, teacherId, avionReleased, avionReleasedAt, avionPayload
    FROM ClassGroup WHERE id = ${groupId}
  `;
  const group = rows[0];
  if (!group) return null;
  const { buckets } = await loadSeatingBuckets(groupId, group.code, group.teacherId);
  const stored = parsePayload(group.avionPayload);
  const previewMember = await loadPreviewMember(group.teacherId);
  const teams = hydrateTeams(buckets, stored, previewMember);
  const releasedAt =
    group.avionReleasedAt instanceof Date
      ? group.avionReleasedAt.toISOString()
      : group.avionReleasedAt
        ? String(group.avionReleasedAt)
        : null;
  return {
    groupId: group.id,
    groupCode: group.code,
    released: Boolean(group.avionReleased),
    releasedAt,
    paused: Boolean(stored.pausedAt),
    pausedAt: stored.pausedAt,
    minutes: AVION_MINUTES,
    teamCount: teams.filter((t) => !t.preview).length,
    teams,
  };
}

export async function setAvionReleased(groupId: string, released: boolean) {
  const session = await getAvionSession(groupId);
  if (!session) return null;
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { teacherId: true, code: true },
  });
  if (!group) return null;
  await persist(groupId, session.teams, {
    avionReleased: released,
    avionReleasedAt: released ? new Date() : null,
  });
  if (released) {
    const existing = await prisma.announcement.findFirst({
      where: { teacherId: group.teacherId, title: "Nueva actividad: Sprint aéreo" },
      orderBy: { createdAt: "desc" },
    });
    if (!existing || Date.now() - existing.createdAt.getTime() > 12 * 60 * 60 * 1000) {
      await prisma.announcement.create({
        data: {
          teacherId: group.teacherId,
          groupId,
          title: "Nueva actividad: Sprint aéreo",
          body: `Grupo ${group.code}: construyan un avión fuerte (cascarón o ilustración, palillos, palos de paleta y silicón frío) que vuele lo más lejos posible y no se desarme. Elijan un nombre de equipo y pónganlo en el avión. Cada integrante toma su rol Scrum, pero todos construyen. El líder activa 45 minutos. Al acabar: manos arriba. Se califica distancia, resistencia, nombre y diseño.`,
        },
      });
    }
  }
  return getAvionSession(groupId);
}

export async function resetAvionSession(groupId: string) {
  const session = await getAvionSession(groupId);
  if (!session) return null;
  const teams = session.teams.map((t) => ({ ...t, leaderId: null, leaderName: null, startedAt: null }));
  await persist(groupId, teams, { pausedAt: null });
  return getAvionSession(groupId);
}

export async function setAvionPaused(groupId: string, paused: boolean) {
  const session = await getAvionSession(groupId);
  if (!session) return null;
  if (paused) {
    if (session.pausedAt) return session;
    await persist(groupId, session.teams, { pausedAt: new Date().toISOString() });
    return getAvionSession(groupId);
  }
  if (!session.pausedAt) return session;
  const pauseMs = Date.now() - new Date(session.pausedAt).getTime();
  const teams = session.teams.map((t) => {
    if (!t.startedAt) return t;
    const shifted = new Date(new Date(t.startedAt).getTime() + Math.max(0, pauseMs)).toISOString();
    return { ...t, startedAt: shifted };
  });
  await persist(groupId, teams, { pausedAt: null });
  return getAvionSession(groupId);
}

export function studentAvionAssignment(session: AvionSession, studentId: string, preview: boolean) {
  const team = preview
    ? session.teams.find((t) => t.key === PREVIEW_TEAM_KEY)
    : session.released
      ? session.teams.find((t) => !t.preview && t.members.some((m) => m.studentId === studentId))
      : null;
  if (!team) return null;
  const me = team.members.find((m) => m.studentId === studentId);
  if (!me) return null;
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
    preview: Boolean(team.preview),
  };
}

function teamForStudent(session: AvionSession, studentId: string) {
  return session.teams.find((t) => t.members.some((m) => m.studentId === studentId)) ?? null;
}

export async function chooseAvionLeader(groupId: string, studentId: string, nomineeId: string) {
  const session = await getAvionSession(groupId);
  if (!session) throw new Error("not_released");
  const team = teamForStudent(session, studentId);
  if (!team) throw new Error("not_in_team");
  if (!session.released && !team.preview) throw new Error("not_released");
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
  return getAvionSession(groupId);
}

export async function startAvionTimer(groupId: string, studentId: string) {
  const session = await getAvionSession(groupId);
  if (!session) throw new Error("not_released");
  if (session.paused) throw new Error("paused");
  const team = teamForStudent(session, studentId);
  if (!team) throw new Error("not_in_team");
  if (!session.released && !team.preview) throw new Error("not_released");
  if (team.leaderId !== studentId) throw new Error("not_leader");
  if (team.startedAt) return session;
  const startedAt = new Date().toISOString();
  const teams = session.teams.map((t) => (t.key === team.key ? { ...t, startedAt } : t));
  await persist(groupId, teams, { pausedAt: session.pausedAt });
  return getAvionSession(groupId);
}

export function avionErrorHttp(msg: string) {
  if (msg === "not_released" || msg === "not_in_team" || msg === "not_leader" || msg === "paused") {
    return { status: 403 as const, error: msg, message: avionErrorMessage(msg) };
  }
  if (msg === "already_started") {
    return { status: 409 as const, error: msg, message: avionErrorMessage(msg) };
  }
  if (msg === "invalid_leader") {
    return { status: 400 as const, error: msg, message: avionErrorMessage(msg) };
  }
  return { status: 500 as const, error: "avion_failed", message: "No se pudo actualizar el Sprint aéreo." };
}

function avionErrorMessage(msg: string) {
  if (msg === "not_released") return "El docente aún no libera la actividad.";
  if (msg === "not_in_team") return "No estás en un equipo para este reto.";
  if (msg === "not_leader") return "Solo el líder del equipo puede activar el reloj.";
  if (msg === "paused") return "El docente pausó el reto. El reloj está congelado.";
  if (msg === "already_started") return "El reloj ya está corriendo. Ya no se puede cambiar de líder.";
  if (msg === "invalid_leader") return "Elige a alguien de tu mismo equipo.";
  return "No se pudo actualizar el Sprint aéreo.";
}
