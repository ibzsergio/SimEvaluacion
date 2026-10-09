import {
  AVION_CRITERIOS,
  AVION_MATERIALES,
  AVION_PASOS,
  AVION_PUNTAJE,
  AVION_PUNTOS_MAX,
  AVION_QA_COLUMNAS,
  AVION_QA_FILAS,
  AVION_QA_PARAMETROS,
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
        <h3 className="text-sm font-semibold text-white">Materiales</h3>
        <p className="mt-1 text-xs text-slate-400">
          Papel cascarón o ilustración, palillos, palos de paleta y silicón frío son la base. Combínenlos para
          que vuele, recorra distancia y no se desarme.
        </p>
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
        <h3 className="text-sm font-semibold text-white">Roles Scrum (todos construyen)</h3>
        <p className="mt-1 text-xs text-slate-400">
          El rol dice de qué te haces cargo. No deja el avión a una sola persona: en 45 minutos hay que
          organizarse y armar entre todos.
        </p>
        <ul className="mt-2 space-y-2">
          {AVION_ROLES.map((rol) => (
            <li key={rol.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-200">{rol.label}</p>
              <p className="mt-1 text-sm text-slate-200">{rol.tarea}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">QA: qué debe entregar</h3>
        <p className="mt-1 text-xs text-slate-400">
          En una hoja, encabezado con nombre del equipo e integrantes. Luego 3 pruebas + el vuelo oficial,
          con estos parámetros:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {AVION_QA_PARAMETROS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-xs sm:text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                {AVION_QA_COLUMNAS.map((col) => (
                  <th key={col} className="px-2 py-2 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AVION_QA_FILAS.map((fila) => (
                <tr key={fila} className="border-t border-white/10 text-slate-200">
                  <td className="px-2 py-2 font-semibold text-sky-100">{fila}</td>
                  <td className="px-2 py-2 text-slate-500">____________</td>
                  <td className="px-2 py-2 text-slate-500">____ m</td>
                  <td className="px-2 py-2 text-slate-500">Sí / No</td>
                  <td className="px-2 py-2 text-slate-500">recto / giro / picada</td>
                  <td className="px-2 py-2 text-slate-500">____________</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Encabezado de la hoja: Nombre del equipo · Integrantes · Fecha. Sin esa tabla, no hay calificación
          del vuelo.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-rose-400/60 bg-rose-500/15 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-200">Al terminar el tiempo</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white">
          Levanten las manos y no sigan cortando, pegando ni moviendo piezas. El lanzamiento oficial se hace
          con el avión y la tabla de QA que tengan en ese momento.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">Cómo se califica</h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Criterio</th>
                <th className="px-3 py-2 font-semibold">Peso</th>
              </tr>
            </thead>
            <tbody>
              {AVION_CRITERIOS.map((fila) => (
                <tr key={fila.criterio} className="border-t border-white/10 text-slate-200">
                  <td className="px-3 py-2">{fila.criterio}</td>
                  <td className="px-3 py-2 font-semibold text-sky-100">{fila.peso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          El valor máximo es {AVION_PUNTOS_MAX} puntos por integrante según el lugar por distancia, siempre
          que el avión no se desarme, lleve el nombre del equipo y tenga diseño.
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
