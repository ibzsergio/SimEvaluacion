import { sqlScrumGithub, type SqlScrumKey } from "../lib/sqlScrum";

export default function SqlScrumGithubSteps({ activityKey }: { activityKey: SqlScrumKey }) {
  const guia = sqlScrumGithub(activityKey);
  return (
    <div className="mt-4 rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Grupo 302 · GitHub</p>
      <h3 className="mt-1 text-lg font-bold text-white">Del repositorio hasta subir el PDF</h3>
      <p className="mt-2 text-sm leading-relaxed text-sky-100">
        No instalen nada. Todo se hace en la página de GitHub, con la cuenta que cada quien ya creó. Sigan los pasos en
        este orden.
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
