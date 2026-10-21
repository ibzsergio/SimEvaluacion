import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { ensureImproSchema } from "./ensureImproSchema.js";
import { COLUMN_PALETTE } from "./seatingService.js";

export const IMPRO_MINUTES = 50;
export const IMPRO_FIRMAS_MAX = 1000;
export const IMPRO_ACTIVITY_NAME = "Pop-Up";
export const IMPRO_LEGACY_ACTIVITY_NAME = "Sprint improvisado";
export const IMPRO_ANNOUNCEMENT_TITLE = "Nueva actividad: Pop-Up";

export const IMPRO_NOTE_PRESETS = [
  { code: "ruido", label: "Mucho ruido", points: 100, scope: "team" as const },
  { code: "no_trabaja", label: "No trabaja el equipo", points: 200, scope: "team" as const },
  { code: "fuera_equipo", label: "Integrante fuera del equipo", points: 150, scope: "member" as const },
  { code: "plano", label: "Quedó en cartel plano", points: 200, scope: "team" as const },
  { code: "medida", label: "No llega a 30 × 30 cm", points: 200, scope: "team" as const },
  { code: "fuera_tiempo", label: "Siguen después del tiempo", points: 150, scope: "team" as const },
  { code: "no_opera", label: "El extraño no pudo operarlo", points: 150, scope: "team" as const },
];

export type ImproNote = {
  id: string;
  code: string;
  label: string;
  points: number;
  studentId?: string | null;
  studentName?: string | null;
  at: string;
};

export type ImproMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  role?: string | null;
  firmas: number;
};

export type ImproTeam = {
  key: string;
  readingIndex: number;
  colorName: string;
  hex: string;
  columna: string;
  name: string;
  members: ImproMember[];
  leaderId: string | null;
  leaderName: string | null;
  startedAt: string | null;
  notes: ImproNote[];
  awarded: boolean;
  firmasMax: number;
};

export type ImproSession = {
  groupId: string;
  groupCode: string;
  rosterMode: "project";
  released: boolean;
  releasedAt: string | null;
  paused: boolean;
  pausedAt: string | null;
  minutes: number;
  firmasMax: number;
  activityId: string | null;
  teamCount: number;
  teams: ImproTeam[];
  loadError: string | null;
};

type StoredTeamState = {
  key: string;
  leaderId: string | null;
  startedAt: string | null;
  notes: ImproNote[];
  awarded: boolean;
};

type StoredPayload = {
  teams: StoredTeamState[];
  pausedAt: string | null;
};

function parseNotes(raw: unknown): ImproNote[] {
  if (!Array.isArray(raw)) return [];
  const notes: ImproNote[] = [];
  for (const n of raw) {
    const item = n as ImproNote;
    const points = Math.max(0, Math.round(Number(item.points) || 0));
    const label = String(item.label ?? "").trim();
    if (!label || points <= 0) continue;
    notes.push({
      id: String(item.id ?? `note_${Math.random().toString(36).slice(2, 9)}`),
      code: String(item.code ?? "custom"),
      label,
      points,
      studentId: item.studentId ? String(item.studentId) : null,
      studentName: item.studentName ? String(item.studentName) : null,
      at: typeof item.at === "string" && item.at ? item.at : new Date().toISOString(),
    });
  }
  return notes;
}

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
      notes: parseNotes(t.notes),
      awarded: Boolean(t.awarded),
    })),
  };
}

function memberFirmas(notes: ImproNote[], studentId: string) {
  const cut = notes
    .filter((n) => !n.studentId || n.studentId === studentId)
    .reduce((acc, n) => acc + n.points, 0);
  return Math.max(0, IMPRO_FIRMAS_MAX - cut);
}

