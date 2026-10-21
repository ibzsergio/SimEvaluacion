import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addImproNote,
  applyImproFirmas,
  fetchImproSession,
  getApiErrorMessage,
  removeImproNote,
  resetImproSession,
  setImproPaused,
  updateGroupImproSettings,
} from "../lib/api";
import {
  IMPRO_FIRMAS_MAX,
  IMPRO_MINUTOS,
  IMPRO_NOTAS,
  IMPRO_PROGRAMA,
  IMPRO_TITULO,
  elapsedSeconds,
  formatClock,
  improRoleLabel,
  improSprintAt,
  remainingSeconds,
} from "../lib/improScrum";
import type { ClassGroup } from "../lib/types";
import ImproIndicacion from "./ImproIndicacion";
import PopUpIllustration from "./PopUpIllustration";

export default function TeacherImproPanel({
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
  const [memberByTeam, setMemberByTeam] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());

  const sessionQuery = useQuery({
    queryKey: ["impro-session", selectedGroupId],
    queryFn: () => fetchImproSession(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  void now;

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const released = session?.released ?? false;
  const paused = Boolean(session?.pausedAt);
  const firmasMax = session?.firmasMax ?? IMPRO_FIRMAS_MAX;
  const minutes = session?.minutes ?? IMPRO_MINUTOS;

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => updateGroupImproSettings(selectedGroupId, { released: next }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["impro-session"] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (next: boolean) => setImproPaused(selectedGroupId, next),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["impro-session", selectedGroupId], data);
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetImproSession(selectedGroupId),
    onSuccess: async (data) => {
      qc.setQueryData(["impro-session", selectedGroupId], data);
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const noteMutation = useMutation({
    mutationFn: (payload: {
      teamKey: string;
      code: string;
      studentId?: string | null;
    }) => addImproNote(selectedGroupId, payload),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["impro-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const removeNoteMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) => removeImproNote(selectedGroupId, payload),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["impro-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const awardMutation = useMutation({
    mutationFn: (teamKey?: string) => applyImproFirmas(selectedGroupId, teamKey),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["impro-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        `¿Liberar Pop-Up para el grupo ${selectedGroup?.code ?? ""}?\n\nSolo este grupo. Equipos de Roles / Equipos. Hojas de color, pegamento, diurex y tijeras. El líder activa ${minutes} minutos. Vale ${firmasMax} Firmas.`,
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

  function handleReset() {
    const ok = window.confirm(
      "¿Reiniciar líderes y relojes de este grupo?\n\nLas notas de Firmas se conservan.",
    );
    if (!ok) return;
    resetMutation.mutate();
  }

  useEffect(() => {
    setNoteError("");
  }, [selectedGroupId]);

  return (
    <div>
      {hideGroupPicker ? null : (
        <div className="mb-4 flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                g.id === selectedGroupId
                  ? "border-orange-400/50 bg-orange-500/15 text-orange-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {g.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass mb-6 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-300">{IMPRO_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{IMPRO_TITULO}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Grupo {selectedGroup?.code}. Equipos de Roles / Equipos. {minutes} minutos. Un pop-up de su
          proyecto con hojas de color, pegamento, diurex y tijeras. Alguien de otro equipo lo opera.
          Parte de {firmasMax.toLocaleString("es-MX")} Firmas.
        </p>
        <div className="mt-5">
          <PopUpIllustration />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleRelease}
            disabled={releaseMutation.isPending || !selectedGroupId}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
              released
                ? "border border-amber-400/40 bg-amber-500/20 text-amber-100"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
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
            onClick={() => pauseMutation.mutate(!paused)}
            disabled={pauseMutation.isPending || !selectedGroupId}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
              paused
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : "border-white/15 bg-white/5 text-slate-100"
            }`}
          >
            {pauseMutation.isPending ? "Guardando..." : paused ? "Reanudar" : "Pausar"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetMutation.isPending || !selectedGroupId}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-60"
          >
            {resetMutation.isPending ? "Reiniciando..." : "Reiniciar líderes y relojes"}
          </button>
          <button
            type="button"
            onClick={() => awardMutation.mutate(undefined)}
            disabled={awardMutation.isPending || teams.length === 0}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {awardMutation.isPending ? "Guardando..." : "Registrar Firmas de todos"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {released
            ? "Liberada en este grupo. Los alumnos eligen líder y el líder arranca el reloj."
            : "Todavía no la ven los alumnos. Se libera solo en el grupo que estás viendo."}
          {paused ? " Relojes en pausa." : ""}
        </p>
        {noteError ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {noteError}
          </p>
        ) : null}
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-300">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
      </section>

      <section className="glass mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Supervisión en vivo</p>
            <h2 className="mt-1 text-xl font-bold text-white">Equipos, reloj y notas</h2>
          </div>
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
            {sessionQuery.isError ? "Sin datos" : `${teams.length} equipos`}
          </p>
        </div>
        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando equipos...</p>
        ) : sessionQuery.isError ? null : teams.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No hay equipos de proyecto. Ármalos en Roles / Equipos y vuelve aquí.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {teams.map((team) => {
              const notes = team.notes ?? [];
              const remain = remainingSeconds(team.startedAt, minutes, session?.pausedAt);
              const running = Boolean(team.startedAt) && remain > 0 && !paused;
              const finished = Boolean(team.startedAt) && remain === 0 && !paused;
              const sprint = team.startedAt
                ? improSprintAt(elapsedSeconds(team.startedAt, minutes, session?.pausedAt))
                : null;
              const memberId = memberByTeam[team.key] ?? "";
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
                        {team.leaderName ? `Líder: ${team.leaderName}` : "Sin líder"}
                      </p>
                    </div>
                    <p className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 font-mono text-sm font-bold text-white">
                      {!team.startedAt
                        ? "Sin reloj"
                        : paused
                          ? `Pausa ${formatClock(remain)}`
                          : finished
                            ? "00:00"
                            : formatClock(remain)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {running && sprint ? sprint.nombre : finished ? "Tiempo agotado" : "Esperando activación"}
                    {team.awarded ? " · Firmas guardadas" : ""}
                  </p>
                  <ul className="mt-3 space-y-0.5 text-xs text-slate-300">
                    {team.members.map((m) => (
                      <li key={m.studentId} className="flex justify-between gap-2">
                        <span>
                          {m.displayName}
                          {m.role ? ` · ${improRoleLabel(m.role)}` : ""}
                          {m.studentId === team.leaderId ? " · líder" : ""}
                        </span>
                        <span className="shrink-0 text-amber-100">{m.firmas ?? firmasMax}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {IMPRO_NOTAS.filter((n) => n.scope === "team").map((nota) => (
                      <button
                        key={nota.code}
                        type="button"
                        disabled={noteMutation.isPending}
                        onClick={() => noteMutation.mutate({ teamKey: team.key, code: nota.code })}
                        className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                      >
                        {nota.label} −{nota.points}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={memberId}
                      onChange={(e) => setMemberByTeam((prev) => ({ ...prev, [team.key]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">Integrante…</option>
                      {team.members.map((m) => (
                        <option key={m.studentId} value={m.studentId}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={noteMutation.isPending || !memberId}
                      onClick={() =>
                        noteMutation.mutate({
                          teamKey: team.key,
                          code: "fuera_equipo",
                          studentId: memberId,
                        })
                      }
                      className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-60"
                    >
                      Fuera del equipo −150
                    </button>
                  </div>
                  {notes.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {notes.map((n) => (
                        <li key={n.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                          <span>
                            {n.label}
                            {n.studentName ? ` · ${n.studentName}` : ""}{" "}
                            <span className="text-amber-200">−{n.points}</span>
                          </span>
                          <button
                            type="button"
                            disabled={removeNoteMutation.isPending}
                            onClick={() => removeNoteMutation.mutate({ teamKey: team.key, noteId: n.id })}
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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass p-6">
        <h2 className="text-lg font-bold text-white">Instrucciones que ven los alumnos</h2>
        <div className="mt-4">
          <ImproIndicacion />
        </div>
      </section>
    </div>
  );
}
