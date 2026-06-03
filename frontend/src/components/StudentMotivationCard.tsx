import type { StudentProgress } from "../lib/types";

export default function StudentMotivationCard({
  motivation,
}: {
  motivation: StudentProgress["motivation"];
}) {
  const styles = motivation.inTop10
    ? "border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 via-indigo-500/10 to-slate-900/40"
    : "border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-rose-500/5 to-slate-900/40";

  return (
    <section className={`glass mb-6 border p-6 ${styles}`}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="text-5xl" aria-hidden>
          {motivation.dailyEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/90">
            Mensaje del día
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
            ¡Hola, {motivation.firstName}!
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">{motivation.displayName}</p>
          <p className="mt-3 text-base leading-relaxed text-slate-200">{motivation.dailyMessage}</p>
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="text-2xl" aria-hidden>
            {motivation.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Tu lugar en el ranking · #{motivation.place} de {motivation.totalStudents}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{motivation.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{motivation.message}</p>
            {!motivation.inTop10 && motivation.pointsToTop10 != null && motivation.pointsToTop10 > 0 ? (
              <p className="mt-2 text-xs font-medium text-amber-200/90">
                Meta sugerida: suma {motivation.pointsToTop10} punto
                {motivation.pointsToTop10 === 1 ? "" : "s"} para empatar con el puesto #10.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
