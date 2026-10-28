import { prisma } from "./prisma.js";
import { COLUMN_PALETTE } from "./seatingService.js";
import {
  ensureInterfaceDesignActivities,
  interfaceDesignClosed,
  INTERFACE_ACTIVITY_NAME,
  INTERFACE_MAX_POINTS,
} from "./interfaceDesignActivity.js";

export const INTERFACE_NOTE_PRESETS = [
  { code: "trabajo", label: "Trabajo en equipo", points: 300, scope: "team" as const },
  { code: "profesional", label: "Diseño profesional y amigable con el usuario", points: 700, scope: "team" as const },
  { code: "entrega", label: "Entrega en tiempo y forma", points: 350, scope: "team" as const },
  { code: "color", label: "Colorimetría", points: 250, scope: "team" as const },
  { code: "tipo", label: "Tipografía adecuada", points: 200, scope: "team" as const },
  { code: "docente", label: "Vista del docente", points: 300, scope: "team" as const },
  { code: "directivo", label: "Vista del directivo", points: 300, scope: "team" as const },
  { code: "responsivo", label: "Diseño 100% responsivo", points: 300, scope: "team" as const },
  { code: "navegacion", label: "Navegación clara", points: 150, scope: "team" as const },
  { code: "alineacion", label: "Alineación y espaciado", points: 150, scope: "team" as const },
  { code: "silencio", label: "Sin orden y silencio", points: 50, scope: "team" as const },
  { code: "tarde", label: "Entrega fuera de tiempo", points: 50, scope: "team" as const },
  { code: "diseno", label: "Diseño, forma o presentación", points: 50, scope: "team" as const },
  { code: "organizacion", label: "Organización del equipo", points: 50, scope: "team" as const },
  { code: "fuera", label: "Fuera del equipo", points: 50, scope: "member" as const },
];

export const INTERFACE_DAYS = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-26"] as const;
export type InterfaceDay = (typeof INTERFACE_DAYS)[number];

function isInterfaceDay(value: string): value is InterfaceDay {
  return (INTERFACE_DAYS as readonly string[]).includes(value);
}

type InterfaceNote = {
  id: string;
  code: string;
  label: string;
  points: number;
  day: InterfaceDay;
  studentId: string | null;
  studentName: string | null;
};

type InterfaceMember = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  role: string | null;
  points: number;
};

export type InterfaceTeam = {
  key: string;
  name: string;
  hex: string;
  leaderId: string | null;
  leaderName: string | null;
  awardedDays: InterfaceDay[];
  members: InterfaceMember[];
  notes: InterfaceNote[];
};

export type InterfaceSession = {
  groupId: string;
  groupCode: string;
  released: boolean;
  activityId: string | null;
  pointsMax: number;
  teams: InterfaceTeam[];
  peer: InterfacePeerBoard;
};

type StoredTeam = { key: string; notes: InterfaceNote[]; awarded?: boolean; awardedDays?: InterfaceDay[] };

export const PEER_CRITERIA = [
  { code: "trabajo", points: 300 },
  { code: "profesional", points: 700 },
  { code: "entrega", points: 350 },
  { code: "color", points: 250 },
  { code: "tipo", points: 200 },
  { code: "docente", points: 300 },
  { code: "directivo", points: 300 },
  { code: "responsivo", points: 300 },
  { code: "navegacion", points: 150 },
  { code: "alineacion", points: 150 },
] as const;

const PEER_CODES = new Set<string>(PEER_CRITERIA.map((item) => item.code));
const PEER_MAX = PEER_CRITERIA.reduce((acc, item) => acc + item.points, 0);

type PeerReview = {
  reviewerId: string;
  reviewerName: string;
  reviewerTeamKey: string;
  reviewerTeamName: string;
  isLeader: boolean;
  targetTeamKey: string;
  missed: string[];
  updatedAt: string;
};

export type PeerEvaluator = {
  studentId: string;
  displayName: string;
  teamKey: string;
  teamName: string;
  isLeader: boolean;
  done: boolean;
  points: number | null;
  missed: string[];
};

