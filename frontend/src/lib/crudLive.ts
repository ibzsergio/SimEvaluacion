import type { Announcement, ExtraNote } from "./types";
import { CRUD_NOTAS } from "./crudScrum";

export const CRUD_ANNOUNCEMENT_TITLE = "CRUDS BD";
/** El aviso anterior se llamaba TEST. Se sigue leyendo para no perder una liberación ya guardada. */
export const CRUD_ANNOUNCEMENT_TITLES = [CRUD_ANNOUNCEMENT_TITLE, "TEST"] as const;
const MARK = "[[crud-state]]";

export type CrudLiveState = {
  v: 1;
  released: boolean;
  notes: Record<string, ExtraNote[]>;
};

export const EMPTY_CRUD_STATE: CrudLiveState = { v: 1, released: false, notes: {} };

type AnnouncementLike = Pick<Announcement, "title" | "body" | "createdAt" | "groupId">;

export function isCrudAnnouncement(title: string) {
  return (CRUD_ANNOUNCEMENT_TITLES as readonly string[]).includes(title);
}

export function crudPublicText(body: string) {
  const idx = body.indexOf(MARK);
  return (idx >= 0 ? body.slice(0, idx) : body).trim();
}

export function parseCrudState(body: string): CrudLiveState | null {
  const idx = body.indexOf(MARK);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + MARK.length).trim()) as Partial<CrudLiveState>;
    if (!parsed || parsed.v !== 1) return null;
    const notes =
      parsed.notes && typeof parsed.notes === "object"
        ? Object.fromEntries(
            Object.entries(parsed.notes).filter((entry): entry is [string, ExtraNote[]] => Array.isArray(entry[1])),
          )
        : {};
    return { v: 1, released: Boolean(parsed.released), notes };
  } catch {
    return null;
  }
}

function visibleCopy(state: CrudLiveState) {
  if (state.released) {
    return "CRUDS BD está liberada. El líder reparte las 5 tablas. En el PDF se ve a cada integrante con su tabla, su script y el CRUD funcionando.";
  }
  return "CRUDS BD está en preparación para este grupo.";
}

export function serializeCrudState(state: CrudLiveState) {
  return `${visibleCopy(state)}\n\n${MARK}\n${JSON.stringify(state)}`;
}

export function crudStateFromAnnouncements(announcements: AnnouncementLike[], groupId?: string) {
  const matches = announcements
    .filter((item) => isCrudAnnouncement(item.title))
    .filter((item) => !groupId || item.groupId === groupId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const item of matches) {
    const parsed = parseCrudState(item.body);
    if (parsed) return parsed;
  }
  return { ...EMPTY_CRUD_STATE, notes: {} };
}

export function crudNote(
  code: string,
  student?: { studentId: string; displayName: string } | null,
  custom?: { label: string; points: number },
) {
  const preset = CRUD_NOTAS.find((item) => item.code === code);
  const note: ExtraNote = {
    id: `crud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: custom ? "custom" : code,
    label: (custom?.label.trim() || preset?.label || code).slice(0, 140),
    points: Math.max(0, custom ? Math.round(custom.points) : (preset?.points ?? 0)),
    studentId: student?.studentId ?? null,
    studentName: student?.displayName ?? null,
    at: new Date().toISOString(),
  };
  return note;
}

export function studentCrudReleased(announcements: AnnouncementLike[]) {
  return crudStateFromAnnouncements(announcements).released;
}
