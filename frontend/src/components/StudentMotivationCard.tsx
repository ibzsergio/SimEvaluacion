import type { StudentProgress } from "../lib/types";

export default function StudentMotivationCard({
  motivation,
}: {
  motivation: StudentProgress["motivation"];
}) {
  const styles = motivation.inTop10
    ? "border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10"
    : "border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-rose-500/5";

  return (
    <section className={`glass mt-6 border p-5 ${styles}`}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="text-4xl" aria-hidden>
          {motivation.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Tu lugar en el ranking · #{motivation.place} de {motivation.totalStudents}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{motivation.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{motivation.message}</p>
          {!motivation.inTop10 && motivation.pointsToTop10 != null && motivation.pointsToTop10 > 0 ? (
            <p className="mt-2 text-xs font-medium text-amber-200/90">
              Meta sugerida: suma {motivation.pointsToTop10} punto
              {motivation.pointsToTop10 === 1 ? "" : "s"} para empatar con el puesto #10.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
