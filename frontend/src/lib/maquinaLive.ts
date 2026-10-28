import { MAQUINA_FIRMAS_MAX, MAQUINA_MINUTOS, MAQUINA_NOTAS } from "./maquinaScrum";
import type { Announcement, ExtraNote, ExtraSession, ImproSession, StudentExtra, StudentImpro } from "./types";

export const MAQUINA_ANNOUNCEMENT_TITLE = "La máquina";
const MARK = "[[maquina-state]]";

export type MaquinaLiveState = {
  v: 1;
  released: boolean;
  startedAt: string | null;
  pausedAt: string | null;
  notes: Record<string, ExtraNote[]>;
  awarded: string[];
  teamNames: Record<string, string>;
};

export const EMPTY_MAQUINA_STATE: MaquinaLiveState = {
  v: 1,
  released: false,
  startedAt: null,
  pausedAt: null,
  notes: {},
  awarded: [],
  teamNames: {},
};

type AnnouncementLike = Pick<Announcement, "title" | "body" | "createdAt" | "groupId">;

export function maquinaPublicText(body: string) {
  const idx = body.indexOf(MARK);
  return (idx >= 0 ? body.slice(0, idx) : body).trim();
}

export function parseMaquinaState(body: string): MaquinaLiveState | null {
  const idx = body.indexOf(MARK);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<MaquinaLiveState>;
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

function visibleCopy(state: MaquinaLiveState) {
  if (state.startedAt && !state.pausedAt) {
    return "El reloj de La máquina ya inició. Pueden salir por cartón, palos de madera y unicel. La ficha tiene que recorrer sola las 3 estaciones de su programa.";
  }
  if (state.pausedAt) {
    return "El docente pausó el reloj de La máquina. Esperen a que lo reanude.";
  }
  if (state.released) {
    return "La máquina está liberada. Esperen a que el docente inicie los 50 minutos. Van a construir una máquina de su programa: la ficha entra, pasa por 3 estaciones y sale sola.";
  }
  return "La máquina está en preparación para este grupo.";
}

export function serializeMaquinaState(state: MaquinaLiveState) {
  return `${visibleCopy(state)}\n\n${MARK}\n${JSON.stringify(state)}`;
}

export function maquinaStateFromAnnouncements(announcements: AnnouncementLike[], groupId?: string) {
  const matches = announcements
    .filter((item) => item.title === MAQUINA_ANNOUNCEMENT_TITLE)
    .filter((item) => !groupId || item.groupId === groupId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const item of matches) {
    const parsed = parseMaquinaState(item.body);
    if (parsed) return parsed;
  }
  return { ...EMPTY_MAQUINA_STATE, notes: {}, awarded: [], teamNames: {} };
}

export function memberFirmas(notes: ExtraNote[], studentId: string) {
  const cut = notes
    .filter((note) => !note.studentId || note.studentId === studentId)
    .reduce((acc, note) => acc + Math.max(0, note.points), 0);
  return Math.max(0, MAQUINA_FIRMAS_MAX - cut);
}

export function withTeamNames(state: MaquinaLiveState, teams: ExtraSession["teams"]): MaquinaLiveState {
  return {
    ...state,
    teamNames: Object.fromEntries(teams.map((team) => [team.key, team.name ?? team.columna ?? team.key])),
  };
}

export function maquinaSessionFromProjectTeams(base: ExtraSession, state: MaquinaLiveState): ImproSession {
  const teams = base.teams.map((team) => {
    const notes = state.notes[team.key] ?? [];
    return {
      ...team,
      startedAt: state.startedAt,
      notes,
      awarded: state.awarded.includes(team.key),
      firmasMax: MAQUINA_FIRMAS_MAX,
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
    minutes: MAQUINA_MINUTOS,
    firmasMax: MAQUINA_FIRMAS_MAX,
    teamCount: teams.length,
    teams,
    loadError: teams.length ? null : "No hay equipos de proyecto en este grupo. Revisa Roles / Equipos.",
    sharedClock: true,
  };
}

export function maquinaNote(code: string) {
  const preset = MAQUINA_NOTAS.find((item) => item.code === code);
  const note: ExtraNote = {
    id: `maquina-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code,
    label: preset?.label ?? code,
    points: preset?.points ?? 0,
    studentId: null,
    studentName: null,
    at: new Date().toISOString(),
  };
  return note;
}

export function studentMaquinaFromAnnouncements(
  extra: StudentExtra | null | undefined,
  announcements: AnnouncementLike[],
): StudentImpro | null {
  const state = maquinaStateFromAnnouncements(announcements);
  if (!state.released) return null;
  const teamName = extra?.noTeam ? "" : extra?.teamName ?? "";
  const teamKey =
    Object.entries(state.teamNames).find(([, name]) => name && name === teamName)?.[0] ?? "";
  const notes = teamKey ? (state.notes[teamKey] ?? []) : [];
  const me = extra?.members.find((member) => member.displayName === extra.displayName);
  const applied = notes.filter((note) => !note.studentId || note.studentId === me?.studentId);
  const firmas = memberFirmas(applied, me?.studentId ?? "");
  return {
    minutes: MAQUINA_MINUTOS,
    rosterMode: "project",
    teamName: extra?.noTeam ? undefined : extra?.teamName,
    colorName: extra?.colorName ?? "lima",
    hex: extra?.hex ?? "#84cc16",
    columna: extra?.columna || extra?.teamName || "",
    displayName: extra?.displayName ?? "",
    isLeader: Boolean(extra?.isLeader),
    leaderId: extra?.leaderId ?? null,
    leaderName: extra?.leaderName ?? null,
    startedAt: state.startedAt,
    pausedAt: state.pausedAt,
    firmasMax: MAQUINA_FIRMAS_MAX,
    firmas,
    notes: applied,
    noTeam: !extra || Boolean(extra.noTeam) || !extra.teamName,
    members: extra?.noTeam ? [] : (extra?.members ?? []),
    role: me?.role ?? null,
    sharedClock: true,
  };
}

export function maquinaGradeRows(session: ImproSession, teamKey?: string) {
  const teams = teamKey ? session.teams.filter((team) => team.key === teamKey) : session.teams;
  return teams.flatMap((team) =>
    team.members.map((member) => ({
      studentId: member.studentId,
      points: member.firmas ?? MAQUINA_FIRMAS_MAX,
    })),
  );
}
