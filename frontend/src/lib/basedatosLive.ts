import { BASEDATOS_FIRMAS_MAX, BASEDATOS_NOTAS } from "./basedatosScrum";
import type { Announcement, ExtraNote, ExtraSession, ImproSession, StudentExtra, StudentImpro } from "./types";

export const BASEDATOS_ANNOUNCEMENT_TITLE = "La base de datos";
const MARK = "[[basedatos-state]]";

export type BasedatosRosterEntry = {
  studentId: string;
  displayName: string;
  role: string | null;
  teamKey: string;
  teamName: string;
};

export type BasedatosLiveState = {
  v: 1;
  released: boolean;
  notes: Record<string, ExtraNote[]>;
  awarded: string[];
  teamNames: Record<string, string>;
  roster: BasedatosRosterEntry[];
};

export const EMPTY_BASEDATOS_STATE: BasedatosLiveState = {
  v: 1,
  released: false,
  notes: {},
  awarded: [],
  teamNames: {},
  roster: [],
};

type AnnouncementLike = Pick<Announcement, "title" | "body" | "createdAt" | "groupId">;

export function basedatosPublicText(body: string) {
  const idx = body.indexOf(MARK);
  return (idx >= 0 ? body.slice(0, idx) : body).trim();
}

export function parseBasedatosState(body: string): BasedatosLiveState | null {
  const idx = body.indexOf(MARK);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<BasedatosLiveState>;
    if (!parsed || parsed.v !== 1) return null;
    return {
      v: 1,
      released: Boolean(parsed.released),
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
      awarded: Array.isArray(parsed.awarded) ? parsed.awarded.filter((id) => typeof id === "string") : [],
      teamNames:
        parsed.teamNames && typeof parsed.teamNames === "object"
          ? Object.fromEntries(
              Object.entries(parsed.teamNames).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
            )
          : {},
      roster: Array.isArray(parsed.roster)
        ? parsed.roster.filter(
            (item): item is BasedatosRosterEntry =>
              !!item &&
              typeof item === "object" &&
              typeof (item as BasedatosRosterEntry).studentId === "string" &&
              typeof (item as BasedatosRosterEntry).displayName === "string" &&
              typeof (item as BasedatosRosterEntry).teamKey === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

function visibleCopy(state: BasedatosLiveState) {
  if (state.released) {
    return "La base de datos está liberada. El PDF abre con carátula. Cada sección lleva su título. El script va completo y las pantallas son capturas de la aplicación ya compilada.";
  }
  return "La base de datos está en preparación para este grupo.";
}

export function serializeBasedatosState(state: BasedatosLiveState) {
  return `${visibleCopy(state)}\n\n${MARK}\n${JSON.stringify(state)}`;
}

export function basedatosStateFromAnnouncements(announcements: AnnouncementLike[], groupId?: string) {
  const matches = announcements
    .filter((item) => item.title === BASEDATOS_ANNOUNCEMENT_TITLE)
    .filter((item) => !groupId || item.groupId === groupId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const item of matches) {
    const parsed = parseBasedatosState(item.body);
    if (parsed) return parsed;
  }
  return { ...EMPTY_BASEDATOS_STATE, notes: {}, awarded: [], teamNames: {}, roster: [] };
}

export function withBasedatosTeamNames(state: BasedatosLiveState, teams: ExtraSession["teams"]): BasedatosLiveState {
  return {
    ...state,
    teamNames: Object.fromEntries(teams.map((team) => [team.key, team.name ?? team.columna ?? team.key])),
    roster: teams.flatMap((team) =>
      team.members.map((member) => ({
        studentId: member.studentId,
        displayName: member.displayName,
        role: member.role ?? null,
        teamKey: team.key,
        teamName: team.name ?? team.columna ?? team.key,
      })),
    ),
  };
}

export function basedatosFirmas(notes: ExtraNote[], studentId: string) {
  const cut = notes
    .filter((note) => !note.studentId || note.studentId === studentId)
    .reduce((acc, note) => acc + Math.max(0, note.points), 0);
  return Math.max(0, BASEDATOS_FIRMAS_MAX - cut);
}

export function basedatosSessionFromTeams(base: ExtraSession, state: BasedatosLiveState): ImproSession {
  const teams = base.teams.map((team) => {
    const notes = state.notes[team.key] ?? [];
    return {
      ...team,
      notes,
      awarded: state.awarded.includes(team.key),
      firmasMax: BASEDATOS_FIRMAS_MAX,
      members: team.members.map((member) => ({
        ...member,
        firmas: basedatosFirmas(notes, member.studentId),
      })),
    };
  });
  return {
    ...base,
    released: state.released,
    releasedAt: state.released ? new Date().toISOString() : null,
    firmasMax: BASEDATOS_FIRMAS_MAX,
    teams,
    loadError: teams.length ? null : "No hay equipos de proyecto en este grupo. Revisa Roles / Equipos.",
  };
}

export function basedatosNote(
  code: string,
  student?: { studentId: string; displayName: string } | null,
  custom?: { label: string; points: number },
) {
  const preset = BASEDATOS_NOTAS.find((item) => item.code === code);
  const note: ExtraNote = {
    id: `basedatos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: custom ? "custom" : code,
    label: (custom?.label.trim() || preset?.label || code).slice(0, 140),
    points: Math.max(0, custom ? Math.round(custom.points) : (preset?.points ?? 0)),
    studentId: student?.studentId ?? null,
    studentName: student?.displayName ?? null,
    at: new Date().toISOString(),
  };
  return note;
}

export function studentBasedatosFromAnnouncements(
  extra: StudentExtra | null | undefined,
  announcements: AnnouncementLike[],
  studentId?: string | null,
): StudentImpro | null {
  const state = basedatosStateFromAnnouncements(announcements);
  if (!state.released) return null;
  const mine =
    state.roster.find((person) => studentId && person.studentId === studentId) ??
    state.roster.find((person) => extra?.displayName && person.displayName === extra.displayName);
  const teamName = mine?.teamName || (extra?.noTeam ? "" : extra?.teamName ?? "");
  const teamKey =
    mine?.teamKey ||
    Object.entries(state.teamNames).find(([, name]) => name && name === teamName)?.[0] ||
    "";
  const notes = teamKey ? (state.notes[teamKey] ?? []) : [];
  const meId = mine?.studentId ?? extra?.members.find((member) => member.displayName === extra.displayName)?.studentId ?? "";
  const applied = notes.filter((note) => !note.studentId || note.studentId === meId);
  const role = mine?.role ?? extra?.members.find((member) => member.studentId === meId)?.role ?? null;
  return {
    minutes: 0,
    rosterMode: "project",
    teamName: teamName || undefined,
    colorName: extra?.colorName ?? "cielo",
    hex: extra?.hex ?? "#38bdf8",
    columna: extra?.columna || teamName,
    displayName: mine?.displayName || extra?.displayName || "",
    isLeader: Boolean(extra?.isLeader),
    leaderId: extra?.leaderId ?? null,
    leaderName: extra?.leaderName ?? null,
    startedAt: null,
    firmasMax: BASEDATOS_FIRMAS_MAX,
    firmas: basedatosFirmas(applied, meId),
    notes: applied,
    noTeam: !teamName,
    members: extra?.noTeam ? [] : (extra?.members ?? []),
    role,
  };
}

export function basedatosGradeRows(session: ImproSession, teamKey?: string) {
  const teams = teamKey ? session.teams.filter((team) => team.key === teamKey) : session.teams;
  return teams.flatMap((team) =>
    team.members.map((member) => ({
      studentId: member.studentId,
      points: member.firmas ?? BASEDATOS_FIRMAS_MAX,
    })),
  );
}
