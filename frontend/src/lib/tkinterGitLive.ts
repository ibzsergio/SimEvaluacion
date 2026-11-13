import type { Announcement, ExtraNote, ExtraSession, ImproSession } from "./types";
import { TKINTER_GIT_FIRMAS, TKINTER_GIT_MINUTOS, TKINTER_GIT_NOTAS, TKINTER_GIT_TITULO } from "./tkinterGit";

const MARK = "[[tkinter-git-state]]";

export type TkinterGitLiveState = {
  v: 1;
  startedAt: string | null;
  pausedAt: string | null;
  resetClock?: boolean;
  notes: Record<string, ExtraNote[]>;
  awarded: string[];
};

const EMPTY: TkinterGitLiveState = {
  v: 1,
  startedAt: null,
  pausedAt: null,
  notes: {},
  awarded: [],
};

type AnnouncementLike = Pick<Announcement, "title" | "body" | "createdAt" | "groupId">;

export function parseTkinterGitState(body: string): TkinterGitLiveState | null {
  const idx = body.indexOf(MARK);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<TkinterGitLiveState>;
    if (!parsed || parsed.v !== 1) return null;
    return {
      v: 1,
      startedAt: typeof parsed.startedAt === "string" && parsed.startedAt ? parsed.startedAt : null,
      pausedAt: typeof parsed.pausedAt === "string" && parsed.pausedAt ? parsed.pausedAt : null,
      resetClock: Boolean(parsed.resetClock),
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
      awarded: Array.isArray(parsed.awarded) ? parsed.awarded.filter((id) => typeof id === "string") : [],
    };
  } catch {
    return null;
  }
}

export function serializeTkinterGitState(state: TkinterGitLiveState) {
  return `${TKINTER_GIT_TITULO} está en preparación. Los alumnos todavía no la ven.\n\n${MARK}\n${JSON.stringify(state)}`;
}

export function tkinterGitStateFromAnnouncements(announcements: AnnouncementLike[], groupId?: string) {
  const matches = announcements
    .filter((item) => item.title === TKINTER_GIT_TITULO)
    .filter((item) => !groupId || item.groupId === groupId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const item of matches) {
    const parsed = parseTkinterGitState(item.body);
    if (parsed) return parsed;
  }
  return { ...EMPTY, notes: {}, awarded: [] };
}

export function tkinterGitFirmas(notes: ExtraNote[]) {
  const cut = notes.reduce((acc, note) => acc + Math.max(0, note.points), 0);
  return Math.max(0, TKINTER_GIT_FIRMAS - cut);
}

export function tkinterGitSessionFromTeams(base: ExtraSession, state: TkinterGitLiveState): ImproSession {
  const teams = base.teams.map((team) => {
    const notes = state.notes[team.key] ?? [];
    const firmas = tkinterGitFirmas(notes);
    return {
      ...team,
      startedAt: state.startedAt,
      notes,
      awarded: state.awarded.includes(team.key),
      firmasMax: TKINTER_GIT_FIRMAS,
      members: team.members.map((member) => ({ ...member, firmas })),
    };
  });
  return {
    ...base,
    released: false,
    releasedAt: null,
    paused: Boolean(state.pausedAt),
    pausedAt: state.pausedAt,
    minutes: TKINTER_GIT_MINUTOS,
    firmasMax: TKINTER_GIT_FIRMAS,
    teamCount: teams.length,
    teams,
    loadError: teams.length ? null : "No hay equipos de proyecto en este grupo. Revisa Roles / Equipos.",
    sharedClock: true,
  };
}

export function tkinterGitNote(code: string, custom?: { label: string; points: number }) {
  const preset = TKINTER_GIT_NOTAS.find((item) => item.code === code);
  const note: ExtraNote = {
    id: `git-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: custom ? "custom" : code,
    label: (custom?.label.trim() || preset?.label || code).slice(0, 140),
    points: Math.max(0, custom ? Math.round(custom.points) : (preset?.points ?? 0)),
    studentId: null,
    studentName: null,
    at: new Date().toISOString(),
  };
  return note;
}

export function tkinterGitGradeRows(session: ImproSession, teamKey?: string) {
  const teams = teamKey ? session.teams.filter((team) => team.key === teamKey) : session.teams;
  return teams.flatMap((team) =>
    team.members.map((member) => ({
      studentId: member.studentId,
      points: member.firmas ?? TKINTER_GIT_FIRMAS,
    })),
  );
}
