import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addBasedatosNote,
  applyBasedatosFirmas,
  downloadBasedatosPdf,
  fetchBasedatosSession,
  fetchTeacherBasedatosDeliveries,
  getApiErrorMessage,
  hideBasedatosSession,
  releaseBasedatosSession,
  removeBasedatosNote,
} from "../lib/api";
import {
  BASEDATOS_CONTEXTO,
  BASEDATOS_FIRMAS_MAX,
  BASEDATOS_NOTAS,
  BASEDATOS_PRODUCTOS,
  BASEDATOS_PROGRAMA,
  BASEDATOS_REGLAS,
  BASEDATOS_TITULO,
  basedatosProductHeading,
  basedatosRoleLabel,
  formatBasedatosSize,
} from "../lib/basedatosScrum";
import type { ClassGroup } from "../lib/types";

export default function TeacherBasedatosPanel({
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
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const [noteError, setNoteError] = useState("");
  const [custom, setCustom] = useState<Record<string, { label: string; points: string; studentId: string }>>({});

  const sessionQuery = useQuery({
    queryKey: ["basedatos-session", selectedGroupId],
    queryFn: () => fetchBasedatosSession(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 5000,
  });
  const deliveriesQuery = useQuery({
    queryKey: ["basedatos-deliveries", selectedGroupId],
    queryFn: () => fetchTeacherBasedatosDeliveries(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 8000,
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const released = session?.released ?? false;
  const firmasMax = session?.firmasMax ?? BASEDATOS_FIRMAS_MAX;

  const refresh = async (data: unknown) => {
    qc.setQueryData(["basedatos-session", selectedGroupId], data);
    await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
    await qc.invalidateQueries({ queryKey: ["grades-matrix", selectedGroupId] });
  };

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => (next ? releaseBasedatosSession(selectedGroupId) : hideBasedatosSession(selectedGroupId)),
    onSuccess: refresh,
  });

  const noteMutation = useMutation({
    mutationFn: (payload: { teamKey: string; code: string; label?: string; points?: number; studentId?: string | null }) =>
      addBasedatosNote(selectedGroupId, payload),
    onSuccess: async (data) => {
      setNoteError("");
      await refresh(data);
    },
    onError: (error) => setNoteError(getApiErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) => removeBasedatosNote(selectedGroupId, payload),
    onSuccess: refresh,
  });

  const awardMutation = useMutation({
    mutationFn: (teamKey?: string) => applyBasedatosFirmas(selectedGroupId, teamKey),
    onSuccess: refresh,
    onError: (error) => setNoteError(getApiErrorMessage(error)),
  });

  const memberNotes = BASEDATOS_NOTAS.filter((note) => note.scope === "member");

  return (
    <div className="space-y-4">
      {hideGroupPicker ? null : (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId
                  ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">{BASEDATOS_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{BASEDATOS_TITULO}</h2>
        <p className="mt-2 text-sm text-slate-300">{BASEDATOS_CONTEXTO}</p>
        <p className="mt-3 text-sm font-semibold text-sky-100">
          Grupo {selectedGroup?.code ?? "—"} · {firmasMax.toLocaleString("es-MX")} puntos · hoy · equipos de Roles / Equipos
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selectedGroupId || releaseMutation.isPending}
            onClick={() => {
              const next = !released;
              const question = next
                ? `¿Liberar La base de datos para el grupo ${selectedGroup?.code ?? ""}?\n\nHoy suben un solo PDF por equipo, de máximo 5 MB. Vale 3000 puntos.`
                : "¿Ocultar La base de datos para este grupo?";
              if (!window.confirm(question)) return;
              releaseMutation.mutate(next);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              released ? "bg-slate-700 text-white" : "bg-sky-500 text-slate-950"
            }`}
          >
            {released ? "Ocultar a los alumnos" : "Liberar a los alumnos"}
          </button>
          <button
            type="button"
            disabled={!selectedGroupId || awardMutation.isPending || teams.length === 0}
            onClick={() => {
              if (!window.confirm("¿Registrar los puntos de todos los equipos en calificaciones?")) return;
              awardMutation.mutate(undefined);
            }}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white"
          >
            Registrar puntos del grupo
          </button>
        </div>
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
        {noteError ? <p className="mt-3 text-sm text-rose-200">{noteError}</p> : null}
      </section>

      <section className="rounded-3xl border border-sky-400/40 bg-sky-500/10 p-5">
        <h3 className="text-lg font-bold text-white">Un solo PDF por equipo</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">
          {BASEDATOS_REGLAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {BASEDATOS_PRODUCTOS.map((product) => (
        <section key={product.id} className="glass p-5">
          <h3 className="font-bold text-white">
            {basedatosProductHeading(product)}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {product.items.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
        </section>
      ))}

      {teams.length === 0 ? (
        <section className="glass p-5 text-sm text-amber-100">
          No hay equipos de proyecto en este grupo. Revísalos en Roles / Equipos.
        </section>
      ) : (
        teams.map((team) => {
          const draft = custom[team.key] ?? { label: "", points: "100", studentId: "" };
          return (
            <section key={team.key} className="glass p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{team.name || team.columna}</h3>
                  <p className="text-sm text-slate-400">
                    {team.awarded ? "Puntos registrados" : "Aún sin registrar"} · {firmasMax.toLocaleString("es-MX")} puntos
                  </p>
                </div>
                <button
                  type="button"
                  disabled={awardMutation.isPending}
                  onClick={() => awardMutation.mutate(team.key)}
                  className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-bold text-slate-950"
                >
                  Registrar este equipo
                </button>
              </div>
              {(() => {
                const delivery = (deliveriesQuery.data ?? []).find((item) => item.teamKey === team.key);
                if (!delivery) {
                  return <p className="mt-3 text-sm text-amber-100">Todavía no suben el PDF.</p>;
                }
                return (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                    <p className="text-sm text-emerald-50">
                      {delivery.fileName} · {formatBasedatosSize(delivery.sizeBytes)} · lo subió {delivery.uploadedByName}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        downloadBasedatosPdf(selectedGroupId, team.key, delivery.fileName).catch((error) =>
                          setNoteError(getApiErrorMessage(error)),
                        );
                      }}
                      className="rounded-lg bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950"
                    >
                      Descargar PDF
                    </button>
                  </div>
                );
              })()}

              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-rose-100">Nota por alumno</p>
              <ul className="mt-2 space-y-3">
                {team.members.map((member) => (
                  <li key={member.studentId} className="rounded-2xl border border-white/10 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{member.displayName}</p>
                        <p className="text-xs text-slate-400">
                          {basedatosRoleLabel(member.role) || "Sin rol"} · {member.firmas ?? firmasMax} puntos
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {memberNotes.map((note) => (
                          <button
                            key={note.code}
                            type="button"
                            disabled={noteMutation.isPending}
                            onClick={() =>
                              noteMutation.mutate({ teamKey: team.key, code: note.code, studentId: member.studentId })
                            }
                            className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-100"
                          >
                            {note.label} −{note.points}
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {(team.notes ?? []).length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {(team.notes ?? []).map((note) => (
                    <li key={note.id} className="flex items-center justify-between gap-2 text-sm text-slate-300">
                      <span>
                        −{note.points} {note.label}
                        {note.studentName ? ` · ${note.studentName}` : " · equipo"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate({ teamKey: team.key, noteId: note.id })}
                        className="text-xs text-rose-200"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_7rem_12rem_auto]">
                <input
                  value={draft.label}
                  onChange={(event) =>
                    setCustom((prev) => ({ ...prev, [team.key]: { ...draft, label: event.target.value } }))
                  }
                  placeholder="Otra nota"
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  value={draft.points}
                  onChange={(event) =>
                    setCustom((prev) => ({ ...prev, [team.key]: { ...draft, points: event.target.value } }))
                  }
                  inputMode="numeric"
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <select
                  value={draft.studentId}
                  onChange={(event) =>
                    setCustom((prev) => ({ ...prev, [team.key]: { ...draft, studentId: event.target.value } }))
                  }
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">Todo el equipo</option>
                  {team.members.map((member) => (
                    <option key={member.studentId} value={member.studentId}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={noteMutation.isPending || !draft.label.trim()}
                  onClick={() => {
                    const points = Math.round(Number(draft.points));
                    if (!Number.isFinite(points) || points < 1) return;
                    noteMutation.mutate({
                      teamKey: team.key,
                      code: "custom",
                      label: draft.label,
                      points,
                      studentId: draft.studentId || null,
                    });
                    setCustom((prev) => ({ ...prev, [team.key]: { label: "", points: draft.points, studentId: draft.studentId } }));
                  }}
                  className="rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white"
                >
                  Anotar
                </button>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
