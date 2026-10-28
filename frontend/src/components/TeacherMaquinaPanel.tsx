import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMaquinaNote,
  applyMaquinaFirmas,
  fetchMaquinaSession,
  getApiErrorMessage,
  removeMaquinaNote,
  resetMaquinaSession,
  setMaquinaPaused,
  startMaquinaTimers,
  updateMaquinaReleased,
} from "../lib/api";
import {
  MAQUINA_FIRMAS_MAX,
  MAQUINA_MATERIALES,
  MAQUINA_MINUTOS,
  MAQUINA_NOTAS,
  MAQUINA_PASOS,
  MAQUINA_PRODUCTO,
  MAQUINA_PRODUCTO_DEBE,
  MAQUINA_PROGRAMA,
  MAQUINA_ROLES,
  MAQUINA_SPRINTS,
  MAQUINA_TITULO,
  elapsedSeconds,
  formatClock,
  maquinaRoleLabel,
  maquinaSprintAt,
  remainingSeconds,
} from "../lib/maquinaScrum";
import type { ClassGroup } from "../lib/types";

export default function TeacherMaquinaPanel({
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
  const [now, setNow] = useState(() => Date.now());

  const sessionQuery = useQuery({
    queryKey: ["maquina-session", selectedGroupId],
    queryFn: () => fetchMaquinaSession(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 3000,
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
  const firmasMax = session?.firmasMax ?? MAQUINA_FIRMAS_MAX;
  const minutes = session?.minutes ?? MAQUINA_MINUTOS;

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => updateMaquinaReleased(selectedGroupId, next),
    onSuccess: async (data) => {
      qc.setQueryData(["maquina-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const startMutation = useMutation({
    mutationFn: () => startMaquinaTimers(selectedGroupId),
    onSuccess: (data) => {
      setNoteError("");
      qc.setQueryData(["maquina-session", selectedGroupId], data);
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const pauseMutation = useMutation({
    mutationFn: (next: boolean) => setMaquinaPaused(selectedGroupId, next),
    onSuccess: (data) => qc.setQueryData(["maquina-session", selectedGroupId], data),
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetMaquinaSession(selectedGroupId),
    onSuccess: (data) => qc.setQueryData(["maquina-session", selectedGroupId], data),
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const noteMutation = useMutation({
    mutationFn: (payload: { teamKey: string; code: string }) => addMaquinaNote(selectedGroupId, payload),
    onSuccess: (data) => {
      setNoteError("");
      qc.setQueryData(["maquina-session", selectedGroupId], data);
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) => removeMaquinaNote(selectedGroupId, payload),
    onSuccess: (data) => qc.setQueryData(["maquina-session", selectedGroupId], data),
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const awardMutation = useMutation({
    mutationFn: (teamKey?: string) => applyMaquinaFirmas(selectedGroupId, teamKey),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["maquina-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
      await qc.invalidateQueries({ queryKey: ["grades-matrix"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        `¿Liberar La máquina para el grupo ${selectedGroup?.code ?? ""}?\n\nLos alumnos la verán en su teléfono. Son 50 minutos, equipos de Roles / Equipos y 1000 Firmas. Tú inicias el reloj.`,
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

  function handleStart() {
    const ok = window.confirm(
      `¿Iniciar los ${minutes} minutos de todos los equipos?\n\nEn ese momento ya pueden salir por cartón, palos de madera y unicel.`,
    );
    if (!ok) return;
    startMutation.mutate();
  }

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
                group.id === selectedGroupId
                  ? "border-lime-400/50 bg-lime-500/15 text-lime-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass mb-6 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-lime-300">{MAQUINA_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{MAQUINA_TITULO}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Grupo {selectedGroup?.code}. Equipos de Roles / Equipos. {minutes} minutos. Parte de{" "}
          {firmasMax.toLocaleString("es-MX")} Firmas. {MAQUINA_PRODUCTO}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleRelease}
            disabled={releaseMutation.isPending || !selectedGroupId}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
              released
                ? "border border-amber-400/40 bg-amber-500/20 text-amber-100"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {releaseMutation.isPending ? "Guardando..." : released ? "Ocultar a los alumnos" : "Liberar actividad"}
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={startMutation.isPending || teams.length === 0}
            className="min-h-11 rounded-xl bg-lime-600 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-lime-500 disabled:opacity-60"
          >
            {startMutation.isPending ? "Iniciando..." : `Iniciar ${minutes} minutos`}
          </button>
          <button
            type="button"
            onClick={() => pauseMutation.mutate(!paused)}
            disabled={pauseMutation.isPending}
            className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 disabled:opacity-60"
          >
            {pauseMutation.isPending ? "Guardando..." : paused ? "Reanudar" : "Pausar"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("¿Reiniciar el reloj? Las notas de Firmas se conservan.")) resetMutation.mutate();
            }}
            disabled={resetMutation.isPending}
            className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-60"
          >
            Reiniciar reloj
          </button>
          <button
            type="button"
            onClick={() => awardMutation.mutate(undefined)}
            disabled={awardMutation.isPending || teams.length === 0}
            className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {awardMutation.isPending ? "Guardando..." : "Registrar Firmas de todos"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {released
            ? "Los alumnos ya la ven en su teléfono. Iniciar arranca los 50 minutos de este grupo."
            : "Todavía no la ven. Libérala en el grupo que estás viendo."}
          {paused ? " Reloj en pausa." : ""}
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

      <section className="glass mb-6 p-4 sm:p-6">
        <h2 className="text-xl font-bold text-white">Equipos, reloj y notas</h2>
        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando equipos...</p>
        ) : teams.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {session?.loadError ?? "No hay equipos de proyecto. Ármalos en Roles / Equipos."}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {teams.map((team) => {
              const remain = remainingSeconds(team.startedAt, minutes, session?.pausedAt);
              const finished = Boolean(team.startedAt) && remain === 0 && !paused;
              const sprint = team.startedAt
                ? maquinaSprintAt(elapsedSeconds(team.startedAt, minutes, session?.pausedAt))
                : null;
              return (
                <li
                  key={team.key}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: `${team.hex}88`, backgroundColor: `${team.hex}18` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                        {team.name ?? team.columna}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {team.leaderName ? `Líder: ${team.leaderName}` : "Sin líder"}
                      </p>
                    </div>
                    <p className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 font-mono text-sm font-bold text-white">
                      {!team.startedAt ? "Sin reloj" : paused ? `Pausa ${formatClock(remain)}` : finished ? "00:00" : formatClock(remain)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {sprint ? sprint.nombre : "Esperando el inicio"}
                    {team.awarded ? " · Firmas guardadas" : ""}
                  </p>
                  <ul className="mt-3 space-y-0.5 text-xs text-slate-300">
                    {team.members.map((member) => (
                      <li key={member.studentId} className="flex justify-between gap-2">
                        <span>
                          {member.displayName}
                          {member.role ? ` · ${maquinaRoleLabel(member.role)}` : ""}
                          {member.studentId === team.leaderId ? " · líder" : ""}
                        </span>
                        <span className="text-lime-100">{member.firmas ?? firmasMax}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {MAQUINA_NOTAS.map((nota) => (
                      <button
                        key={nota.code}
                        type="button"
                        disabled={noteMutation.isPending}
                        onClick={() => noteMutation.mutate({ teamKey: team.key, code: nota.code })}
                        className="min-h-11 rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                      >
                        {nota.label} −{nota.points}
                      </button>
                    ))}
                  </div>
                  {(team.notes ?? []).length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {(team.notes ?? []).map((note) => (
                        <li key={note.id} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                          <span>
                            {note.label} <span className="text-amber-200">−{note.points}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate({ teamKey: team.key, noteId: note.id })}
                            className="font-semibold text-rose-200"
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Sin notas. El equipo iría con {firmasMax}.</p>
                  )}
                  <button
                    type="button"
                    disabled={awardMutation.isPending}
                    onClick={() => awardMutation.mutate(team.key)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-emerald-400/30 bg-emerald-500/15 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60"
                  >
                    Registrar Firmas de este equipo
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass p-4 sm:p-6">
        <h2 className="text-lg font-bold text-white">Lo que van a construir</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {MAQUINA_PRODUCTO_DEBE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-semibold text-white">Material</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {MAQUINA_MATERIALES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-semibold text-white">Tiempos</h3>
        <ul className="mt-2 space-y-2">
          {MAQUINA_SPRINTS.map((sprint) => (
            <li key={sprint.id} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-sm font-semibold text-white">
                {sprint.nombre} · {sprint.desde}–{sprint.hasta} min
              </p>
              <p className="mt-1 text-xs text-slate-400">{sprint.detalle}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-semibold text-white">Roles</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {MAQUINA_ROLES.map((role) => (
            <li key={role.id}>
              <span className="font-semibold text-white">{role.label}.</span> {role.tarea}
            </li>
          ))}
        </ul>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {MAQUINA_PASOS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
