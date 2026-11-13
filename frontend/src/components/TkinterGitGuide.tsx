import { pasosGit } from "../lib/tkinterGit";

export default function TkinterGitGuide({ repo }: { repo: string }) {
  const pasos = pasosGit(repo);
  return (
    <div className="mt-4 rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Git · primera vez</p>
      <h3 className="mt-1 text-lg font-bold text-white">Del programa en tu computadora hasta la rama main</h3>
      <p className="mt-2 text-sm leading-relaxed text-sky-100">
        Un repositorio por equipo. El líder sube programa.py. Los demás lo clonan, hacen su cambio y lo suben a la
        misma rama, main. Los comandos se escriben uno por uno en la ventana negra y se pulsa Enter.
      </p>
      <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-slate-100">
        {pasos.map((paso) => (
          <li key={paso.titulo}>
            <p className="font-semibold text-white">
              {paso.quien}. {paso.titulo}
            </p>
            <ul className="mt-1 space-y-1">
              {paso.lineas.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
            {paso.comandos ? (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-emerald-200">
                {paso.comandos.join("\n")}
              </pre>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
