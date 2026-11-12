import type { Announcement, ExtraNote } from "./types";
import { SQL_SCRUM_ACTIVITIES, SQL_SCRUM_NOTAS, type SqlScrumKey } from "./sqlScrum";

export type SqlScrumLiveState = {
  v: 1;
  notes: Record<string, ExtraNote[]>;
};

const EMPTY: SqlScrumLiveState = { v: 1, notes: {} };

export function sqlScrumMark(key: SqlScrumKey) {
  return `[[sql-scrum:${key}]]`;
}

export function sqlScrumTitle(key: SqlScrumKey) {
  return SQL_SCRUM_ACTIVITIES.find((item) => item.key === key)?.title ?? key;
}

export function isSqlScrumAnnouncement(title: string) {
  return SQL_SCRUM_ACTIVITIES.some((item) => item.title === title);
}

export function sqlScrumPublicText(body: string) {
  const cut = body.search(/\[\[sql-scrum:/);
  return (cut >= 0 ? body.slice(0, cut) : body).trim();
}

export function parseSqlScrumState(body: string, key: SqlScrumKey): SqlScrumLiveState | null {
  const mark = sqlScrumMark(key);
  const idx = body.indexOf(mark);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(idx + mark.length).trim()) as Partial<SqlScrumLiveState>;
    if (!parsed || parsed.v !== 1) return null;
    const notes =
      parsed.notes && typeof parsed.notes === "object"
        ? Object.fromEntries(
            Object.entries(parsed.notes).filter((entry): entry is [string, ExtraNote[]] => Array.isArray(entry[1])),
          )
        : {};
    return { v: 1, notes };
  } catch {
    return null;
  }
}

export function serializeSqlScrumState(key: SqlScrumKey, state: SqlScrumLiveState) {
  const title = sqlScrumTitle(key);
  const visible = `${title} está publicada. Un integrante sube el PDF del equipo. Vale 2000 puntos.`;
  return `${visible}\n\n${sqlScrumMark(key)}\n${JSON.stringify(state)}`;
}

export function sqlScrumStateFromAnnouncements(
  announcements: Array<Pick<Announcement, "title" | "body" | "createdAt" | "groupId">>,
  key: SqlScrumKey,
  groupId?: string,
) {
  const title = sqlScrumTitle(key);
  const matches = announcements
    .filter((item) => item.title === title)
    .filter((item) => !groupId || item.groupId === groupId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const item of matches) {
    const parsed = parseSqlScrumState(item.body, key);
    if (parsed) return parsed;
  }
  return { ...EMPTY, notes: {} };
}

export function sqlScrumNote(
  code: string,
  student?: { studentId: string; displayName: string } | null,
  custom?: { label: string; points: number },
) {
  const preset = SQL_SCRUM_NOTAS.find((item) => item.code === code);
  const note: ExtraNote = {
    id: `sql-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: custom ? "custom" : code,
    label: (custom?.label.trim() || preset?.label || code).slice(0, 140),
    points: Math.max(0, custom ? Math.round(custom.points) : (preset?.points ?? 0)),
    studentId: student?.studentId ?? null,
    studentName: student?.displayName ?? null,
    at: new Date().toISOString(),
  };
  return note;
}
