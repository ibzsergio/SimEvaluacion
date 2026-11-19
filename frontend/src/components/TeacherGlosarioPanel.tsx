import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addGlosarioNote,
  downloadGlosarioPdf,
  fetchTeacherGlosario,
  getApiErrorMessage,
  publishGlosarioGrade,
  removeGlosarioNote,
} from "../lib/api";
import { formatoHoraGlosario, GLOSARIO_CIERRE, GLOSARIO_NOTAS, GLOSARIO_TITULO, glosarioTramos } from "../lib/glosario";
import type { ClassGroup } from "../lib/types";

export default function TeacherGlosarioPanel({
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
  const [error, setError] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const query = useQuery({
    queryKey: ["glosario", selectedGroupId],
    queryFn: () => fetchTeacherGlosario(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 15_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["glosario", selectedGroupId] });
  const noteMutation = useMutation({
    mutationFn: (payload: { teamKey: string; code: string; studentId?: string; studentName?: string }) =>
      addGlosarioNote(selectedGroupId, payload),
    onSuccess: refresh,
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const removeMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) => removeGlosarioNote(selectedGroupId, payload),
    onSuccess: refresh,
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const gradeMutation = useMutation({
    mutationFn: (teamKey: string) => publishGlosarioGrade(selectedGroupId, teamKey),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
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
                group.id === selectedGroupId ? "border-teal-400/50 bg-teal-500/15 text-teal-100" : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}
      <section className="glass mb-6 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-300">Actividad Scrum · publicada</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{GLOSARIO_TITULO}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Grupo {selectedGroup?.code ?? "—"}. Revisa el PDF y publica tú la calificación. La máxima es la de la hora en
          que subieron el archivo, menos las notas que pongas. Subir el PDF no califica. {GLOSARIO_CIERRE}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-200">
          {glosarioTramos(selectedGroup?.code).map((tramo) => (
            <li key={tramo.until}>{tramo.texto}</li>
          ))}
        </ul>
        {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
      </section>
      {query.isLoading ? <p className="text-sm text-slate-400">Cargando equipos...</p> : null}
      <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {(query.data?.teams ?? []).map((team) => {
          const file = deliveries.find((item) => item.teamKey === team.teamKey);
          const maximo = file?.points ?? 0;
          return (
            <li key={team.teamKey} className="glass p-4">
              <p className="text-lg font-bold text-white">{team.teamName}</p>
              <p className="text-sm text-slate-300">{team.leaderName ? `Líder: ${team.leaderName}` : "Sin líder"}</p>
              {file ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-amber-100">
                    PDF de las {formatoHoraGlosario(file.uploadedAt)}. Máxima {maximo.toLocaleString("es-MX")} si cumplen con todo.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadGlosarioPdf(selectedGroupId, team.teamKey, file.fileName).catch((err) => setError(getApiErrorMessage(err)))}
                    className="mt-2 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
                  >
                    Descargar PDF
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Sin PDF la calificación queda en 0.</p>
              )}
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
                          code: "participa",
                          studentId: member.id,
                          studentName: member.displayName,
                        })
                      }
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200"
                    >
                      No participó −200
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1">
                {GLOSARIO_NOTAS.filter((nota) => nota.code !== "participa").map((nota) => (
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
                    `¿Publicar la calificación de ${team.teamName}?\n\nLa máxima es ${maximo.toLocaleString("es-MX")}, por la hora del PDF. Quedará en esa máxima menos las notas que hayas puesto.`,
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
