import {
  AVION_MATERIALES,
  AVION_PASOS,
  AVION_PUNTAJE,
  AVION_PUNTOS_MAX,
  AVION_REQUISITOS,
  AVION_ROLES,
} from "../lib/avionScrum";

export default function AvionIndicacion() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Indicación para el grupo</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {AVION_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Materiales (usen varios, no solo papel)</h3>
        <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {AVION_MATERIALES.map((item) => (
            <li key={item} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Para que cuente el avión</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {AVION_REQUISITOS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Roles Scrum (cada quien el suyo)</h3>
        <ul className="mt-2 space-y-2">
          {AVION_ROLES.map((rol) => (
            <li key={rol.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-200">{rol.label}</p>
              <p className="mt-1 text-sm text-slate-200">{rol.tarea}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border-2 border-rose-400/60 bg-rose-500/15 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-200">Al terminar el tiempo</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white">
          Levanten las manos y no sigan cortando, pegando ni moviendo lastre. El lanzamiento oficial se hace
          con el avión y la bitácora que tengan en ese momento.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Puntaje por integrante (6 equipos)</h3>
        <p className="mt-1 text-xs text-slate-400">
          El valor máximo es {AVION_PUNTOS_MAX} puntos para cada integrante. El puntaje baja según la distancia
          del vuelo oficial.
        </p>
        <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Lugar por distancia</th>
                <th className="px-3 py-2 font-semibold">Puntos por integrante</th>
              </tr>
            </thead>
            <tbody>
              {AVION_PUNTAJE.map((fila) => (
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