function resolveLeader(
  members: ImproMember[],
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

function hydrateProjectTeams(
  projectTeams: Array<{
    id: string;
    name: string;
    leaderId: string | null;
    members: Array<{
      studentId: string;
      role: string;
      student: { displayName: string; listNumber: number | null } | null;
    }>;
  }>,
  stored: StoredPayload,
): ImproTeam[] {
  const byKey = new Map(stored.teams.map((t) => [t.key, t]));
  return projectTeams.map((team, index) => {
    const key = `project:${team.id}`;
    const prev = byKey.get(key);
    const swatch = COLUMN_PALETTE[index % COLUMN_PALETTE.length]!;
    const notes = prev?.notes ?? [];
    const members = team.members.map((m) => ({
      studentId: m.studentId,
      displayName: m.student?.displayName ?? "Alumno",
      listNumber: m.student?.listNumber ?? null,
      role: m.role,
      firmas: memberFirmas(notes, m.studentId),
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
      startedAt: leaderId ? (prev?.startedAt ?? null) : null,
      notes,
      awarded: Boolean(prev?.awarded),
      firmasMax: IMPRO_FIRMAS_MAX,
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

function toPayload(teams: ImproTeam[], pausedAt: string | null): StoredPayload {
  return {
    pausedAt,
    teams: teams.map((t) => ({
      key: t.key,
      leaderId: t.leaderId,
      startedAt: t.startedAt,
      notes: t.notes,
      awarded: t.awarded,
    })),
  };
}

async function persist(
  groupId: string,
  teams: ImproTeam[],
  extra: {
    improReleased?: boolean;
    pausedAt?: string | null;
  } = {},
) {
  const rows = await prisma.$queryRaw<Array<{ improPayload: unknown }>>`
    SELECT improPayload FROM ClassGroup WHERE id = ${groupId}
  `;
  const current = parsePayload(rows[0]?.improPayload);
  const pausedAt = extra.pausedAt === undefined ? current.pausedAt : extra.pausedAt;
  const payload = JSON.stringify(toPayload(teams, pausedAt ?? null));
  if (extra.improReleased !== undefined) {
    await prisma.$executeRawUnsafe(
      extra.improReleased
        ? "UPDATE `ClassGroup` SET `improPayload` = ?, `improReleased` = 1, `improReleasedAt` = NOW(3) WHERE `id` = ?"
        : "UPDATE `ClassGroup` SET `improPayload` = ?, `improReleased` = 0, `improReleasedAt` = NULL WHERE `id` = ?",
      payload,
      groupId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      "UPDATE `ClassGroup` SET `improPayload` = ? WHERE `id` = ?",
      payload,
      groupId,
    );
  }
}

async function findImproActivity(groupId: string) {
  return prisma.activity.findFirst({
    where: { groupId, name: IMPRO_ACTIVITY_NAME },
    orderBy: { createdAt: "desc" },
    select: { id: true, maxPoints: true, releasedToStudents: true },
  });
}

async function ensureImproActivity(groupId: string, teacherId: string, releaseToStudents: boolean) {
  const existing = await findImproActivity(groupId);
  if (existing) {
    const data: { maxPoints?: number; releasedToStudents?: boolean } = {};
    if (existing.maxPoints !== IMPRO_FIRMAS_MAX) data.maxPoints = IMPRO_FIRMAS_MAX;
    if (releaseToStudents && !existing.releasedToStudents) data.releasedToStudents = true;
    if (Object.keys(data).length) {
      await prisma.activity.update({ where: { id: existing.id }, data });
    }
    return existing.id;
  }
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { currentPartial: true },
  });
  const lastOrder = await prisma.activity.aggregate({
    where: { groupId },
    _max: { sortOrder: true },
  });
  const created = await prisma.activity.create({
    data: {
      date: todayClassDayDate(),
      name: IMPRO_ACTIVITY_NAME,
      maxPoints: IMPRO_FIRMAS_MAX,
      signatureMax: 0,
      sortOrder: (lastOrder._max.sortOrder ?? -1) + 1,
      partialNumber: group?.currentPartial ?? 1,
      releasedToStudents: releaseToStudents,
      groupId,
      createdById: teacherId,
    },
    select: { id: true },
  });
  return created.id;
}

async function upsertMemberGrade(params: {
  activityId: string;
  studentId: string;
  teacherId: string;
  points: number;
}) {
  const points = Math.min(IMPRO_FIRMAS_MAX, Math.max(0, Math.round(params.points)));
  const gradedAt = new Date();
  await prisma.grade.upsert({
    where: { activityId_studentId: { activityId: params.activityId, studentId: params.studentId } },
    update: { points, signatures: 0, gradedById: params.teacherId },
    create: {
      activityId: params.activityId,
      studentId: params.studentId,
      points,
      signatures: 0,
      gradedById: params.teacherId,
      gradedAt,
    },
  });
  await prisma.submission.upsert({
    where: { activityId_studentId: { activityId: params.activityId, studentId: params.studentId } },
    update: {},
    create: { activityId: params.activityId, studentId: params.studentId, submittedAt: gradedAt },
  });
}

async function applyTeamFirmas(groupId: string, teacherId: string, team: ImproTeam) {
  const activityId = await ensureImproActivity(groupId, teacherId, true);
  for (const member of team.members) {
    await upsertMemberGrade({
      activityId,
      studentId: member.studentId,
      teacherId,
      points: member.firmas,
    });
  }
}

let legacyRenamed = false;

async function renameLegacyActivity() {
  if (legacyRenamed) return;
  await prisma.activity.updateMany({
    where: { name: IMPRO_LEGACY_ACTIVITY_NAME },
    data: { name: IMPRO_ACTIVITY_NAME },
  });
  legacyRenamed = true;
}

async function readGroupRow(groupId: string) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      teacherId: string;
      improReleased: number | boolean | null;
      improReleasedAt: Date | string | null;
      improPayload: unknown;
    }>
  >`
    SELECT id, code, teacherId, improReleased, improReleasedAt, improPayload
    FROM ClassGroup WHERE id = ${groupId}
  `;
}

export async function getImproSession(groupId: string): Promise<ImproSession | null> {
  let rows: Awaited<ReturnType<typeof readGroupRow>>;
  try {
    rows = await readGroupRow(groupId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/improReleased|improPayload|Unknown column/i.test(msg)) throw err;
    await ensureImproSchema();
    rows = await readGroupRow(groupId);
  }
  const group = rows[0];
  if (!group) return null;
  try {
    await renameLegacyActivity();
  } catch (err) {
    console.warn("[impro] no se pudo renombrar la actividad anterior:", err);
  }
  const released = Boolean(group.improReleased);
  const stored = parsePayload(group.improPayload);
  let teams: ImproTeam[] = [];
  let loadError: string | null = null;
  try {
    const projectTeams = await loadProjectTeams(groupId);
    teams = hydrateProjectTeams(projectTeams, stored);
    if (teams.length === 0) {
      loadError = "Este grupo no tiene equipos en Roles / Equipos.";
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "No se pudieron leer los equipos de proyecto.";
    console.warn("[impro] no se pudieron hidratar equipos de proyecto:", err);
  }
  const activity = await findImproActivity(groupId);
  const releasedAt =
    group.improReleasedAt instanceof Date
      ? group.improReleasedAt.toISOString()
      : group.improReleasedAt
        ? String(group.improReleasedAt)
        : null;
  return {
    groupId: group.id,
    groupCode: group.code,
    rosterMode: "project",
    released,
    releasedAt,
    paused: Boolean(stored.pausedAt),
    pausedAt: stored.pausedAt,
    minutes: IMPRO_MINUTES,
    firmasMax: IMPRO_FIRMAS_MAX,
    activityId: activity?.id ?? null,
    teamCount: teams.length,
    teams,
    loadError,
  };
}

export async function setImproReleased(groupId: string, released: boolean) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { teacherId: true, code: true },
  });
  if (!group) return null;
  const session = await getImproSession(groupId);
  if (!session) return null;
  await persist(groupId, session.teams, { improReleased: released });
  if (released) {
    const existing = await prisma.announcement.findFirst({
      where: { teacherId: group.teacherId, title: IMPRO_ANNOUNCEMENT_TITLE, groupId },
      orderBy: { createdAt: "desc" },
    });
    if (!existing || Date.now() - existing.createdAt.getTime() > 12 * 60 * 60 * 1000) {
      await prisma.announcement.create({
        data: {
          teacherId: group.teacherId,
          groupId,
          title: IMPRO_ANNOUNCEMENT_TITLE,
          body: `Pop-Up para el grupo ${group.code}. Equipos de Roles / Equipos. En cuanto el líder active los 50 minutos, pueden salir a buscar cartón, palos de madera, unicel y lo que haga falta. El pop-up mide mínimo 30 cm de ancho por 30 cm de alto, se para solo y alguien de otro equipo lo opera en 60 segundos. Vale 1000 Firmas.`,
        },
      });
    }
  }
  return getImproSession(groupId);
}

export async function resetImproSession(groupId: string) {
  const session = await getImproSession(groupId);
  if (!session) return null;
  const teams = session.teams.map((t) => ({ ...t, leaderId: null, leaderName: null, startedAt: null }));
  await persist(groupId, teams, { pausedAt: null });
  return getImproSession(groupId);
}

export async function startImproTimers(groupId: string) {
  const session = await getImproSession(groupId);
  if (!session) return null;
  if (session.paused) throw new Error("paused");
  const startedAt = new Date().toISOString();
  const teams = session.teams.map((team) => {
    if (team.startedAt || team.members.length === 0) return team;
    const leaderId = team.leaderId ?? team.members[0]?.studentId ?? null;
    const leaderName = team.members.find((member) => member.studentId === leaderId)?.displayName ?? team.leaderName;
    return { ...team, leaderId, leaderName, startedAt };
  });
  await persist(groupId, teams, { pausedAt: session.pausedAt });
  return getImproSession(groupId);
}

export async function setImproPaused(groupId: string, paused: boolean) {
  const session = await getImproSession(groupId);
  if (!session) return null;
  if (paused) {
    if (session.pausedAt) return session;
    await persist(groupId, session.teams, { pausedAt: new Date().toISOString() });
    return getImproSession(groupId);
  }
  if (!session.pausedAt) return session;
  const pauseMs = Date.now() - new Date(session.pausedAt).getTime();
  const teams = session.teams.map((t) => {
    if (!t.startedAt) return t;
    const shifted = new Date(new Date(t.startedAt).getTime() + Math.max(0, pauseMs)).toISOString();
    return { ...t, startedAt: shifted };
  });
  await persist(groupId, teams, { pausedAt: null });
  return getImproSession(groupId);
}

export async function addImproNote(
  groupId: string,
  teacherId: string,
  input: { teamKey: string; code: string; label?: string; points?: number; studentId?: string | null },
) {
  const session = await getImproSession(groupId);
  if (!session) throw new Error("group_not_found");
  const team = session.teams.find((t) => t.key === input.teamKey);
  if (!team) throw new Error("team_not_found");

  const preset = IMPRO_NOTE_PRESETS.find((p) => p.code === input.code);
  const label = (input.label ?? preset?.label ?? "").trim();
  let points = Math.round(Number(input.points ?? preset?.points ?? 0));
  if (!label || points <= 0) throw new Error("invalid_note");
  if (points > IMPRO_FIRMAS_MAX) points = IMPRO_FIRMAS_MAX;

  let studentId = input.studentId ? String(input.studentId) : null;
  let studentName: string | null = null;
  if (preset?.scope === "member" && !studentId) throw new Error("student_required");
  if (studentId) {
    const member = team.members.find((m) => m.studentId === studentId);
    if (!member) throw new Error("student_not_in_team");
    studentName = member.displayName;
  }

  const note: ImproNote = {
    id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    code: preset?.code ?? "custom",
    label,
    points,
    studentId,
    studentName,
    at: new Date().toISOString(),
  };

  const teams = session.teams.map((t) => {
    if (t.key !== team.key) return t;
    const notes = [...t.notes, note];
    const members = t.members.map((m) => ({ ...m, firmas: memberFirmas(notes, m.studentId) }));
    return { ...t, notes, members };
  });
  const next = teams.find((t) => t.key === team.key)!;
  await persist(groupId, teams);
  if (next.awarded) await applyTeamFirmas(groupId, teacherId, next);
  return getImproSession(groupId);
}

export async function removeImproNote(
  groupId: string,
  teacherId: string,
  input: { teamKey: string; noteId: string },
) {
  const session = await getImproSession(groupId);
  if (!session) throw new Error("group_not_found");
  const team = session.teams.find((t) => t.key === input.teamKey);
  if (!team) throw new Error("team_not_found");
  const teams = session.teams.map((t) => {
    if (t.key !== team.key) return t;
    const notes = t.notes.filter((n) => n.id !== input.noteId);
    const members = t.members.map((m) => ({ ...m, firmas: memberFirmas(notes, m.studentId) }));
    return { ...t, notes, members };
  });
  const next = teams.find((t) => t.key === team.key)!;
  await persist(groupId, teams);
  if (next.awarded) await applyTeamFirmas(groupId, teacherId, next);
  return getImproSession(groupId);
}

export async function applyImproFirmas(groupId: string, teacherId: string, teamKey?: string) {
  const session = await getImproSession(groupId);
  if (!session) throw new Error("group_not_found");
  const targets = teamKey ? session.teams.filter((t) => t.key === teamKey) : session.teams;
  if (teamKey && targets.length === 0) throw new Error("team_not_found");
  const teams = session.teams.map((t) => (targets.some((x) => x.key === t.key) ? { ...t, awarded: true } : t));
  await persist(groupId, teams);
  for (const team of teams.filter((t) => targets.some((x) => x.key === t.key))) {
    await applyTeamFirmas(groupId, teacherId, team);
  }
  return getImproSession(groupId);
}

export function studentImproAssignment(session: ImproSession, studentId: string) {
  if (!session.released) return null;
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  const swatch = COLUMN_PALETTE[0]!;
  if (!team) {
    return {
      minutes: IMPRO_MINUTES,
      rosterMode: session.rosterMode,
      teamName: "Sin equipo asignado",
      colorName: swatch.name,
      hex: swatch.hex,
      columna: "",
      displayName: "",
      role: null,
      isLeader: false,
      leaderId: null,
      leaderName: null,
      startedAt: null,
      pausedAt: session.pausedAt,
      members: [],
      firmasMax: IMPRO_FIRMAS_MAX,
      firmas: null,
      notes: [],
      noTeam: true,
    };
  }
  const me = team.members.find((m) => m.studentId === studentId)!;
  const notes = team.notes.filter((n) => !n.studentId || n.studentId === studentId);
  return {
    minutes: IMPRO_MINUTES,
    rosterMode: session.rosterMode,
    teamName: team.name,
    colorName: team.colorName,
    hex: team.hex,
    columna: team.columna,
    displayName: me.displayName,
    role: me.role ?? null,
    isLeader: team.leaderId === studentId,
    leaderId: team.leaderId,
    leaderName: team.leaderName,
    startedAt: team.startedAt,
    pausedAt: session.pausedAt,
    members: team.members,
    firmasMax: IMPRO_FIRMAS_MAX,
    firmas: team.awarded ? me.firmas : null,
    notes,
    noTeam: false,
  };
}

export async function chooseImproLeader(groupId: string, studentId: string, nomineeId: string) {
  const session = await getImproSession(groupId);
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
  return getImproSession(groupId);
}

export async function startImproTimer(groupId: string, studentId: string) {
  const session = await getImproSession(groupId);
  if (!session?.released) throw new Error("not_released");
  if (session.paused) throw new Error("paused");
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  if (!team) throw new Error("not_in_team");
  if (team.leaderId !== studentId) throw new Error("not_leader");
  if (team.startedAt) return session;
  const startedAt = new Date().toISOString();
  const teams = session.teams.map((t) => (t.key === team.key ? { ...t, startedAt } : t));
  await persist(groupId, teams, { pausedAt: session.pausedAt });
  return getImproSession(groupId);
}

export function improErrorHttp(msg: string) {
  if (msg === "not_released" || msg === "not_in_team" || msg === "not_leader" || msg === "paused") {
    return { status: 403 as const, error: msg, message: improErrorMessage(msg) };
  }
  if (msg === "already_started") {
    return { status: 409 as const, error: msg, message: improErrorMessage(msg) };
  }
  if (
    msg === "invalid_leader" ||
    msg === "invalid_note" ||
    msg === "student_required" ||
    msg === "student_not_in_team" ||
    msg === "team_not_found"
  ) {
    return { status: 400 as const, error: msg, message: improErrorMessage(msg) };
  }
  return { status: 500 as const, error: "impro_failed", message: improErrorMessage(msg) };
}

function improErrorMessage(msg: string) {
  if (msg === "not_released") return "El docente aún no libera la actividad.";
  if (msg === "not_in_team") return "No estás en un equipo de proyecto para este sprint.";
  if (msg === "not_leader") return "Solo el líder del equipo puede activar el reloj.";
  if (msg === "paused") return "El docente pausó el reto. El reloj está congelado.";
  if (msg === "already_started") return "El reloj ya está corriendo. Ya no se puede cambiar de líder.";
  if (msg === "invalid_leader") return "Elige a alguien de tu mismo equipo.";
  if (msg === "invalid_note") return "La nota necesita un motivo y un descuento en Firmas.";
  if (msg === "student_required") return "Elige a qué integrante aplica esta nota.";
  if (msg === "student_not_in_team") return "Ese alumno no está en este equipo.";
  if (msg === "team_not_found") return "No se encontró el equipo.";
  return "No se pudo actualizar Pop-Up.";
}
