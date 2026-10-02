import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTorreSession,
  getApiErrorMessage,
  resetTorreSession,
  updateGroupTorreSettings,
} from "../lib/api";
import { formatClock, remainingSeconds, TORRE_MINUTOS, TORRE_NIVELES, TORRE_PASOS, TORRE_PROGRAMA, TORRE_TITULO } from "../lib/torreTkinter";
import type { ClassGroup } from "../lib/types";
import TorreIllustration from "./TorreIllustration";

export default function TeacherTorrePanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const qc = useQueryClient();
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const [now, setNow] = useState(() => Date.now());

  const sessionQuery = useQuery({
    queryKey: ["torre-session", selectedGroupId],
    queryFn: () => fetchTorreSession(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: (query) => (query.state.data?.teams.some((t) => t.startedAt) ? 5000 : 20_000),
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const released = session?.released ?? selectedGroup?.torreReleased ?? false;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => updateGroupTorreSettings(selectedGroupId, { released: next }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["torre-session", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetTorreSession(selectedGroupId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["torre-session", selectedGroupId] });
    },
  });

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        `¿Liberar la Torre Tkinter para el grupo ${selectedGroup?.code}?\n\nLos alumnos verán las instrucciones, eligirán un líder (mismo equipo de la lectura) y solo el líder podrá arrancar los 45 minutos. También se publica un aviso en Comunicación.`,
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

  void now;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 no-print">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectGroup(g.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              g.id === selectedGroupId
                ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100"
                : "border-white/10 bg-white/5 text-slate-300"
            }`}
          >
            Grupo {g.code}
          </button>
        ))}
      </div>

      <section className="glass mb-6 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-300">{TORRE_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{TORRE_TITULO}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Grupo {selectedGroup?.code} · {selectedGroup?.shift}. Mismos equipos de color que la lectura. Tú
          revisas la indicación y, cuando esté listo el material, liberas. Los alumnos leen, eligen líder y el
          líder activa un reloj de {TORRE_MINUTOS} minutos. Gana la torre más alta que se sostenga sola.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h3 className="text-sm font-semibold text-white">Indicación para el grupo</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
              {TORRE_PASOS.map((paso) => (
                <li key={paso}>{paso}</li>
              ))}
            </ol>
            <div className="mt-4 space-y-2">
              {TORRE_NIVELES.map((nivel) => (
                <div key={nivel.nivel} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-200">
                    Fase {nivel.nivel} · {nivel.nombre}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{nivel.palabras.join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
          <TorreIllustration compact />
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
              : "Todavía no la ven los alumnos. Revisa la torre de ejemplo y luego libera."}
          </p>
        </div>
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-300">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
        {teams.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No hay equipos de butacas. Asigna lugares primero (los mismos de la lectura).
          </p>
        ) : null}
      </section>

      <section className="glass p-6">
        <h3 className="text-lg font-semibold text-white">Equipos (colores de butacas)</h3>
        <p className="mt-1 text-sm text-slate-400">
          {teams.length} equipo{teams.length === 1 ? "" : "s"}. Cada columna de color es un equipo.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {teams.map((team) => {
            const remain = remainingSeconds(team.startedAt, session?.minutes ?? TORRE_MINUTOS);
            const running = Boolean(team.startedAt) && remain > 0;
            const done = Boolean(team.startedAt) && remain === 0;
            return (
              <li
                key={team.key}
                className="rounded-2xl border p-4"
                style={{ borderColor: `${team.hex}66`, backgroundColor: `${team.hex}14` }}
              >
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                  {team.colorName} · columna {team.columna}
                </p>
                <p className="mt-1 text-sm text-white">
                  {team.leaderName ? `Líder: ${team.leaderName}` : "Sin líder todavía"}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-white">
                  {team.startedAt ? formatClock(remain) : `${session?.minutes ?? TORRE_MINUTOS}:00`}
                </p>
                <p className="text-xs text-slate-400">
                  {done ? "Tiempo agotado" : running ? "Reloj en curso" : "Esperando al líder"}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
                  {team.members.map((m) => (
                    <li key={m.studentId}>
                      {m.displayName}
                      {m.studentId === team.leaderId ? " · líder" : ""}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
