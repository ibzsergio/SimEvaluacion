import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchExtraSession,
  getApiErrorMessage,
  resetExtraSession,
  setExtraPaused,
  updateGroupExtraSettings,
} from "../lib/api";
import {
  EXTRA_MINUTOS,
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

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        `¿Liberar ¡EXTRA, EXTRA! para el grupo ${selectedGroup?.code}?\n\n${
          selectedGroup?.code.trim() === "301"
            ? "Los alumnos trabajan con los equipos de Roles / Equipos."
            : "Los alumnos trabajan por columna de butacas (como están sentados)."
        } Eligen líder y el líder arranca 50 minutos.`,
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

  function handleReset() {
    const ok = window.confirm(
      "¿Reiniciar líderes y relojes de este grupo? La actividad sigue liberada, pero cada equipo vuelve a elegir líder.",
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
  }, [selectedGroupId]);

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
            <p className="text-xs font-bold uppercase tracking-widest text-rose-300">En vivo</p>
            <h2 className="mt-1 text-xl font-bold text-white">Líder y temporizador por equipo</h2>
            <p className="mt-1 text-sm text-slate-400">
              {session?.rosterMode === "project"
                ? "301: equipos de proyecto (Roles / Equipos). Ves líder y el reloj de 50 minutos."
                : "302: columnas de butacas. Ves quién ya eligió líder y el reloj de 50 minutos."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              Líderes {withLeader}/{teams.length || 6} · Relojes {withTimer}/{teams.length || 6}
            </p>
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
        {pauseError ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {pauseError}
          </p>
        ) : null}
        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando equipos...</p>
        ) : teams.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {selectedGroup?.code.trim() === "301"
              ? "No hay equipos de proyecto. Ármalos en Roles / Equipos y vuelve aquí."
              : "No hay equipos de butacas. Asigna lugares (columnas) primero."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => {
              const remain = remainingSeconds(team.startedAt, minutes, pausedAt);
              const running = Boolean(team.startedAt) && remain > 0 && !paused;
              const done = Boolean(team.startedAt) && remain === 0;
              return (
                <li
                  key={team.key}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: `${team.hex}88`, backgroundColor: `${team.hex}18` }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                    {team.name ?? team.columna ?? team.colorName}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {team.leaderName ? `Líder: ${team.leaderName}` : "Aún no eligen líder"}
                  </p>
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
                      <li key={m.studentId}>
                        {m.displayName}
                        {m.role ? ` · ${extraRoleLabel(m.role)}` : ""}
                        {m.studentId === team.leaderId ? " · líder" : ""}
                      </li>
                    ))}
                  </ul>
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
          Grupo {selectedGroup?.code}. En 50 minutos cada equipo arma la portada que anuncia el lanzamiento
          de su aplicación de escritorio en Python + Tkinter (nombre, quién la usa, qué problema resuelve).{" "}
          {selectedGroup?.code.trim() === "301"
            ? "Cada equipo de Roles / Equipos anuncia SU app del semestre."
            : "Cada columna de butacas se pone de acuerdo en UNA sola app Tkinter."}{" "}
          Cartulina, hojas de color, pegamento, diurex, periódico y/o revistas. Al acabar: manos arriba.
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
              ? "Liberada: los alumnos ya ven instrucciones, aviso y el botón del líder."
              : "Todavía no la ven los alumnos. Revisa la portada de ejemplo y luego libera."}
          </p>
        </div>
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-300">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
      </section>
    </div>
  );
}
