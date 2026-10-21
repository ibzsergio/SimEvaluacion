import { IMPRO_ACTIVITY_NAME, IMPRO_FIRMAS_MAX, IMPRO_MINUTOS, IMPRO_NOTAS } from "./improScrum";
import type { Announcement, ExtraNote, ExtraSession, ImproSession, StudentExtra, StudentImpro } from "./types";

export const POPUP_ANNOUNCEMENT_TITLE = "Pop-Up";
const MARK = "[[popup-state]]";

export type PopupLiveState = {
  v: 1;
  released: boolean;
  startedAt: string | null;
  pausedAt: string | null;
  notes: Record<string, ExtraNote[]>;
  awarded: string[];
  teamNames: Record<string, string>;
};

export const EMPTY_POPUP_STATE: PopupLiveState = {
  v: 1,
  released: false,
  startedAt: null,
  pausedAt: null,
  notes: {},
  awarded: [],
  teamNames: {},
};

type AnnouncementLike = Pick<Announcement, "title" | "body" | "createdAt" | "groupId">;

export function popupPublicText(body: string) {
  const idx = body.indexOf(MARK);
  return (idx >= 0 ? body.slice(0, idx) : body).trim();
}

export function parsePopupState(body: string): PopupLiveState | null {
  const idx = body.indexOf(MARK);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<PopupLiveState>;
    if (!parsed || parsed.v !== 1) return null;
    return {
      v: 1,
      released: Boolean(parsed.released),
      startedAt: typeof parsed.startedAt === "string" && parsed.startedAt ? parsed.startedAt : null,
      pausedAt: typeof parsed.pausedAt === "string" && parsed.pausedAt ? parsed.pausedAt : null,
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
      awarded: Array.isArray(parsed.awarded) ? parsed.awarded.filter((id) => typeof id === "string") : [],
      teamNames:
        parsed.teamNames && typeof parsed.teamNames === "object"
          ? Object.fromEntries(
              Object.entries(parsed.teamNames).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
            )
          : {},
    };
  } catch {
    return null;
  }
}

function visibleCopy(state: PopupLiveState) {
  if (state.startedAt && !state.pausedAt) {
    return "El reloj de 50 minutos ya inició. Pueden salir a buscar cartón, palos de madera, unicel y lo que haga falta. El pop-up mide mínimo 30 cm de ancho por 30 cm de alto.";
  }
  if (state.pausedAt) {
    return "El docente pausó el reloj de Pop-Up. Esperen a que lo reanude. El pop-up mide mínimo 30 cm de ancho por 30 cm de alto.";
  }
  if (state.released) {
    return "Pop-Up está liberado para este grupo. Esperen a que el docente inicie los 50 minutos. En ese momento pueden salir a buscar cartón, palos de madera y unicel. Mínimo 30 cm de ancho por 30 cm de alto.";
  }
  return "Pop-Up está en preparación para este grupo.";
}

export function serializePopupState(state: PopupLiveState) {
  return `${visibleCopy(state)}\n\n${MARK}\n${JSON.stringify(state)}`;
}

export function popupStateFromAnnouncements(announcements: AnnouncementLike[], groupId?: string) {
  const matches = announcements
    .filter((item) => item.title === POPUP_ANNOUNCEMENT_TITLE)
    .filter((item) => !groupId || item.groupId === groupId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const item of matches) {
    const parsed = parsePopupState(item.body);
    if (parsed) return parsed;
  }
  return { ...EMPTY_POPUP_STATE, notes: {}, awarded: [], teamNames: {} };
}

export function memberFirmas(notes: ExtraNote[], studentId: string) {
  const cut = notes
    .filter((note) => !note.studentId || note.studentId === studentId)
    .reduce((acc, note) => acc + Math.max(0, note.points), 0);
  return Math.max(0, IMPRO_FIRMAS_MAX - cut);
}

export function withTeamNames(state: PopupLiveState, teams: ExtraSession["teams"]): PopupLiveState {
  return {
    ...state,
    teamNames: Object.fromEntries(teams.map((team) => [team.key, team.name ?? team.columna ?? team.key])),
  };
}

