import { TORRE_PASOS, TORRE_PUNTAJE, TORRE_PUNTOS_MAX } from "../lib/torreTkinter";

export default function TorreIndicacion() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Indicación para el grupo</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {TORRE_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border-2 border-rose-400/60 bg-rose-500/15 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-200">Al terminar el tiempo</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white">
          Levanten las manos de inmediato y no sigan con la construcción de la torre. Quien siga armando
          después del reloj queda fuera de la medición.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Puntaje por integrante (6 equipos)</h3>
        <p className="mt-1 text-xs text-slate-400">
          El valor máximo es {TORRE_PUNTOS_MAX} puntos para cada integrante. El puntaje baja según la altura
          de la torre (la que se sostenga sola, con la bandera Tkinter en la cima).
        </p>
        <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Lugar por altura</th>
                <th className="px-3 py-2 font-semibold">Puntos por integrante</th>
              </tr>
            </thead>
            <tbody>
              {TORRE_PUNTAJE.map((fila) => (
                <tr
                  key={fila.lugar}
                  className={
                    fila.lugar === 1
                      ? "bg-emerald-500/15 text-emerald-100"
                      : "border-t border-white/10 text-slate-200"
                  }
                >
                  <td className="px-3 py-2">{fila.etiqueta}</td>
                  <td className="px-3 py-2 font-bold tabular-nums">{fila.puntos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
