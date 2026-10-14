import { EXTRA_MATERIALES, EXTRA_PASOS, EXTRA_PUNTAJE, EXTRA_PUNTOS_MAX } from "../lib/extraScrum";

export default function ExtraIndicacion() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Material (el que trajeron)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {EXTRA_MATERIALES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Cómo se juega</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
          {EXTRA_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Al terminar el reloj</h3>
        <p className="mt-2 text-sm text-slate-300">
          Levanten las manos. Quien siga recortando o pegando queda fuera del 1°. Cada equipo grita su
          titular. El ganador obtiene {EXTRA_PUNTOS_MAX} puntos por integrante.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          {EXTRA_PUNTAJE.map((row) => (
            <li key={row.lugar}>
              {row.etiqueta}: <span className="text-amber-200">{row.puntos} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
