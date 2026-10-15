import { prisma } from "./prisma.js";
import { todayClassDayDate } from "./classDayService.js";
import { COLUMN_PALETTE } from "./seatingService.js";

export const EXTRA_MINUTES = 0;
export const EXTRA_FIRMAS_MAX = 3000;
export const EXTRA_ACTIVITY_NAME = "Plan de Acción Proyecto";
export const EXTRA_ANNOUNCEMENT_TITLE = "Nueva actividad: Plan de Acción Proyecto";

export const EXTRA_NOTE_PRESETS = [
  { code: "ruido", label: "Mucho ruido", points: 400, scope: "team" as const },
  { code: "no_trabaja", label: "No trabaja el equipo", points: 800, scope: "team" as const },
  { code: "otro_equipo", label: "Integrante en otro equipo", points: 500, scope: "member" as const },
  { code: "sin_material", label: "No trajo material", points: 400, scope: "member" as const },
  { code: "fuera_tiempo", label: "Entrega fuera de tiempo", points: 600, scope: "team" as const },
];

export type ExtraNote = {
  id: string;
  code: string;
  label: string;
  points: number;
  studentId?: string | null;
  studentName?: string | null;
  at: string;
};

export type ExtraMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  role?: string | null;
  firmas: number;
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
  notes: ExtraNote[];
  awarded: boolean;
  firmasMax: number;
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
  firmasMax: number;
  activityId: string | null;
  teamCount: number;
  teams: ExtraTeam[];
};

type StoredTeamState = {
  key: string;
  leaderId: string | null;
  startedAt: string | null;
  notes: ExtraNote[];
  awarded: boolean;
};

type StoredPayload = {
  teams: StoredTeamState[];
  pausedAt: string | null;
};

function parseNotes(raw: unknown): ExtraNote[] {
  if (!Array.isArray(raw)) return [];
  const notes: ExtraNote[] = [];
  for (const n of raw) {
    const item = n as ExtraNote;
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

function memberFirmas(notes: ExtraNote[], studentId: string) {
  const cut = notes
    .filter((n) => !n.studentId || n.studentId === studentId)
    .reduce((acc, n) => acc + n.points, 0);
  return Math.max(0, EXTRA_FIRMAS_MAX - cut);
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
): ExtraTeam[] {
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
      startedAt: leaderId ? prev?.startedAt ?? null : null,
      notes,
      awarded: Boolean(prev?.awarded),
      firmasMax: EXTRA_FIRMAS_MAX,
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
      notes: t.notes,
      awarded: t.awarded,
    })),
  };
}

function isClassroomCode(code: string) {
  const c = String(code ?? "").trim();
  return c === "301" || c === "302";
}

async function listClassroomGroups(teacherId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; code: string; extraReleased: number | boolean | null }>
  >`
    SELECT id, code, extraReleased FROM ClassGroup WHERE teacherId = ${teacherId}
  `;
  return rows.filter((row) => isClassroomCode(row.code));
}

