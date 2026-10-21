import {
  IMPRO_FIRMAS_MAX,
  IMPRO_MATERIALES,
  IMPRO_NOTAS,
  IMPRO_PASOS,
  IMPRO_PRODUCTO,
  IMPRO_PRODUCTO_DEBE,
  IMPRO_PRODUCTO_NO,
  IMPRO_PROHIBIDO,
  IMPRO_ROLES,
  IMPRO_SPRINTS,
} from "../lib/improScrum";

export default function ImproIndicacion() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">El producto</h3>
        <p className="mt-2 text-sm text-slate-300">{IMPRO_PRODUCTO}</p>
        <p className="mt-2 text-sm text-amber-100">{IMPRO_PRODUCTO_NO}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {IMPRO_PRODUCTO_DEBE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Material</h3>
        <p className="mt-2 text-sm text-slate-300">
          Con esto se arma. Hojas de color para la forma, tijeras para el corte, pegamento y diurex
          para que se pare.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {IMPRO_MATERIALES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">No se vale</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {IMPRO_PROHIBIDO.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Cómo se juega</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
          {IMPRO_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Sprints dentro de los 50 minutos</h3>
        {IMPRO_SPRINTS.map((sprint) => (
          <div key={sprint.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-200">
              {sprint.nombre} · min {sprint.desde}–{sprint.hasta}
            </p>
            <p className="mt-1 text-sm text-slate-200">{sprint.detalle}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Su rol de proyecto</h3>
        <p className="text-sm text-slate-400">
          Conservan el rol de Roles / Equipos. Todos construyen. Si hay un sexto integrante, ayuda con
          la pieza que se mueve y con el ensayo de 60 segundos.
        </p>
        {IMPRO_ROLES.map((rol) => (
          <div key={rol.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-200">{rol.label}</p>
            <p className="mt-1 text-sm text-slate-200">{rol.tarea}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Firmas</h3>
        <p className="mt-2 text-sm text-slate-300">
          Parte de {IMPRO_FIRMAS_MAX.toLocaleString("es-MX")} Firmas por integrante. El docente
          supervisa y anota; cada nota baja ese valor.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          {IMPRO_NOTAS.map((nota) => (
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
