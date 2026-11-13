import { useQuery } from "@tanstack/react-query";
import { fetchTeacherTkinterGit, getApiErrorMessage } from "../lib/api";
import { TKINTER_GIT_TITULO, cambiosDelEquipo, nombreRepositorio, programaDelEquipo } from "../lib/tkinterGit";
import type { ClassGroup } from "../lib/types";
import TkinterGitGuide from "./TkinterGitGuide";

export default function TeacherTkinterGitPanel({
  groups,
  selectedGroupId,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  hideGroupPicker?: boolean;
}) {
  const selected = groups.find((group) => group.id === selectedGroupId);
  const code = selected?.code?.trim() ?? "";
  const query = useQuery({
    queryKey: ["tkinter-git", selectedGroupId],
    queryFn: () => fetchTeacherTkinterGit(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const teams = query.data?.teams ?? [];

  return (
    <div className="space-y-4">
      <section className="glass p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Actividad Scrum · equipo de proyecto</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{TKINTER_GIT_TITULO}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Cada equipo del grupo {code || "seleccionado"} tiene un programa distinto. El líder sube programa.py a
          GitHub. Los demás clonan, hacen un cambio cada uno y lo suben a la rama main.
        </p>
        {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      </section>
      {teams.map((team) => {
        const programa = programaDelEquipo(teams, team.id, code || query.data?.groupCode);
        const repo = nombreRepositorio(code || query.data?.groupCode || "grupo", team.name);
        return (
          <section key={team.id} className="glass p-4">
            <p className="font-semibold text-white">{team.name}</p>
            <p className="mt-1 text-sm text-amber-100">{programa?.titulo ?? "Sin programa disponible"}</p>
            <p className="mt-1 font-mono text-xs text-emerald-200">{repo}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-200">
              {cambiosDelEquipo(team.members).map(({ member, cambio }) => (
                <li key={member.id}>
                  <span className="font-semibold text-white">{member.displayName}</span>
                  {member.isLeader ? " · líder" : ""}: {cambio.titulo}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {teams.length === 0 && query.isSuccess ? (
        <p className="text-sm text-slate-400">Este grupo todavía no tiene equipos de proyecto.</p>
      ) : null}
      <TkinterGitGuide repo={nombreRepositorio(code || "302", "equipo-1")} />
    </div>
  );
}
