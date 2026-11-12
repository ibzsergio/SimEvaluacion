import { sqlScrumGithub, type SqlScrumKey } from "../lib/sqlScrum";

export default function SqlScrumGithubSteps({ activityKey }: { activityKey: SqlScrumKey }) {
  const guia = sqlScrumGithub(activityKey);
  return (
    <div className="mt-4 rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Grupo 302 · GitHub</p>
      <h3 className="mt-1 text-lg font-bold text-white">Un solo proyecto de GitHub, además del PDF</h3>
      <p className="mt-2 text-sm leading-relaxed text-sky-100">
        El líder reparte una tabla por integrante. Cada quien crea el script de su tabla y, en otra aplicación, el
        Tkinter que se conecta a esa tabla y hace el CRUD. Esas dos cosas de todos se juntan en un solo repositorio.
        El PDF se sigue subiendo aquí, con las evidencias. No instalen nada: se hace en la página de GitHub. Sigan los
        pasos en este orden.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-100">
        {guia.pasos.map((paso) => (
          <li key={paso.texto}>
            <span className="font-semibold text-white">{paso.quien}. </span>
            {paso.texto}
          </li>
        ))}
      </ol>
    </div>
  );
}