export type PeerBoardTeam = {
  key: string;
  name: string;
  hex: string;
  teacherPoints: number;
  peerAverage: number | null;
  received: number;
  expected: number;
  evaluators: PeerEvaluator[];
};

export type InterfacePeerBoard = {
  published: boolean;
  pointsMax: number;
  teams: PeerBoardTeam[];
};

function parseNotes(raw: unknown): InterfaceNote[] {
  if (!Array.isArray(raw)) return [];
  const notes: InterfaceNote[] = [];
  for (const item of raw) {
    const note = item as InterfaceNote;
    const points = Math.max(0, Math.round(Number(note.points) || 0));
    const label = String(note.label ?? "").trim();
    if (!label || points <= 0) continue;
    const day = isInterfaceDay(String(note.day ?? "")) ? note.day : INTERFACE_DAYS[0];
    notes.push({
      id: String(note.id ?? `note_${Math.random().toString(36).slice(2, 9)}`),
      code: String(note.code ?? "custom"),
      label,
      points,
      day,
      studentId: note.studentId ? String(note.studentId) : null,
      studentName: note.studentName ? String(note.studentName) : null,
    });
  }
  return notes;
}

function parsePayload(raw: unknown): StoredTeam[] {
  if (!raw || typeof raw !== "object") return [];
  const teams = (raw as { teams?: unknown }).teams;
  if (!Array.isArray(teams)) return [];
  return teams.map((item) => {
    const team = item as StoredTeam;
    const fromList = Array.isArray(team.awardedDays)
      ? team.awardedDays.map(String).filter(isInterfaceDay)
      : [];
    return {
      key: String(team.key ?? ""),
      notes: parseNotes(team.notes),
      awardedDays: fromList.length ? fromList : team.awarded ? [INTERFACE_DAYS[0]] : [],
    };
  });
}

function memberPoints(notes: InterfaceNote[], studentId: string) {
  const cut = notes
    .filter((note) => !note.studentId || note.studentId === studentId)
    .reduce((acc, note) => acc + note.points, 0);
  return Math.max(0, INTERFACE_MAX_POINTS - cut);
}

function committedNotes(team: Pick<InterfaceTeam, "notes" | "awardedDays">) {
  return team.notes.filter((note) => team.awardedDays.includes(note.day));
}

async function loadTeams(groupId: string, stored: StoredTeam[]): Promise<InterfaceTeam[]> {
  const projectTeams = await prisma.projectTeam.findMany({
    where: { groupId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    include: {
      members: { include: { student: { select: { displayName: true, listNumber: true } } } },
    },
  });
  const byKey = new Map(stored.map((team) => [team.key, team]));
  return projectTeams.map((team, index) => {
    const key = `project:${team.id}`;
    const prev = byKey.get(key);
    const notes = prev?.notes ?? [];
    const swatch = COLUMN_PALETTE[index % COLUMN_PALETTE.length]!;
    const members = team.members.map((member) => ({
      studentId: member.studentId,
      displayName: member.student?.displayName ?? "Alumno",
      listNumber: member.student?.listNumber ?? null,
      role: member.role,
      points: memberPoints(notes, member.studentId),
    }));
    const leader = members.find((member) => member.studentId === team.leaderId) ?? null;
    return {
      key,
      name: team.name,
      hex: swatch.hex,
      leaderId: leader?.studentId ?? null,
      leaderName: leader?.displayName ?? null,
      awardedDays: (prev?.awardedDays ?? []).filter(isInterfaceDay),
      members,
      notes,
    };
  });
}

async function readPayload(groupId: string) {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { interfacePayload: true },
  });
  return group?.interfacePayload;
}

function payloadPublished(raw: unknown) {
  return Boolean(raw && typeof raw === "object" && (raw as { published?: unknown }).published);
}

async function readStored(groupId: string) {
  return parsePayload(await readPayload(groupId));
}

