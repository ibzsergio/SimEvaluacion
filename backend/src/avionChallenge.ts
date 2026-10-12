import { prisma } from "./prisma.js";
import { COLUMN_LETTERS, exclusionForLectura, loadSeatingBuckets } from "./lecturaSession.js";
import { isPreviewControlNumber, PREVIEW_CONTROL_NUMBER } from "./previewConstants.js";
import { COLUMN_PALETTE } from "./seatingService.js";

export const AVION_MINUTES = 45;
export const PREVIEW_TEAM_KEY = "preview";

export const AVION_SLOTS = COLUMN_PALETTE.map((c, i) => ({
  key: `avion:${i + 1}`,
  colorName: c.name,
  hex: c.hex,
  columna: COLUMN_LETTERS[i] ?? String(i + 1),
}));

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

export type AvionAssignment = AvionMember & { teamKey: string };

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
  rosterMode: "custom" | "seating";
  slots: typeof AVION_SLOTS;
  assignments: AvionAssignment[];
  skipped: Array<{ displayName: string; reason: "baja" | "incapacidad" }>;
};

type StoredTeamState = {
  key: string;
  leaderId: string | null;
  startedAt: string | null;
};

type StoredCustomTeam = {
  key: string;
  memberIds: string[];
};

type StoredPayload = {
  teams: StoredTeamState[];
  pausedAt: string | null;
  customTeams: StoredCustomTeam[] | null;
};

