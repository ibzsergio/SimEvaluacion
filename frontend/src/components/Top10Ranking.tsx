export type Top10Entry = {
  studentId: string;
  displayName: string;
  listNumber: number | null;
  controlNumber?: string | null;
  score: number;
  place: number;
};

export function rankMedal(place: number) {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return `${place}.`;
}

export default function Top10Ranking({
  entries,
  emptyMessage = "Aún no hay puntajes en el grupo.",
  highlightStudentId,
}: {
  entries: Top10Entry[];
  emptyMessage?: string;
  /** Resalta la fila del alumno actual en la lista. */
  highlightStudentId?: string;
}) {
  const top10 = entries.slice(0, 10);

  if (!top10.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ol className="space-y-2">
      {top10.map((entry) => {
        const medal = rankMedal(entry.place);
        const isPodium = entry.place <= 3;
        const isMe = highlightStudentId != null && entry.studentId === highlightStudentId;
        return (
          <li
            key={entry.studentId}
            className={`flex items-center justify-between rounded-xl border px-4 py-2 ${
              isMe
                ? "border-indigo-400/50 bg-indigo-500/15 ring-1 ring-indigo-400/30"
                : isPodium
                  ? "border-cyan-400/25 bg-cyan-500/10"
                  : "border-white/5 bg-slate-900/40"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`w-10 shrink-0 text-center ${isPodium ? "text-lg" : "text-sm font-bold text-slate-400"}`}
              >
                {medal}
              </span>
              <div className="min-w-0">
                <span className="font-medium text-white">
                  {entry.listNumber != null ? `${entry.listNumber}. ` : ""}
                  {entry.displayName}
                  {isMe ? <span className="ml-2 text-xs font-bold text-indigo-200">(Tú)</span> : null}
                </span>
                {entry.controlNumber ? (
                  <p className="font-mono text-xs text-slate-500">{entry.controlNumber}</p>
                ) : null}
              </div>
            </div>
            <span className="shrink-0 font-bold text-cyan-300">{entry.score} pts</span>
          </li>
        );
      })}
    </ol>
  );
}