function parsePeerReviews(raw: unknown): PeerReview[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { peerReviews?: unknown }).peerReviews;
  if (!Array.isArray(list)) return [];
  const reviews: PeerReview[] = [];
  for (const item of list) {
    const review = item as PeerReview;
    const reviewerId = String(review.reviewerId ?? "");
    const targetTeamKey = String(review.targetTeamKey ?? "");
    if (!reviewerId || !targetTeamKey) continue;
    reviews.push({
      reviewerId,
      reviewerName: String(review.reviewerName ?? "Alumno"),
      reviewerTeamKey: String(review.reviewerTeamKey ?? ""),
      reviewerTeamName: String(review.reviewerTeamName ?? ""),
      isLeader: Boolean(review.isLeader),
      targetTeamKey,
      missed: Array.isArray(review.missed) ? review.missed.map(String).filter((code) => PEER_CODES.has(code)) : [],
      updatedAt: String(review.updatedAt ?? new Date().toISOString()),
    });
  }
  return reviews;
}

function peerPublishedFlag(raw: unknown) {
  return Boolean(raw && typeof raw === "object" && (raw as { peerPublished?: unknown }).peerPublished);
}

function peerScore(missed: string[]) {
  const cut = PEER_CRITERIA.filter((item) => missed.includes(item.code)).reduce((acc, item) => acc + item.points, 0);
  return Math.max(0, PEER_MAX - cut);
}

function teacherTeamPoints(team: InterfaceTeam) {
  return memberPoints(
    team.notes.filter((note) => !note.studentId),
    "",
  );
}

function leaderOf(team: InterfaceTeam) {
  if (!team.leaderId) return null;
  return team.members.find((member) => member.studentId === team.leaderId) ?? null;
}

function buildPeerBoard(teams: InterfaceTeam[], reviews: PeerReview[], published: boolean): InterfacePeerBoard {
  const boardTeams = teams.map((team) => {
    const received = reviews.filter((review) => review.targetTeamKey === team.key);
    const evaluators: PeerEvaluator[] = teams
      .filter((other) => other.key !== team.key)
      .map((other) => {
        const leader = leaderOf(other);
        if (!leader) {
          return {
            studentId: `sin-lider-${other.key}`,
            displayName: "Sin líder",
            teamKey: other.key,
            teamName: other.name,
            isLeader: false,
            done: false,
            points: null,
            missed: [],
          };
        }
        const review = received.find((item) => item.reviewerId === leader.studentId);
        return {
          studentId: leader.studentId,
          displayName: leader.displayName,
          teamKey: other.key,
          teamName: other.name,
          isLeader: true,
          done: Boolean(review),
          points: review ? peerScore(review.missed) : null,
          missed: review?.missed ?? [],
        };
      });
    evaluators.sort((a, b) => a.teamName.localeCompare(b.teamName, "es"));
    const scoring = evaluators.filter((person) => person.isLeader && person.points != null);
    return {
      key: team.key,
      name: team.name,
      hex: team.hex,
      teacherPoints: teacherTeamPoints(team),
      peerAverage: scoring.length
        ? Math.round(scoring.reduce((acc, person) => acc + (person.points ?? 0), 0) / scoring.length)
        : null,
      received: scoring.length,
      expected: evaluators.filter((person) => person.isLeader).length,
      evaluators,
    };
  });
  return { published, pointsMax: PEER_MAX, teams: boardTeams };
}

async function saveTeams(
  groupId: string,
  teams: InterfaceTeam[],
  extra?: { published?: boolean; peerPublished?: boolean; peerReviews?: PeerReview[] },
) {
  const prev = await readPayload(groupId);
  const payload = {
    teams: teams.map((team) => ({
      key: team.key,
      notes: team.notes,
      awardedDays: team.awardedDays,
    })),
    published: extra?.published ?? payloadPublished(prev),
    peerPublished: extra?.peerPublished ?? peerPublishedFlag(prev),
    peerReviews: extra?.peerReviews ?? parsePeerReviews(prev),
  };
  await prisma.classGroup.update({
    where: { id: groupId },
    data: { interfacePayload: payload },
  });
}