function parsePayload(raw: unknown): StoredPayload {
  if (!raw || typeof raw !== "object") return { teams: [], pausedAt: null, customTeams: null };
  const data = raw as StoredPayload;
  const teams = data.teams;
  const pausedAt = typeof data.pausedAt === "string" && data.pausedAt ? data.pausedAt : null;
  const customRaw = data.customTeams;
  const customTeams = Array.isArray(customRaw)
    ? customRaw
        .map((t) => ({
          key: String(t?.key ?? ""),
          memberIds: Array.isArray(t?.memberIds) ? t.memberIds.map((id) => String(id)).filter(Boolean) : [],
        }))
        .filter((t) => t.key)
    : null;
  if (!Array.isArray(teams)) return { teams: [], pausedAt, customTeams };
  return {
    pausedAt,
    customTeams,
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

function toPayload(
  teams: AvionTeam[],
  pausedAt: string | null,
  customTeams: StoredCustomTeam[] | null,
): StoredPayload {
  return {
    pausedAt,
    customTeams,
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
    customTeams?: StoredCustomTeam[] | null;
  } = {},
) {
  const rows = await prisma.$queryRaw<Array<{ avionPayload: unknown }>>`
    SELECT avionPayload FROM ClassGroup WHERE id = ${groupId}
  `;
  const current = parsePayload(rows[0]?.avionPayload);
  const pausedAt = extra.pausedAt === undefined ? current.pausedAt : extra.pausedAt;
  const customTeams = extra.customTeams === undefined ? current.customTeams : extra.customTeams;
  const payload = JSON.stringify(toPayload(teams, pausedAt ?? null, customTeams));
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

async function loadAssignableStudents(groupId: string, groupCode: string) {
  const rows = await prisma.user.findMany({
    where: { groupId, role: "STUDENT" },
    select: { id: true, displayName: true, listNumber: true, controlNumber: true },
    orderBy: [{ listNumber: "asc" }, { displayName: "asc" }],
  });
  const skipped: AvionSession["skipped"] = [];
  const assignable: AvionMember[] = [];
  for (const row of rows) {
    if (isPreviewControlNumber(row.controlNumber)) continue;
    const reason = exclusionForLectura(groupCode, row.displayName);
    if (reason) {
      skipped.push({ displayName: row.displayName, reason });
      continue;
    }
    assignable.push({
      studentId: row.id,
      displayName: row.displayName,
      listNumber: row.listNumber,
    });
  }
  return { assignable, skipped };
}

function slotForTeam(team: AvionTeam) {
  return (
    AVION_SLOTS.find((s) => s.key === team.key) ??
    AVION_SLOTS.find((s) => s.colorName === team.colorName) ??
    AVION_SLOTS.find((s) => s.columna === team.columna) ??
    AVION_SLOTS[team.readingIndex] ??
    null
  );
}

function buildAssignments(assignable: AvionMember[], teams: AvionTeam[]): AvionAssignment[] {
  const teamKeyByStudent = new Map<string, string>();
  for (const team of teams) {
    if (team.preview) continue;
    const slot = slotForTeam(team);
    if (!slot) continue;
    for (const member of team.members) teamKeyByStudent.set(member.studentId, slot.key);
  }
  return assignable.map((s) => ({
    ...s,
    teamKey: teamKeyByStudent.get(s.studentId) ?? "",
  }));
}

function customBuckets(
  customTeams: StoredCustomTeam[],
  assignable: AvionMember[],
): Awaited<ReturnType<typeof loadSeatingBuckets>>["buckets"] {
  const byId = new Map(assignable.map((s) => [s.studentId, s]));
  const used = new Set<string>();
  return AVION_SLOTS.map((slot, index) => {
    const stored = customTeams.find((t) => t.key === slot.key);
    const members = (stored?.memberIds ?? [])
      .map((id) => byId.get(id))
      .filter((m): m is AvionMember => {
        if (!m) return false;
        return !used.has(m.studentId);
      })
      .map((m, row) => {
        used.add(m.studentId);
        return {
          studentId: m.studentId,
          displayName: m.displayName,
          listNumber: m.listNumber,
          row: row + 1,
          col: index + 1,
        };
      });
    return {
      key: slot.key,
      sortCol: index + 1,
      sortRow: 1,
      colorName: slot.colorName,
      hex: slot.hex,
      members,
    };
  }).filter((b) => b.members.length > 0);
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
  const stored = parsePayload(group.avionPayload);
  const { assignable, skipped } = await loadAssignableStudents(group.id, group.code);
  const previewMember = await loadPreviewMember(group.teacherId);
  const seating = stored.customTeams
    ? { buckets: customBuckets(stored.customTeams, assignable) }
    : await loadSeatingBuckets(groupId, group.code, group.teacherId);
  const teams = hydrateTeams(seating.buckets, stored, previewMember);
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
    rosterMode: stored.customTeams ? "custom" : "seating",
    slots: AVION_SLOTS,
    assignments: buildAssignments(assignable, teams),
    skipped,
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

export async function setAvionCustomTeams(
  groupId: string,
  input: Array<{ key: string; memberIds: string[] }>,
) {
  const session = await getAvionSession(groupId);
  if (!session) throw new Error("group_not_found");
  const allowedKeys = new Set(AVION_SLOTS.map((s) => s.key));
  const assignable = new Map(session.assignments.map((s) => [s.studentId, s]));
  const seen = new Set<string>();
  const customTeams: StoredCustomTeam[] = AVION_SLOTS.map((slot) => ({ key: slot.key, memberIds: [] }));
  for (const row of input) {
    if (!allowedKeys.has(row.key)) throw new Error("invalid_team");
    const slot = customTeams.find((t) => t.key === row.key)!;
    for (const id of row.memberIds) {
      if (!assignable.has(id)) throw new Error("invalid_students");
      if (seen.has(id)) throw new Error("student_already_in_team");
      seen.add(id);
      slot.memberIds.push(id);
    }
  }
  const preview = session.teams.find((t) => t.preview) ?? null;
  const teams: AvionTeam[] = AVION_SLOTS.flatMap((slot, index) => {
    const memberIds = customTeams.find((t) => t.key === slot.key)?.memberIds ?? [];
    const members = memberIds
      .map((id) => assignable.get(id))
      .filter((m): m is AvionAssignment => Boolean(m))
      .map((m) => ({ studentId: m.studentId, displayName: m.displayName, listNumber: m.listNumber }));
    if (!members.length) return [];
    const old =
      session.teams.find((t) => t.key === slot.key) ??
      session.teams.find((t) => t.colorName === slot.colorName) ??
      null;
    const leaderId = old?.leaderId && members.some((m) => m.studentId === old.leaderId) ? old.leaderId : null;
    return [
      {
        key: slot.key,
        readingIndex: index,
        colorName: slot.colorName,
        hex: slot.hex,
        columna: slot.columna,
        members,
        leaderId,
        leaderName: leaderId ? (members.find((m) => m.studentId === leaderId)?.displayName ?? null) : null,
        startedAt: leaderId ? old?.startedAt ?? null : null,
      },
    ];
  });
  if (preview) teams.push({ ...preview, readingIndex: teams.length });
  await persist(groupId, teams, { customTeams, pausedAt: session.pausedAt });
  return getAvionSession(groupId);
}

export async function clearAvionCustomTeams(groupId: string) {
  const session = await getAvionSession(groupId);
  if (!session) return null;
  const preview = session.teams.find((t) => t.preview);
  await persist(groupId, preview ? [preview] : [], {
    customTeams: null,
    pausedAt: session.pausedAt,
  });
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
  if (
    msg === "invalid_leader" ||
    msg === "invalid_team" ||
    msg === "invalid_students" ||
    msg === "student_already_in_team"
  ) {
    return { status: 400 as const, error: msg, message: avionErrorMessage(msg) };
  }
  if (msg === "group_not_found") {
    return { status: 404 as const, error: msg, message: avionErrorMessage(msg) };
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
  if (msg === "invalid_team") return "Ese color de equipo no es válido.";
  if (msg === "invalid_students") return "Uno o más alumnos no pertenecen a este grupo.";
  if (msg === "student_already_in_team") return "Un alumno no puede estar en dos equipos.";
  if (msg === "group_not_found") return "No se encontró el grupo.";
  return "No se pudo actualizar el Sprint aéreo.";
}
