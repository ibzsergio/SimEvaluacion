import { useQuery } from "@tanstack/react-query";
import { fetchStudentTkinterGit, getApiErrorMessage } from "../lib/api";
import {
  TKINTER_GIT_TITULO,
  cambioDe,
  cambiosDelEquipo,
  nombreRepositorio,
  programaDelEquipo,
} from "../lib/tkinterGit";
import TkinterGitGuide from "./TkinterGitGuide";

export default function StudentTkinterGitCard({
  groupCode,
  studentId,
}: {
  groupCode?: string | null;
  studentId?: string | null;
}) {
  const code = groupCode?.trim();
  const visible = code === "301" || code === "302";
  const query = useQuery({
    queryKey: ["student-tkinter-git"],
    queryFn: fetchStudentTkinterGit,
    enabled: visible,
    retry: false,
  });

  if (!visible) return null;

  const team = query.data?.teams.find((item) => item.id === query.data?.myTeamId) ?? null;
  const programa = team && query.data ? programaDelEquipo(query.data.teams, team.id, code) : null;
  const repo = team ? nombreRepositorio(code, team.name) : "tkinter-equipo";
  const mio = team && studentId ? cambioDe(team.members, studentId) : null;
  const lista = team ? cambiosDelEquipo(team.members) : [];

  return (
    <section className="glass mb-6 border border-sky-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Actividad Scrum · equipo de proyecto</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{TKINTER_GIT_TITULO}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">
        Cada equipo hace un programa distinto de Tkinter. El programa de tu equipo está abajo. El líder lo sube a
        GitHub y los demás lo clonan, lo cambian y suben ese cambio a la rama main.
      </p>
      {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      {query.isSuccess && !team ? (
        <p className="mt-3 text-sm text-amber-100">Todavía no estás en un equipo de proyecto. Pide al docente que te asigne.</p>
      ) : null}
      {programa && team ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">Programa de {team.name}</p>
          <h3 className="mt-1 text-xl font-bold text-white">{programa.titulo}</h3>
          <p className="mt-2 text-sm text-amber-100">El título de la ventana es: {programa.ventana}</p>
          <p className="mt-2 text-sm font-semibold text-white">El archivo se llama programa.py y el repositorio se llama:</p>
          <p className="mt-1 rounded-lg bg-slate-950 px-3 py-2 font-mono text-sm text-emerald-200">{repo}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">
            {programa.pedido.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {mio ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Tu cambio</p>
          <h3 className="mt-1 text-lg font-bold text-white">{mio.titulo}</h3>
          <p className="mt-2 text-sm text-slate-100">{mio.detalle}</p>
          <p className="mt-2 text-sm text-emerald-100">
            El mensaje de tu commit es: <span className="font-mono">{mio.commit}</span>
          </p>
        </div>
      ) : null}
      {lista.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          {lista.map(({ member, cambio }) => (
            <li key={member.id} className="rounded-xl border border-white/10 px-3 py-2">
              <span className="font-semibold text-white">{member.displayName}</span>
              {member.isLeader ? " · líder, sube el proyecto" : ""}
              {": "}
              {cambio.titulo}
            </li>
          ))}
        </ul>
      ) : null}
      <TkinterGitGuide repo={repo} />
    </section>
  );
}
