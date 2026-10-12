import {
  AVION_MARCHA_PASOS,
  AVION_MARCHA_QA_COLUMNAS,
  AVION_MARCHA_QA_FILAS,
  AVION_MARCHA_TITULO,
  AVION_MATERIALES,
  avionTeamLabel,
} from "../lib/avionScrum";
import type { AvionMarchaPair } from "../lib/types";

export default function AvionMarchaIndicacion({
  pairs = [],
  rival = null,
}: {
  pairs?: AvionMarchaPair[];
  rival?: { colorName: string; hex: string; leaderName?: string | null } | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-emerald-400/60 bg-emerald-500/15 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">{AVION_MARCHA_TITULO}</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white">
          Competencia por eliminación directa. QA toma nota. Manos quietas: ya no se arma, solo se lanza.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Cómo se compite</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {AVION_MARCHA_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Ronda 1</h3>
        <p className="mt-1 text-sm text-slate-300">
          Todos los equipos lanzan al mismo tiempo, a la cuenta del docente. El que vuele menos o se desarme
          queda en riesgo de salir. QA anota distancia y errores de ese vuelo.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Ronda 2</h3>
        <p className="mt-1 text-sm text-slate-300">
          El docente designa quién contra quién. Solo esos equipos lanzan. Sigue siendo eliminación directa.
        </p>
        {rival ? (
          <p className="mt-2 rounded-xl border px-3 py-2 text-sm font-semibold text-white" style={{ borderColor: `${rival.hex}88` }}>
            Tu rival:{" "}
            <span style={{ color: rival.hex }}>{avionTeamLabel(rival.colorName, rival.leaderName)}</span>
          </p>
        ) : null}
        {pairs.length ? (
          <ul className="mt-2 space-y-1.5">
            {pairs.map((pair) => (
              <li
                key={`${pair.a.key}-${pair.b.key}`}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
              >
                <span className="font-semibold" style={{ color: pair.a.hex }}>
                  {avionTeamLabel(pair.a.colorName, pair.a.leaderName)}
                </span>
                {" vs "}
                <span className="font-semibold" style={{ color: pair.b.hex }}>
                  {avionTeamLabel(pair.b.colorName, pair.b.leaderName)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">El docente publicará los enfrentamientos de la ronda 2.</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Reporte del QA (competencia)</h3>
        <p className="mt-1 text-xs text-slate-400">
          Además de la distancia, anoten qué falló o qué errores notaron en cada vuelo. Sin esa nota, el
          resultado no cuenta.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-xs sm:text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                {AVION_MARCHA_QA_COLUMNAS.map((col) => (
                  <th key={col} className="px-2 py-2 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AVION_MARCHA_QA_FILAS.map((fila) => (
                <tr key={fila} className="border-t border-white/10 text-slate-200">
                  <td className="px-2 py-2 font-semibold text-sky-100">{fila}</td>
                  <td className="px-2 py-2 text-slate-500">____________</td>
                  <td className="px-2 py-2 text-slate-500">____ m</td>
                  <td className="px-2 py-2 text-slate-500">qué se aflojó / qué no voló</td>
                  <td className="px-2 py-2 text-slate-500">Pasa / Fuera</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-rose-400/60 bg-rose-500/15 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-200">Descalificación automática</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white">
          Si un avión es ganador en cualquier competencia y no cumple los materiales pedidos al inicio,
          queda fuera aunque haya volado más lejos.
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-rose-100">
          {AVION_MATERIALES.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>Avión de papel doblado = no válido</li>
        </ul>
      </div>
    </div>
  );
}
