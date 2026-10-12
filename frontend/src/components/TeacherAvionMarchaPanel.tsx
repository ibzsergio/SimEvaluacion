import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage, saveAvionMarchaPairs, setAvionMarcha } from "../lib/api";
import { AVION_MARCHA_TITULO, avionTeamLabel } from "../lib/avionScrum";
import type { AvionSession } from "../lib/types";
import AvionMarchaIndicacion from "./AvionMarchaIndicacion";

export default function TeacherAvionMarchaPanel({
  groupId,
  session,
}: {
  groupId: string;
  session: AvionSession;
}) {
  const qc = useQueryClient();
  const realTeams = (session.teams ?? []).filter((t) => !t.preview);
  const ready = Boolean(session.marchaReady);
  const released = Boolean(session.marchaReleased);
  const done = session.marchaDoneCount ?? 0;
  const total = realTeams.length;
  const pending = session.marchaPending ?? [];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const pair of session.marchaPairs ?? []) {
      next[pair.a.key] = pair.b.key;
      next[pair.b.key] = pair.a.key;
    }
    setDraft(next);
  }, [session.marchaPairs]);

  const pairsFromDraft = useMemo(() => {
    const used = new Set<string>();
    const pairs: Array<{ a: string; b: string }> = [];
    for (const team of realTeams) {
      const rival = draft[team.key];
      if (!rival || used.has(team.key) || used.has(rival)) continue;
      used.add(team.key);
      used.add(rival);
      pairs.push({ a: team.key, b: rival });
    }
    return pairs;
  }, [draft, realTeams]);

  const marchaMutation = useMutation({
    mutationFn: (next: boolean) => setAvionMarcha(groupId, next),
    onSuccess: async (data) => {
      setError("");
      setMessage(data.marchaReleased ? "Puesta en marcha activa. Los alumnos ya ven la competencia." : "Se ocultó la puesta en marcha.");
      qc.setQueryData(["avion-session", groupId], data);
      await qc.invalidateQueries({ queryKey: ["avion-session", groupId] });
      await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    },
    onError: (err) => {
      setMessage("");
      setError(getApiErrorMessage(err));
    },
  });

  const pairsMutation = useMutation({
    mutationFn: () => saveAvionMarchaPairs(groupId, pairsFromDraft),
    onSuccess: async (data) => {
      setError("");
      setMessage("Ronda 2 guardada: ya se ve quién contra quién.");
      qc.setQueryData(["avion-session", groupId], data);
      await qc.invalidateQueries({ queryKey: ["avion-session", groupId] });
    },
    onError: (err) => {
      setMessage("");
      setError(getApiErrorMessage(err));
    },
  });

  function setRival(teamKey: string, rivalKey: string) {
    setDraft((prev) => {
      const next = { ...prev };
      const oldRival = next[teamKey];
      if (oldRival) delete next[oldRival];
      if (!rivalKey) {
        delete next[teamKey];
        return next;
      }
      const takenBy = Object.keys(next).find((k) => next[k] === rivalKey && k !== teamKey);
      if (takenBy) {
        delete next[takenBy];
        delete next[rivalKey];
      }
      next[teamKey] = rivalKey;
      next[rivalKey] = teamKey;
      return next;
    });
    setMessage("");
    setError("");
  }

  function toggleMarcha() {
    if (!released) {
      if (!ready) return;
      const ok = window.confirm(
        "¿Activar PUESTA EN MARCHA?\n\nLos alumnos verán las dos rondas, el reporte de QA y la descalificación por materiales. Ya no se arma: solo se lanza.",
      );
      if (!ok) return;
    }
    marchaMutation.mutate(!released);
  }

  return (
    <section className="glass mb-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Competencia</p>
          <h2 className="mt-1 text-xl font-bold text-white">{AVION_MARCHA_TITULO}</h2>
          <p className="mt-1 text-sm text-slate-400">
            El botón se activa cuando todos los equipos terminan los 45 minutos. Luego el QA anota
            distancia y errores; es eliminación directa.
          </p>
        </div>
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
          Relojes terminados {done}/{total || 6}
        </p>
      </div>

      {!total ? (
        <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          Aún no hay equipos para competir.
        </p>
      ) : pending.length ? (
        <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          Faltan:{" "}
          {pending
            .map((t) =>
              avionTeamLabel({
                leaderName: t.leaderName ?? realTeams.find((x) => x.key === t.key)?.leaderName,
                columna: t.columna ?? realTeams.find((x) => x.key === t.key)?.columna,
              }),
            )
            .join(", ")}
          .
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
          Todos los equipos ya terminaron el tiempo. Ya puedes activar la puesta en marcha.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleMarcha}
          disabled={marchaMutation.isPending || (!released && !ready)}
          className={`rounded-xl px-5 py-3 text-sm font-black uppercase tracking-widest disabled:opacity-50 ${
            released
              ? "border border-amber-400/40 bg-amber-500/20 text-amber-100"
              : "bg-emerald-600 text-[#ffffff] hover:bg-emerald-500"
          }`}
        >
          {marchaMutation.isPending
            ? "Guardando..."
            : released
              ? "Ocultar puesta en marcha"
              : "Puesta en marcha"}
        </button>
        <p className="text-xs text-slate-400">
          {released
            ? "Los alumnos ya ven las instrucciones de competencia."
            : ready
              ? "Al pulsar, salen las dos rondas y el reporte de QA."
              : "Espera a que todos los relojes lleguen a 00:00."}
        </p>
      </div>

      {released ? (
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Ronda 2 — quién contra quién</h3>
            <p className="mt-1 text-xs text-slate-400">
              Los enfrentamientos van por líder, no por color. Si queda un equipo sin rival, espera tu
              indicación.
            </p>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {realTeams.map((team) => (
                <li
                  key={team.key}
                  className="flex flex-col gap-2 rounded-xl border px-3 py-3"
                  style={{ borderColor: `${team.hex}66` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-snug text-white">
                      {avionTeamLabel({ leaderName: team.leaderName, columna: team.columna })}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">Columna {team.columna}</p>
                  </div>
                  <select
                    value={draft[team.key] ?? ""}
                    onChange={(e) => setRival(team.key, e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-2 py-2 text-sm text-slate-100"
                  >
                    <option value="">Sin rival aún</option>
                    {realTeams
                      .filter((other) => other.key !== team.key)
                      .map((other) => (
                        <option key={other.key} value={other.key}>
                          vs {avionTeamLabel({ leaderName: other.leaderName, columna: other.columna })}
                        </option>
                      ))}
                  </select>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => pairsMutation.mutate()}
              disabled={pairsMutation.isPending}
              className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500 disabled:opacity-60"
            >
              {pairsMutation.isPending ? "Guardando..." : "Publicar enfrentamientos"}
            </button>
          </div>
          <AvionMarchaIndicacion pairs={session.marchaPairs ?? []} />
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
