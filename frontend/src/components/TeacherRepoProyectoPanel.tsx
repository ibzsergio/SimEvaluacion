import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  addRepoProyectoNote,
  applyRepoProyectoGrades,
  downloadRepoProyectoPdf,
  fetchTeacherRepoProyecto,
  getApiErrorMessage,
  removeRepoProyectoNote,
} from "../lib/api";
import {
  formatoReloj,
  REPO_PROYECTO_DOCENTE,
  REPO_PROYECTO_NOTAS,
  REPO_PROYECTO_PUNTOS,
  REPO_PROYECTO_TITULO,
  repoAbierto,
  repoRestante,
} from "../lib/repoProyecto";
import type { ClassGroup } from "../lib/types";

export default function TeacherRepoProyectoPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
  hideGroupPicker = false,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  hideGroupPicker?: boolean;
}) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const query = useQuery({
    queryKey: ["repo-proyecto", selectedGroupId],
    queryFn: () => fetchTeacherRepoProyecto(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 10_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["repo-proyecto", selectedGroupId] });
  const noteMutation = useMutation({
    mutationFn: (payload: { teamKey: string; code?: string; studentId?: string; studentName?: string }) =>
      addRepoProyectoNote(selectedGroupId, payload),
    onSuccess: refresh,
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const removeMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) => removeRepoProyectoNote(selectedGroupId, payload),
    onSuccess: refresh,
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const gradeMutation = useMutation({
    mutationFn: (teamKey?: string) => applyRepoProyectoGrades(selectedGroupId, teamKey),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const deliveries = query.data?.deliveries ?? [];

  return (
    <div>
      {hideGroupPicker ? null : (
        <div className="mb-4 flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId ? "border-violet-400/50 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}
      <section className="glass mb-6 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Actividad Scrum · publicada</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{REPO_PROYECTO_TITULO}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Grupo {selectedGroup?.code ?? "—"}. {REPO_PROYECTO_PUNTOS.toLocaleString("es-MX")} puntos. El líder inicia 2
          horas 30 minutos y puede anotar quién no está trabajando, está fuera del equipo o no asistió. Esas notas no
          restan solas: tú las ves y publicas la calificación. Te agregan como colaborador:{" "}
          <span className="font-mono font-bold text-violet-100">{REPO_PROYECTO_DOCENTE}</span>.
        </p>
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      </section>
      {query.isLoading ? <p className="text-sm text-slate-400">Cargando equipos...</p> : null}
      <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {(query.data?.teams ?? []).map((team) => {
          const file = deliveries.find((item) => item.teamKey === team.teamKey);
          const abierto = repoAbierto(team.startedAt, now);
          return (
            <li key={team.teamKey} className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-white">{team.teamName}</p>
                  <p className="text-sm text-slate-300">
                    {team.members.find((member) => member.isLeader)?.displayName
                      ? `Líder: ${team.members.find((member) => member.isLeader)?.displayName}`
                      : "Sin líder"}
                  </p>
                </div>
                <p className="font-mono text-2xl font-bold text-white">{formatoReloj(repoRestante(team.startedAt, now))}</p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {!team.startedAt ? "El líder no ha iniciado el cronómetro." : abierto ? "Tiempo corriendo." : "Tiempo terminado."}
              </p>
              {team.link ? (
                <a href={team.link} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-sky-200 underline">
                  {team.link}
                </a>
              ) : (
                <p className="mt-2 text-sm text-amber-100">Sin liga</p>
              )}
              {file ? (
                <button
                  type="button"
                  onClick={() => downloadRepoProyectoPdf(selectedGroupId, team.teamKey, file.fileName).catch((err) => setError(getApiErrorMessage(err)))}
                  className="mt-2 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
                >
                  Descargar PDF
                </button>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Sin PDF</p>
              )}
              <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-100">Notas del líder</p>
                {(team.leaderNotes ?? []).length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-amber-50">
                    {team.leaderNotes.map((nota) => (
                      <li key={nota.id}>
                        <span className="font-semibold">{nota.studentName}:</span> {nota.label}
                        {nota.comment ? `. ${nota.comment}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-300">El líder todavía no anota integrantes.</p>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-200">
                {team.members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2">
                    <span>
                      {member.displayName}
                      {member.isLeader ? " · líder" : ""}
                    </span>
                    <button
                      type="button"
                      disabled={noteMutation.isPending}
                      onClick={() =>
                        noteMutation.mutate({
                          teamKey: team.teamKey,
                          code: "sin_commit",
                          studentId: member.id,
                          studentName: member.displayName,
                        })
                      }
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200"
                    >
                      Sin commit −500
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1">
                {REPO_PROYECTO_NOTAS.filter((nota) => nota.code !== "sin_commit").map((nota) => (
                  <button
                    key={nota.code}
                    type="button"
                    disabled={noteMutation.isPending}
                    onClick={() => noteMutation.mutate({ teamKey: team.teamKey, code: nota.code })}
                    className="min-h-10 rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-xs font-semibold text-slate-200"
                  >
                    {nota.label} −{nota.points}
                  </button>
                ))}
              </div>
              {team.notes.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-amber-100">
                  {team.notes.map((nota) => (
                    <li key={nota.id} className="flex items-center justify-between gap-2">
                      <span>
                        −{nota.points} {nota.label}
                        {nota.studentName ? ` · ${nota.studentName}` : " · equipo"}
                      </span>
                      <button type="button" onClick={() => removeMutation.mutate({ teamKey: team.teamKey, noteId: nota.id })} className="text-rose-200">
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={gradeMutation.isPending}
                onClick={() => {
                  const ok = window.confirm(
                    `¿Publicar la calificación de ${team.teamName}?\n\nQuedará en ${REPO_PROYECTO_PUNTOS.toLocaleString("es-MX")} puntos menos las notas que tú hayas puesto. Las notas del líder no restan solas.`,
                  );
                  if (ok) gradeMutation.mutate(team.teamKey);
                }}
                className="mt-3 min-h-10 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Publicar calificación de este equipo
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
