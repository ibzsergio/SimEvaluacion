import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addExtraNote,
  applyExtraFirmas,
  fetchExtraSession,
  getApiErrorMessage,
  removeExtraNote,
  updateGroupExtraSettings,
} from "../lib/api";
import {
  EXTRA_FIRMAS_MAX,
  EXTRA_NOTAS,
  EXTRA_PROGRAMA,
  EXTRA_SECCIONES,
  EXTRA_TITULO,
  extraRoleLabel,
} from "../lib/extraScrum";
import type { ClassGroup } from "../lib/types";
import ExtraIllustration from "./ExtraIllustration";
import ExtraIndicacion from "./ExtraIndicacion";

export default function TeacherExtraPanel({
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
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const [noteError, setNoteError] = useState("");
  const [customByTeam, setCustomByTeam] = useState<
    Record<string, { label: string; points: string; studentId: string }>
  >({});

  const sessionQuery = useQuery({
    queryKey: ["extra-session", selectedGroupId],
    queryFn: () => fetchExtraSession(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const released = session?.released ?? false;
  const firmasMax = session?.firmasMax ?? EXTRA_FIRMAS_MAX;

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => updateGroupExtraSettings(selectedGroupId, { released: next }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["extra-session"] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: (payload: {
      teamKey: string;
      code: string;
      label?: string;
      points?: number;
      studentId?: string | null;
    }) => addExtraNote(selectedGroupId, payload),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["extra-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const removeNoteMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) =>
      removeExtraNote(selectedGroupId, payload),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["extra-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const awardMutation = useMutation({
    mutationFn: (teamKey?: string) => applyExtraFirmas(selectedGroupId, teamKey),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["extra-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        `¿Liberar Plan de Acción Proyecto para 301 y 302?\n\nEquipos de Roles / Equipos. Paso 3: interfaces en papel de su app Tkinter. Vale ${firmasMax} Firmas; las notas que pongas bajan ese valor.`,
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

  useEffect(() => {
    setNoteError("");
  }, [selectedGroupId]);

  function customOf(teamKey: string) {
    return customByTeam[teamKey] ?? { label: "", points: "300", studentId: "" };
  }

  return (
    <div>
      {hideGroupPicker ? null : (
        <div className="mb-4 flex flex-wrap gap-2 no-print">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                g.id === selectedGroupId
                  ? "border-rose-400/50 bg-rose-500/15 text-rose-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {g.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-rose-300">Supervisión en vivo</p>
            <h2 className="mt-1 text-xl font-bold text-white">Equipos y notas</h2>
            <p className="mt-1 text-sm text-slate-400">
              301 y 302: equipos de Roles / Equipos. Parte de {firmasMax.toLocaleString("es-MX")}{" "}
              Firmas. Cada nota baja el valor y se guarda en la lista de actividades. Sin cronómetro.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              {teams.length} equipos
            </p>
            <button
              type="button"
              onClick={() => awardMutation.mutate(undefined)}
              disabled={awardMutation.isPending || teams.length === 0}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {awardMutation.isPending ? "Guardando..." : "Registrar Firmas de todos"}
            </button>
          </div>
        </div>
        {noteError ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {noteError}
          </p>
        ) : null}
        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando equipos...</p>
        ) : teams.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No hay equipos de proyecto. Ármalos en Roles / Equipos y vuelve aquí.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {teams.map((team) => {
              const notes = team.notes ?? [];
              const custom = customOf(team.key);
              return (
                <li
                  key={team.key}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: `${team.hex}88`, backgroundColor: `${team.hex}18` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                        {team.name ?? team.columna ?? team.colorName}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {team.leaderName ? `Líder: ${team.leaderName}` : `${team.members.length} integrantes`}
                      </p>
                    </div>
                    <p className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-xs font-bold text-amber-100">
                      {team.awarded ? "Firmas guardadas" : "Sin registrar"}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-0.5 text-xs text-slate-300">
                    {team.members.map((m) => (
                      <li key={m.studentId} className="flex justify-between gap-2">
                        <span>
                          {m.displayName}
                          {m.role ? ` · ${extraRoleLabel(m.role)}` : ""}
                          {m.studentId === team.leaderId ? " · líder" : ""}
                        </span>
                        <span className="shrink-0 font-semibold text-amber-100">
                          {(m.firmas ?? firmasMax).toLocaleString("es-MX")}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-rose-100">Notas al equipo</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {EXTRA_NOTAS.filter((n) => n.scope === "team").map((nota) => (
                        <button
                          key={nota.code}
                          type="button"
                          disabled={noteMutation.isPending}
                          onClick={() =>
                            noteMutation.mutate({ teamKey: team.key, code: nota.code })
                          }
                          className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                        >
                          {nota.label} −{nota.points}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-rose-100">
                      Nota a un integrante
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {EXTRA_NOTAS.filter((n) => n.scope === "member").map((nota) => (
                        <span key={nota.code} className="flex flex-wrap items-center gap-1">
                          <select
                            className="rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                            defaultValue=""
                            id={`${team.key}-${nota.code}`}
                          >
                            <option value="">Quién…</option>
                            {team.members.map((m) => (
                              <option key={m.studentId} value={m.studentId}>
                                {m.displayName}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={noteMutation.isPending}
                            onClick={() => {
                              const select = document.getElementById(
                                `${team.key}-${nota.code}`,
                              ) as HTMLSelectElement | null;
                              const studentId = select?.value ?? "";
                              if (!studentId) {
                                setNoteError("Elige a qué integrante aplica la nota.");
                                return;
                              }
                              noteMutation.mutate({
                                teamKey: team.key,
                                code: nota.code,
                                studentId,
                              });
                            }}
                            className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                          >
                            {nota.label} −{nota.points}
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-rose-100">Otra nota</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <input
                        value={custom.label}
                        onChange={(e) =>
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { ...custom, label: e.target.value },
                          }))
                        }
                        placeholder="Motivo"
                        className="min-w-[8rem] flex-1 rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                      />
                      <input
                        value={custom.points}
                        onChange={(e) =>
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { ...custom, points: e.target.value },
                          }))
                        }
                        inputMode="numeric"
                        className="w-16 rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                      />
                      <select
                        value={custom.studentId}
                        onChange={(e) =>
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { ...custom, studentId: e.target.value },
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                      >
                        <option value="">Todo el equipo</option>
                        {team.members.map((m) => (
                          <option key={m.studentId} value={m.studentId}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={noteMutation.isPending}
                        onClick={() => {
                          const points = Number(custom.points);
                          if (!custom.label.trim() || !Number.isFinite(points) || points < 1) {
                            setNoteError("Escribe el motivo y cuántas Firmas se descuentan.");
                            return;
                          }
                          noteMutation.mutate({
                            teamKey: team.key,
                            code: "custom",
                            label: custom.label.trim(),
                            points: Math.round(points),
                            studentId: custom.studentId || null,
                          });
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { label: "", points: "300", studentId: "" },
                          }));
                        }}
                        className="rounded-lg bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                      >
                        Anotar
                      </button>
                    </div>
                    {notes.length ? (
                      <ul className="mt-2 space-y-1">
                        {notes.map((n) => (
                          <li
                            key={n.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/40 px-2 py-1 text-[11px] text-slate-200"
                          >
                            <span>
                              {n.label}
                              {n.studentName ? ` · ${n.studentName}` : ""}{" "}
                              <span className="text-amber-200">−{n.points}</span>
                            </span>
                            <button
                              type="button"
                              disabled={removeNoteMutation.isPending}
                              onClick={() =>
                                removeNoteMutation.mutate({ teamKey: team.key, noteId: n.id })
                              }
                              className="text-rose-200 hover:text-white"
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-400">Sin notas. El equipo iría con {firmasMax}.</p>
                    )}
                    <button
                      type="button"
                      disabled={awardMutation.isPending}
                      onClick={() => awardMutation.mutate(team.key)}
                      className="mt-2 w-full rounded-lg border border-emerald-400/30 bg-emerald-500/15 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
                    >
                      Registrar Firmas de este equipo
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass mb-6 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-300">{EXTRA_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{EXTRA_TITULO}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Grupo {selectedGroup?.code}. Paso 3 del proyecto: interfaces en papel de su app Tkinter (ya
          entregaron requerimientos y diagramas/casos de uso/cronograma). Equipos de Roles / Equipos.{" "}
          {firmasMax.toLocaleString("es-MX")} Firmas, según las notas. Cartulina, hojas de color,
          pegamento, diurex, periódico y/o revistas.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <ExtraIndicacion />
            <div className="mt-4 space-y-2">
              {EXTRA_SECCIONES.map((sec) => (
                <div key={sec.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-rose-200">
                    {sec.rol} · {sec.titulo}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{sec.detalle}</p>
                </div>
              ))}
            </div>
          </div>
          <ExtraIllustration compact />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 no-print">
          <button
            type="button"
            onClick={toggleRelease}
            disabled={releaseMutation.isPending || !selectedGroupId}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
              released
                ? "border border-amber-400/40 bg-amber-500/20 text-amber-100"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {releaseMutation.isPending
              ? "Guardando..."
              : released
                ? "Ocultar a los alumnos"
                : "Liberar actividad"}
          </button>
          <p className="text-xs text-slate-400">
            {released
              ? "Liberada en 301 y 302: los alumnos ven instrucciones. Tú anotas y se actualizan las Firmas."
              : "Todavía no la ven los alumnos. Al liberar se abre en 301 y 302."}
          </p>
        </div>
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-300">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
      </section>
    </div>
  );
}