async function activityForGroup(groupId: string) {
  return prisma.activity.findFirst({
    where: { groupId, name: INTERFACE_ACTIVITY_NAME },
    orderBy: { createdAt: "desc" },
    select: { id: true, releasedToStudents: true },
  });
}

async function writeMemberGrade(params: {
  activityId: string;
  studentId: string;
  teacherId: string;
  points: number;
}) {
  const points = Math.min(INTERFACE_MAX_POINTS, Math.max(0, Math.round(params.points)));
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

async function applyTeamPoints(groupId: string, teacherId: string, team: InterfaceTeam) {
  const activity = await activityForGroup(groupId);
  const activityId = activity?.id;
  if (!activityId) return;
  const notes = committedNotes(team);
  for (const member of team.members) {
    await writeMemberGrade({
      activityId,
      studentId: member.studentId,
      teacherId,
      points: memberPoints(notes, member.studentId),
    });
  }
}

export async function getInterfaceSession(groupId: string): Promise<InterfaceSession | null> {
  const group = await prisma.classGroup.findUnique({
    where: { id: groupId },
    select: { id: true, code: true, teacherId: true },
  });
  if (!group) return null;
  await ensureInterfaceDesignActivities(group.teacherId);
  const activity = await activityForGroup(groupId);
  const storedRaw = await readPayload(groupId);
  const teams = await loadTeams(groupId, parsePayload(storedRaw));
  if (interfaceDesignClosed() && activity && !payloadPublished(storedRaw)) {
    for (const team of teams) {
      await applyTeamPoints(groupId, group.teacherId, team);
    }
    await saveTeams(groupId, teams, { published: true });
  }
  const payload = await readPayload(groupId);
  const reviews = parsePeerReviews(payload);
  return {
    groupId: group.id,
    groupCode: group.code,
    released: Boolean(activity?.releasedToStudents),
    activityId: activity?.id ?? null,
    pointsMax: INTERFACE_MAX_POINTS,
    teams,
    peer: buildPeerBoard(teams, reviews, peerPublishedFlag(payload)),
  };
}

export async function setInterfacePeerPublished(groupId: string, published: boolean) {
  const session = await getInterfaceSession(groupId);
  if (!session) return null;
  const payload = await readPayload(groupId);
  await saveTeams(groupId, session.teams, {
    peerPublished: published,
    peerReviews: parsePeerReviews(payload),
  });
  return getInterfaceSession(groupId);
}

export async function submitPeerReview(
  groupId: string,
  studentId: string,
  input: { targetTeamKey: string; missed: string[] },
) {
  const session = await getInterfaceSession(groupId);
  if (!session) throw new Error("group_not_found");
  if (!session.released || !session.peer.published) throw new Error("peer_closed");
  const mine = session.teams.find((team) => team.members.some((member) => member.studentId === studentId));
  if (!mine) throw new Error("not_in_team");
  if (mine.leaderId !== studentId) throw new Error("not_leader");
  const target = session.teams.find((team) => team.key === input.targetTeamKey);
  if (!target) throw new Error("team_not_found");
  if (target.key === mine.key) throw new Error("own_team");
  const me = mine.members.find((member) => member.studentId === studentId)!;
  const missed = [...new Set(input.missed.filter((code) => PEER_CODES.has(code)))];
  const payload = await readPayload(groupId);
  const reviews = parsePeerReviews(payload).filter(
    (review) => !(review.reviewerId === studentId && review.targetTeamKey === target.key),
  );
  reviews.push({
    reviewerId: studentId,
    reviewerName: me.displayName,
    reviewerTeamKey: mine.key,
    reviewerTeamName: mine.name,
    isLeader: true,
    targetTeamKey: target.key,
    missed,
    updatedAt: new Date().toISOString(),
  });
  await saveTeams(groupId, session.teams, { peerReviews: reviews, peerPublished: true });
  const next = await getInterfaceSession(groupId);
  if (!next) throw new Error("group_not_found");
  return studentInterfaceView(next, studentId);
}

export async function addInterfaceNote(
  groupId: string,
  teacherId: string,
  input: {
    teamKey: string;
    code: string;
    day: string;
    label?: string;
    points?: number;
    studentId?: string | null;
  },
) {
  const session = await getInterfaceSession(groupId);
  if (!session) throw new Error("group_not_found");
  const team = session.teams.find((item) => item.key === input.teamKey);
  if (!team) throw new Error("team_not_found");
  if (!isInterfaceDay(input.day)) throw new Error("invalid_day");
  const day = input.day;

  const preset = INTERFACE_NOTE_PRESETS.find((item) => item.code === input.code);
  const label = (input.label ?? preset?.label ?? "").trim();
  let points = Math.round(Number(input.points ?? preset?.points ?? 0));
  if (!label || points <= 0) throw new Error("invalid_note");
  if (points > INTERFACE_MAX_POINTS) points = INTERFACE_MAX_POINTS;

  const noteCode = preset?.code ?? (input.code && input.code !== "custom" ? input.code.trim() : "custom");
  if (
    noteCode !== "custom" &&
    !input.studentId &&
    team.notes.some((note) => note.day === day && (note.code === noteCode || note.label === label))
  ) {
    throw new Error("already_noted");
  }

  let studentId = input.studentId ? String(input.studentId) : null;
  let studentName: string | null = null;
  if (preset?.scope === "member" && !studentId) throw new Error("student_required");
  if (studentId) {
    const member = team.members.find((item) => item.studentId === studentId);
    if (!member) throw new Error("student_not_in_team");
    studentName = member.displayName;
  }

  const note: InterfaceNote = {
    id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    code: noteCode,
    label,
    points,
    day,
    studentId,
    studentName,
  };

  const teams = session.teams.map((item) => {
    if (item.key !== team.key) return item;
    const notes = [...item.notes, note];
    return {
      ...item,
      notes,
      members: item.members.map((member) => ({
        ...member,
        points: memberPoints(notes, member.studentId),
      })),
    };
  });
  await saveTeams(groupId, teams);
  return getInterfaceSession(groupId);
}

export async function removeInterfaceNote(
  groupId: string,
  teacherId: string,
  input: { teamKey: string; noteId: string },
) {
  const session = await getInterfaceSession(groupId);
  if (!session) throw new Error("group_not_found");
  const team = session.teams.find((item) => item.key === input.teamKey);
  if (!team) throw new Error("team_not_found");
  const removed = team.notes.find((note) => note.id === input.noteId);
  if (!removed) throw new Error("note_not_found");
  const teams = session.teams.map((item) => {
    if (item.key !== team.key) return item;
    const notes = item.notes.filter((note) => note.id !== input.noteId);
    return {
      ...item,
      notes,
      awardedDays: item.awardedDays,
      members: item.members.map((member) => ({
        ...member,
        points: memberPoints(notes, member.studentId),
      })),
    };
  });
  await saveTeams(groupId, teams);
  const updated = teams.find((item) => item.key === team.key);
  if (updated && updated.awardedDays.includes(removed.day)) {
    await applyTeamPoints(groupId, teacherId, updated);
  }
  return getInterfaceSession(groupId);
}

export async function applyInterfacePoints(
  groupId: string,
  teacherId: string,
  day: string,
  teamKey?: string,
) {
  const session = await getInterfaceSession(groupId);
  if (!session) throw new Error("group_not_found");
  if (!isInterfaceDay(day)) throw new Error("invalid_day");
  const targets = teamKey ? session.teams.filter((team) => team.key === teamKey) : session.teams;
  if (teamKey && targets.length === 0) throw new Error("team_not_found");
  const teams = session.teams.map((team) => {
    if (!targets.some((target) => target.key === team.key)) return team;
    const awardedDays = team.awardedDays.includes(day) ? team.awardedDays : [...team.awardedDays, day];
    return { ...team, awardedDays };
  });
  await saveTeams(groupId, teams);
  for (const team of teams.filter((item) => targets.some((target) => target.key === item.key))) {
    await applyTeamPoints(groupId, teacherId, team);
  }
  return getInterfaceSession(groupId);
}

export function studentInterfaceView(session: InterfaceSession, studentId: string) {
  if (!session.released) return null;
  const team = session.teams.find((item) => item.members.some((member) => member.studentId === studentId));
  if (!team) {
    return {
      teamName: null as string | null,
      leaderName: null as string | null,
      points: null as number | null,
      pointsMax: session.pointsMax,
      awarded: false,
      closed: interfaceDesignClosed(),
      notes: [] as InterfaceNote[],
    };
  }
  const me = team.members.find((member) => member.studentId === studentId)!;
  const saved = committedNotes(team);
  return {
    teamName: team.name,
    leaderName: team.leaderName,
    points: memberPoints(saved, studentId),
    pointsMax: session.pointsMax,
    awarded: team.awardedDays.length > 0,
    closed: interfaceDesignClosed(),
    notes: saved.filter((note) => !note.studentId || note.studentId === studentId),
    peer: session.peer.published ? studentPeerView(session, studentId) : null,
  };
}

function studentPeerView(session: InterfaceSession, studentId: string) {
  const mine = session.teams.find((team) => team.members.some((member) => member.studentId === studentId));
  const boardMine = session.peer.teams.find((team) => team.key === mine?.key);
  const isLeader = mine?.leaderId === studentId;
  const mineReviewTargets = isLeader ? session.peer.teams.filter((team) => team.key !== mine?.key) : [];
  return {
    isLeader,
    pointsMax: session.peer.pointsMax,
    peerAverage: boardMine?.peerAverage ?? null,
    evaluatingUs: (boardMine?.evaluators ?? []).filter((person) => person.isLeader).map((person) => ({
      studentId: person.studentId,
      displayName: person.displayName,
      teamName: person.teamName,
      isLeader: person.isLeader,
      done: person.done,
    })),
    toReview: mineReviewTargets.map((team) => {
      const mineReview = team.evaluators.find((person) => person.studentId === studentId);
      return {
        key: team.key,
        name: team.name,
        hex: team.hex,
        done: Boolean(mineReview?.done),
        points: mineReview?.points ?? null,
        missed: mineReview?.missed ?? [],
      };
    }),
  };
}

export function interfaceErrorHttp(msg: string) {
  if (msg === "already_noted") {
    return { status: 409 as const, error: msg, message: "Esa nota ya está anotada en este día." };
  }
  if (msg === "student_required") {
    return { status: 400 as const, error: msg, message: "Elige a qué integrante aplica la llamada de atención." };
  }
  if (msg === "student_not_in_team") {
    return { status: 400 as const, error: msg, message: "Ese alumno no está en este equipo." };
  }
  if (msg === "invalid_day") {
    return { status: 400 as const, error: msg, message: "Elige un día del 19 al 22 o el lunes 26 de octubre." };
  }
  if (msg === "own_team") {
    return { status: 400 as const, error: msg, message: "No evalúas a tu propio equipo." };
  }
  if (msg === "peer_closed") {
    return { status: 403 as const, error: msg, message: "El docente todavía no publica la coevaluación." };
  }
  if (msg === "not_in_team") {
    return { status: 400 as const, error: msg, message: "No apareces en un equipo de Roles / Equipos." };
  }
  if (msg === "not_leader") {
    return { status: 403 as const, error: msg, message: "Solo el líder coevalúa el diseño de los demás equipos." };
  }
  if (msg === "invalid_note") {
    return { status: 400 as const, error: msg, message: "Escribe el motivo y cuántos puntos se restan." };
  }
  if (msg === "team_not_found") {
    return { status: 404 as const, error: msg, message: "No se encontró el equipo." };
  }
  if (msg === "note_not_found") {
    return { status: 404 as const, error: msg, message: "Esa nota ya no está. Recarga el equipo." };
  }
  return { status: 500 as const, error: "interface_failed", message: "No se pudo actualizar Diseño de Interfaces Proyecto." };
}
