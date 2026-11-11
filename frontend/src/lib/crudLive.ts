import type { Announcement } from "./types";

export const CRUD_ANNOUNCEMENT_TITLE = "TEST";
const MARK = "[[crud-state]]";

export type CrudLiveState = {
  v: 1;
  released: boolean;
};

export const EMPTY_CRUD_STATE: CrudLiveState = { v: 1, released: false };

type AnnouncementLike = Pick<Announcement, "title" | "body" | "createdAt" | "groupId">;

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
    return { v: 1, released: Boolean(parsed.released) };
  } catch {
    return null;
  }
}

function visibleCopy(state: CrudLiveState) {
  if (state.released) {
    return "TEST está liberada. El ejemplo solo se conecta. El equipo entrega el script y el CRUD de las 5 tablas en un PDF.";
  }
  return "TEST está en preparación para este grupo.";
}

export function serializeCrudState(state: CrudLiveState) {
  return `${visibleCopy(state)}\n\n${MARK}\n${JSON.stringify(state)}`;
}

export function crudStateFromAnnouncements(announcements: AnnouncementLike[], groupId?: string) {
  const matches = announcements
    .filter((item) => item.title === CRUD_ANNOUNCEMENT_TITLE)
    .filter((item) => !groupId || item.groupId === groupId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const item of matches) {
    const parsed = parseCrudState(item.body);
    if (parsed) return parsed;
  }
  return { ...EMPTY_CRUD_STATE };
}

export function studentCrudReleased(announcements: AnnouncementLike[]) {
  return crudStateFromAnnouncements(announcements).released;
}