async function writeReleasedFlag(groupIds: string[], released: boolean) {
  if (!groupIds.length) return;
  const placeholders = groupIds.map(() => "?").join(",");
  if (released) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`ClassGroup\` SET \`extraReleased\` = 1, \`extraReleasedAt\` = NOW(3) WHERE \`id\` IN (${placeholders})`,
      ...groupIds,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE \`ClassGroup\` SET \`extraReleased\` = 0, \`extraReleasedAt\` = NULL WHERE \`id\` IN (${placeholders})`,
      ...groupIds,
    );
  }
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
    await prisma.$executeRawUnsafe(
      extra.extraReleased
        ? "UPDATE `ClassGroup` SET `extraPayload` = ?, `extraReleased` = 1, `extraReleasedAt` = NOW(3) WHERE `id` = ?"
        : "UPDATE `ClassGroup` SET `extraPayload` = ?, `extraReleased` = 0, `extraReleasedAt` = NULL WHERE `id` = ?",
      payload,
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

async function findPlanActivity(groupId: string) {
  return prisma.activity.findFirst({
    where: { groupId, name: EXTRA_ACTIVITY_NAME },
    orderBy: { createdAt: "desc" },
    select: { id: true, maxPoints: true },
  });
}

async function ensurePlanActivity(groupId: string, teacherId: string) {
  const existing = await findPlanActivity(groupId);
  if (existing) {
    if (existing.maxPoints !== EXTRA_FIRMAS_MAX) {
      await prisma.activity.update({
        where: { id: existing.id },
        data: { maxPoints: EXTRA_FIRMAS_MAX },
      });
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
      name: EXTRA_ACTIVITY_NAME,
      maxPoints: EXTRA_FIRMAS_MAX,
      signatureMax: 0,
      sortOrder: (lastOrder._max.sortOrder ?? -1) + 1,
      partialNumber: group?.currentPartial ?? 1,
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
  const points = Math.min(EXTRA_FIRMAS_MAX, Math.max(0, Math.round(params.points)));
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

/** Crea la columna de 3000 Firmas en 301 y 302 si ya existe en uno o si la actividad está liberada. */
export async function ensurePlanActivitiesForTeacher(teacherId: string) {
  const classroom = await listClassroomGroups(teacherId);
  if (!classroom.length) return;
  const anyReleased = classroom.some((row) => Boolean(row.extraReleased));
  const existing = await prisma.activity.findFirst({
    where: { name: EXTRA_ACTIVITY_NAME, groupId: { in: classroom.map((row) => row.id) } },
    select: { id: true },
  });
  if (!anyReleased && !existing) return;
  for (const row of classroom) {
    try {
      await ensurePlanActivity(row.id, teacherId);
    } catch (err) {
      console.warn("[extra] no se pudo crear Plan de Acción en", row.code, err);
    }
  }
}

async function applyTeamFirmas(groupId: string, teacherId: string, team: ExtraTeam) {
  const activityId = await ensurePlanActivity(groupId, teacherId);
  for (const member of team.members) {
    await upsertMemberGrade({
      activityId,
      studentId: member.studentId,
      teacherId,
      points: member.firmas,
    });
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
  let released = Boolean(group.extraReleased);
  if (group.teacherId && isClassroomCode(group.code)) {
    try {
      const classroom = await listClassroomGroups(group.teacherId);
      if (classroom.some((row) => Boolean(row.extraReleased))) {
        released = true;
        await writeReleasedFlag(classroom.map((row) => row.id), true);
      }
    } catch (err) {
      console.warn("[extra] no se pudo igualar extraReleased de 301/302:", err);
    }
  }
  const stored = parsePayload(group.extraPayload);
  let teams: ExtraTeam[] = [];
  try {
    const projectTeams = await loadProjectTeams(groupId);
    teams = hydrateProjectTeams(projectTeams, stored);
  } catch (err) {
    console.warn("[extra] no se pudieron hidratar equipos de proyecto:", err);
  }
  if (released && group.teacherId) {
    try {
      await ensurePlanActivitiesForTeacher(group.teacherId);
    } catch (err) {
      console.warn("[extra] no se pudieron publicar columnas de Plan de Acción:", err);
    }
  }
  const activity = await findPlanActivity(groupId);
  const releasedAt =
    group.extraReleasedAt instanceof Date
      ? group.extraReleasedAt.toISOString()
      : group.extraReleasedAt
        ? String(group.extraReleasedAt)
        : released
          ? new Date().toISOString()
          : null;
  return {
    groupId: group.id,
    groupCode: group.code,
    rosterMode: "project",
    released,
    releasedAt,
    paused: Boolean(stored.pausedAt),
    pausedAt: stored.pausedAt,
    minutes: EXTRA_MINUTES,
    firmasMax: EXTRA_FIRMAS_MAX,
    activityId: activity?.id ?? null,
    teamCount: teams.length,
    teams,
  };
}

export async function setExtraReleased(groupId: string, released: boolean) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { teacherId: true, code: true },
  });
  if (!group) return null;
  const classroom = await listClassroomGroups(group.teacherId);
  const targetIds = classroom.length ? classroom.map((row) => row.id) : [groupId];
  await writeReleasedFlag(targetIds, released);
  for (const id of targetIds) {
    try {
      const session = await getExtraSession(id);
      if (!session) continue;
      await persist(id, session.teams, {
        extraReleased: released,
        extraReleasedAt: released ? new Date() : null,
      });
    } catch (err) {
      console.warn("[extra] persist al liberar falló:", id, err);
    }
  }
  if (released) {
    try {
      await ensurePlanActivitiesForTeacher(group.teacherId);
    } catch (err) {
      console.warn("[extra] no se pudieron publicar columnas al liberar:", err);
    }
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
          body: `Plan de Acción Proyecto (paso 3 · interfaces) para 301 y 302. Ya hicieron análisis de requerimientos y diagramas/casos de uso/cronograma. Armen en cartulina las pantallas de SU app Tkinter (cartulina, hojas de color, pegamento, diurex, periódico/revistas). Equipos de Roles / Equipos. Vale 3000 Firmas; las notas del docente (ruido, no trabaja, sin material, fuera de tiempo…) bajan ese valor.`,
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

export async function addExtraNote(
  groupId: string,
  teacherId: string,
  input: { teamKey: string; code: string; label?: string; points?: number; studentId?: string | null },
) {
  const session = await getExtraSession(groupId);
  if (!session) throw new Error("group_not_found");
  const team = session.teams.find((t) => t.key === input.teamKey);
  if (!team) throw new Error("team_not_found");

  const preset = EXTRA_NOTE_PRESETS.find((p) => p.code === input.code);
  let label = (input.label ?? preset?.label ?? "").trim();
  let points = Math.round(Number(input.points ?? preset?.points ?? 0));
  if (!label || points <= 0) throw new Error("invalid_note");
  if (points > EXTRA_FIRMAS_MAX) points = EXTRA_FIRMAS_MAX;

  let studentId = input.studentId ? String(input.studentId) : null;
  let studentName: string | null = null;
  if (preset?.scope === "member" && !studentId) throw new Error("student_required");
  if (studentId) {
    const member = team.members.find((m) => m.studentId === studentId);
    if (!member) throw new Error("student_not_in_team");
    studentName = member.displayName;
  }

  const note: ExtraNote = {
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
    return { ...t, notes, members, awarded: true };
  });
  const next = teams.find((t) => t.key === team.key)!;
  await persist(groupId, teams);
  await applyTeamFirmas(groupId, teacherId, next);
  return getExtraSession(groupId);
}

export async function removeExtraNote(
  groupId: string,
  teacherId: string,
  input: { teamKey: string; noteId: string },
) {
  const session = await getExtraSession(groupId);
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
  return getExtraSession(groupId);
}

export async function applyExtraFirmas(groupId: string, teacherId: string, teamKey?: string) {
  const session = await getExtraSession(groupId);
  if (!session) throw new Error("group_not_found");
  const targets = teamKey ? session.teams.filter((t) => t.key === teamKey) : session.teams;
  if (teamKey && targets.length === 0) throw new Error("team_not_found");
  const teams = session.teams.map((t) =>
    targets.some((x) => x.key === t.key) ? { ...t, awarded: true } : t,
  );
  await persist(groupId, teams);
  for (const team of teams.filter((t) => t.awarded)) {
    await applyTeamFirmas(groupId, teacherId, team);
  }
  return getExtraSession(groupId);
}

export function studentExtraAssignment(session: ExtraSession, studentId: string) {
  if (!session.released) return null;
  const team = session.teams.find((t) => t.members.some((m) => m.studentId === studentId));
  const swatch = COLUMN_PALETTE[0]!;
  if (!team) {
    return {
      minutes: 0,
      rosterMode: session.rosterMode,
      teamName: "Sin equipo asignado",
      colorName: swatch.name,
      hex: swatch.hex,
      columna: "",
      displayName: "",
      isLeader: false,
      leaderId: null,
      leaderName: null,
      startedAt: null,
      pausedAt: null,
      members: [],
      firmasMax: EXTRA_FIRMAS_MAX,
      firmas: null,
      notes: [],
      noTeam: true,
    };
  }
  const me = team.members.find((m) => m.studentId === studentId)!;
  const notes = team.notes.filter((n) => !n.studentId || n.studentId === studentId);
  return {
    minutes: 0,
    rosterMode: session.rosterMode,
    teamName: team.name,
    colorName: team.colorName,
    hex: team.hex,
    columna: team.columna,
    displayName: me.displayName,
    isLeader: team.leaderId === studentId,
    leaderId: team.leaderId,
    leaderName: team.leaderName,
    startedAt: null,
    pausedAt: null,
    members: team.members,
    firmasMax: EXTRA_FIRMAS_MAX,
    firmas: team.awarded ? me.firmas : null,
    notes,
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
  if (
    msg === "invalid_leader" ||
    msg === "invalid_note" ||
    msg === "student_required" ||
    msg === "student_not_in_team" ||
    msg === "team_not_found"
  ) {
    return { status: 400 as const, error: msg, message: extraErrorMessage(msg) };
  }
  return { status: 500 as const, error: "extra_failed", message: extraErrorMessage(msg) };
}

function extraErrorMessage(msg: string) {
  if (msg === "not_released") return "El docente aún no libera la actividad.";
  if (msg === "not_in_team") return "No estás en un equipo de proyecto para este plan.";
  if (msg === "not_leader") return "Solo el líder del equipo puede activar el reloj.";
  if (msg === "paused") return "El docente pausó el reto. El reloj está congelado.";
  if (msg === "already_started") return "El reloj ya está corriendo. Ya no se puede cambiar de líder.";
  if (msg === "invalid_leader") return "Elige a alguien de tu mismo equipo.";
  if (msg === "invalid_note") return "La nota necesita un motivo y un descuento en Firmas.";
  if (msg === "student_required") return "Elige a qué integrante aplica esta nota.";
  if (msg === "student_not_in_team") return "Ese alumno no está en este equipo.";
  if (msg === "team_not_found") return "No se encontró el equipo.";
  return "No se pudo actualizar Plan de Acción Proyecto.";
}
