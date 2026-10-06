import { LECTURA_MINUTOS, LECTURA_PASOS, LECTURA_WIDGETS } from "../lib/lecturaTkinter";

export default function LecturaIndicacion() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Indicación para el grupo</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {LECTURA_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Tiempo</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white">
          {LECTURA_MINUTOS} minutos por equipo, desde que el líder pulsa Activar actividad. Lean, analicen,
          armen el mapa y prepárense para exponer dentro de ese reloj.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Un widget por equipo (grupo 301)</h3>
        <p className="mt-1 text-xs text-slate-400">
          El color de butacas decide el tema. No mezclen lecturas ni copien el Canva de otra columna.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LECTURA_WIDGETS.map((w) => (
            <span
              key={w}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200"
            >
              {w}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-rose-400/60 bg-rose-500/15 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-200">Al terminar el tiempo</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white">
          Levanten las manos. Cierren Canva y prepárense a exponer. Quien siga escribiendo después del reloj
          no alcanza a presentar con calma.
        </p>
      </div>
    </div>
  );
}