export function improSessionFromProjectTeams(
  base: ExtraSession,
  state: PopupLiveState,
  sharedClock: boolean,
): ImproSession {
  const teams = base.teams.map((team) => {
    const notes = state.notes[team.key] ?? [];
    return {
      ...team,
      startedAt: state.startedAt,
      notes,
      awarded: state.awarded.includes(team.key),
      firmasMax: IMPRO_FIRMAS_MAX,
      members: team.members.map((member) => ({
        ...member,
        firmas: memberFirmas(notes, member.studentId),
      })),
    };
  });
  return {
    ...base,
    released: state.released,
    releasedAt: state.released ? state.startedAt ?? new Date().toISOString() : null,
    paused: Boolean(state.pausedAt),
    pausedAt: state.pausedAt,
    minutes: IMPRO_MINUTOS,
    firmasMax: IMPRO_FIRMAS_MAX,
    teamCount: teams.length,
    teams,
    loadError: teams.length ? null : "No hay equipos de proyecto en este grupo. Revisa Roles / Equipos.",
    sharedClock,
  };
}

export function interfaceSessionAsExtra(session: {
  groupId: string;
  groupCode: string;
  teams: Array<{
    key: string;
    name: string;
    hex: string;
    leaderId: string | null;
    leaderName: string | null;
    members: Array<{
      studentId: string;
      displayName: string;
      listNumber: number | null;
      role: string | null;
    }>;
  }>;
}): ExtraSession {
  return {
    groupId: session.groupId,
    groupCode: session.groupCode,
    released: false,
    releasedAt: null,
    paused: false,
    pausedAt: null,
    minutes: IMPRO_MINUTOS,
    teamCount: session.teams.length,
    rosterMode: "project",
    firmasMax: IMPRO_FIRMAS_MAX,
    teams: session.teams.map((team, index) => ({
      key: team.key,
      readingIndex: index,
      colorName: team.name,
      hex: team.hex,
      columna: team.name,
      name: team.name,
      leaderId: team.leaderId,
      leaderName: team.leaderName,
      startedAt: null,
      notes: [],
      awarded: false,
      firmasMax: IMPRO_FIRMAS_MAX,
      members: team.members.map((member) => ({
        studentId: member.studentId,
        displayName: member.displayName,
        listNumber: member.listNumber,
        role: member.role,
        firmas: IMPRO_FIRMAS_MAX,
      })),
    })),
  };
}

export function noteFromPreset(
  code: string,
  team: ExtraSession["teams"][number],
  studentId?: string | null,
) {
  const preset = IMPRO_NOTAS.find((item) => item.code === code);
  const student = studentId ? team.members.find((member) => member.studentId === studentId) : null;
  const note: ExtraNote = {
    id: `popup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code,
    label: preset?.label ?? code,
    points: preset?.points ?? 0,
    studentId: student?.studentId ?? null,
    studentName: student?.displayName ?? null,
    at: new Date().toISOString(),
  };
  return note;
}

export function studentImproFromAnnouncements(
  extra: StudentExtra | null | undefined,
  announcements: AnnouncementLike[],
): StudentImpro | null {
  const state = popupStateFromAnnouncements(announcements);
  if (!state.released) return null;
  const teamName = extra?.noTeam ? "" : extra?.teamName ?? "";
  const teamKey =
    Object.entries(state.teamNames).find(([, name]) => name && name === teamName)?.[0] ?? "";
  const notes = teamKey ? (state.notes[teamKey] ?? []) : [];
  const me = extra?.members.find((member) => member.displayName === extra.displayName);
  const applied = notes.filter((note) => !note.studentId || note.studentId === me?.studentId);
  const firmas = memberFirmas(applied, me?.studentId ?? "");
  return {
    minutes: IMPRO_MINUTOS,
    rosterMode: "project",
    teamName: extra?.noTeam ? undefined : extra?.teamName,
    colorName: extra?.colorName ?? "naranja",
    hex: extra?.hex ?? "#f97316",
    columna: extra?.columna || extra?.teamName || "",
    displayName: extra?.displayName ?? "",
    isLeader: Boolean(extra?.isLeader),
    leaderId: extra?.leaderId ?? null,
    leaderName: extra?.leaderName ?? null,
    startedAt: state.startedAt,
    pausedAt: state.pausedAt,
    firmasMax: IMPRO_FIRMAS_MAX,
    firmas,
    notes: applied,
    noTeam: !extra || Boolean(extra.noTeam) || !extra.teamName,
    members: extra?.noTeam ? [] : (extra?.members ?? []),
    role: me?.role ?? null,
    sharedClock: true,
  };
}

export function popupGradeRows(session: ImproSession, teamKey?: string) {
  const teams = teamKey ? session.teams.filter((team) => team.key === teamKey) : session.teams;
  return teams.flatMap((team) =>
    team.members.map((member) => ({
      studentId: member.studentId,
      points: member.firmas ?? IMPRO_FIRMAS_MAX,
    })),
  );
}

export const POPUP_GRADE_NAME = IMPRO_ACTIVITY_NAME;
