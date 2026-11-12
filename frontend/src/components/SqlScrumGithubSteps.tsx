import { sqlScrumGithub, type SqlScrumKey } from "../lib/sqlScrum";

export default function SqlScrumGithubSteps({ activityKey }: { activityKey: SqlScrumKey }) {
  const guia = sqlScrumGithub(activityKey);
  return (
    <div className="mt-4 rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Grupo 302 · GitHub</p>
      <h3 className="mt-1 text-lg font-bold text-white">Un solo proyecto de GitHub, además del PDF</h3>
      <p className="mt-2 text-sm leading-relaxed text-sky-100">
        Es la primera vez que usan GitHub. Van despacio y en orden. Un paso termina cuando ven lo que dice al final.
        Todo se hace en la página github.com. El líder reparte una tabla. Cada integrante sube dos archivos de esa
        tabla: su script y su aplicación de Tkinter. El PDF, con las evidencias, se entrega aquí.
      </p>
      <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-slate-100">
        {guia.pasos.map((paso) => (
          <li key={paso.titulo}>
            <p className="font-semibold text-white">
              {paso.quien}. {paso.titulo}
            </p>
            <ul className="mt-1 space-y-1">
              {paso.lineas.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
            {paso.ejemplo ? (
              <p className="mt-2 rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-emerald-200">Escribe esto: {paso.ejemplo}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
