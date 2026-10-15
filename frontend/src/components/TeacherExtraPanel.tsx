import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addExtraNote,
  applyExtraFirmas,
  fetchExtraSession,
  getApiErrorMessage,
  removeExtraNote,
  resetExtraSession,
  setExtraPaused,
  updateGroupExtraSettings,
} from "../lib/api";
import {
  EXTRA_FIRMAS_MAX,
  EXTRA_MINUTOS,
  EXTRA_NOTAS,
  EXTRA_PROGRAMA,
  EXTRA_SECCIONES,
  EXTRA_TITULO,
  extraRoleLabel,
  formatClock,
  remainingSeconds,
} from "../lib/extraScrum";
import type { ClassGroup } from "../lib/types";
import ExtraIllustration from "./ExtraIllustration";
import ExtraIndicacion from "./ExtraIndicacion";

function extraPauseKey(groupId: string) {
  return `simeval-extra-pausedAt:${groupId}`;
}

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
  const [now, setNow] = useState(() => Date.now());
  const [localPausedAt, setLocalPausedAt] = useState<string | null>(() =>
    selectedGroupId ? localStorage.getItem(extraPauseKey(selectedGroupId)) : null,
  );
  const [pauseError, setPauseError] = useState("");
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => updateGroupExtraSettings(selectedGroupId, { released: next }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["extra-session", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetExtraSession(selectedGroupId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["extra-session", selectedGroupId] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      let selectedSession = null;
      for (const group of groups) {
        const next = await setExtraPaused(group.id, paused);
        if (group.id === selectedGroupId) selectedSession = next;
      }
      return selectedSession;
    },
    onSuccess: async (data, paused) => {
      setPauseError("");
      if (paused) {
        const at = data?.pausedAt ?? localPausedAt ?? new Date().toISOString();
        for (const group of groups) localStorage.setItem(extraPauseKey(group.id), at);
        setLocalPausedAt(at);
      } else {
        for (const group of groups) localStorage.removeItem(extraPauseKey(group.id));
        setLocalPausedAt(null);
      }
      if (data) qc.setQueryData(["extra-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["extra-session"] });
    },
    onError: (err, paused) => {
      setPauseError(getApiErrorMessage(err));
      if (!paused) return;
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
        `¿Liberar Plan de Acción Proyecto para el grupo ${selectedGroup?.code}?\n\nEquipos de Roles / Equipos. Paso 3: interfaces en papel de su app Tkinter. 50 minutos. Vale ${firmasMax} Firmas; las notas que pongas bajan ese valor.`,
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

  function handleReset() {
    const ok = window.confirm(
      "¿Reiniciar líderes y relojes de este grupo? Las notas y Firmas se quedan.",
    );
    if (!ok) return;
    resetMutation.mutate();
  }

  const withLeader = teams.filter((t) => t.leaderId).length;
  const withTimer = teams.filter((t) => t.startedAt).length;
  const minutes = session?.minutes ?? EXTRA_MINUTOS;
  const pausedAt = localPausedAt ?? session?.pausedAt ?? null;
  const paused = Boolean(pausedAt);
  void now;

  useEffect(() => {
    setLocalPausedAt(selectedGroupId ? localStorage.getItem(extraPauseKey(selectedGroupId)) : null);
    setPauseError("");
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
            <h2 className="mt-1 text-xl font-bold text-white">Equipos, reloj y notas</h2>
            <p className="mt-1 text-sm text-slate-400">
              301 y 302: equipos de Roles / Equipos. Parte de {firmasMax.toLocaleString("es-MX")}{" "}
              Firmas. Cada nota baja el valor y se guarda en la lista de actividades.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              Líderes {withLeader}/{teams.length || 6} · Relojes {withTimer}/{teams.length || 6}
            </p>
            <button
              type="button"
              onClick={() => awardMutation.mutate(undefined)}
              disabled={awardMutation.isPending || teams.length === 0}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {awardMutation.isPending ? "Guardando..." : "Registrar Firmas de todos"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!paused) {
                  const ok = window.confirm(
                    "¿Pausar los cronómetros de 301 y 302?\n\nEl tiempo transcurrido se conserva. Recargar la página no lo pierde. Después pulsa Reanudar.",
                  );
                  if (!ok) return;
                  const at = new Date().toISOString();
                  for (const group of groups) localStorage.setItem(extraPauseKey(group.id), at);
                  setLocalPausedAt(at);
                  pauseMutation.mutate(true);
                  return;
                }
                pauseMutation.mutate(false);
              }}
              disabled={pauseMutation.isPending || groups.length === 0}
              className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                paused
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-amber-500 text-slate-950 hover:bg-amber-400"
              }`}
            >
              {pauseMutation.isPending ? "Guardando..." : paused ? "Reanudar" : "Pausar"}
            </button>
          </div>
        </div>
        {paused ? (
          <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100">
            Pausado. Los relojes están congelados. Pulsa Reanudar cuando sigan.
          </p>
        ) : null}
        {pauseError || noteError ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {noteError || pauseError}
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
              const remain = remainingSeconds(team.startedAt, minutes, pausedAt);
              const running = Boolean(team.startedAt) && remain > 0 && !paused;
              const done = Boolean(team.startedAt) && remain === 0;
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
                        {team.leaderName ? `Líder: ${team.leaderName}` : "Aún no eligen líder"}
                      </p>
                    </div>
                    <p className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-xs font-bold text-amber-100">
                      {team.awarded ? "Firmas guardadas" : "Sin registrar"}
                    </p>
                  </div>
                  <p
                    className={`mt-2 font-mono text-3xl font-bold ${
                      done
                        ? "text-rose-200"
                        : paused && team.startedAt
                          ? "text-amber-200"
                          : running
                            ? "text-white"
                            : "text-slate-500"
                    }`}
                  >
                    {team.startedAt ? formatClock(remain) : `${minutes}:00`}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-300">
                    {done
                      ? "Tiempo agotado — manos arriba"
                      : paused && team.startedAt
                        ? "Pausado"
                        : running
                          ? "Reloj en curso"
                          : team.leaderName
                            ? "Líder listo · falta activar el reloj"
                            : "Esperando líder"}
                  </p>
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
          {firmasMax.toLocaleString("es-MX")} Firmas, según las notas. 50 minutos. Cartulina, hojas de
          color, pegamento, diurex, periódico y/o revistas.
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
            disabled={releaseMutation.isPending || !selectedGroupId || teams.length === 0}
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
          <button
            type="button"
            onClick={handleReset}
            disabled={resetMutation.isPending || !selectedGroupId}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-60"
          >
            {resetMutation.isPending ? "Reiniciando..." : "Reiniciar líderes y relojes"}
          </button>
          <p className="text-xs text-slate-400">
            {released
              ? "Liberada: los alumnos ven instrucciones y el reloj. Tú anotas y se actualizan las Firmas."
              : "Todavía no la ven los alumnos. Revisa y luego libera."}
          </p>
        </div>
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-300">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
      </section>
    </div>
  );
}
