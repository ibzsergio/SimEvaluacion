import {
  EXTRA_FIRMAS_MAX,
  EXTRA_MATERIALES,
  EXTRA_NOTAS,
  EXTRA_PASOS,
  EXTRA_PASOS_PREVIOS,
  EXTRA_PRODUCTO,
  EXTRA_PRODUCTO_DEBE,
  EXTRA_PRODUCTO_NO,
} from "../lib/extraScrum";

export default function ExtraIndicacion() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Del proyecto a la interfaz</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
          {EXTRA_PASOS_PREVIOS.map((paso) => (
            <li key={paso.n}>
              <span className="font-semibold text-white">{paso.titulo}.</span> {paso.detalle}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Qué entregan hoy</h3>
        <p className="mt-2 text-sm text-slate-300">{EXTRA_PRODUCTO}</p>
        <p className="mt-2 text-sm text-amber-100">{EXTRA_PRODUCTO_NO}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {EXTRA_PRODUCTO_DEBE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
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
        <h3 className="text-sm font-semibold text-white">Firmas</h3>
        <p className="mt-2 text-sm text-slate-300">
          Parte de {EXTRA_FIRMAS_MAX.toLocaleString("es-MX")} Firmas por integrante. El docente
          supervisa y anota; cada nota baja ese valor.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          {EXTRA_NOTAS.map((nota) => (
            <li key={nota.code}>
              {nota.label}
              {nota.scope === "member" ? " (al integrante)" : " (al equipo)"}:{" "}
              <span className="text-amber-200">−{nota.points} Firmas</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
