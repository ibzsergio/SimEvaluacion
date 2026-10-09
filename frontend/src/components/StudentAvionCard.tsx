import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chooseStudentAvionLeader,
  getApiErrorMessage,
  startStudentAvionTimer,
} from "../lib/api";
import {
  AVION_MINUTOS,
  AVION_PROGRAMA,
  AVION_SPRINTS,
  AVION_TITULO,
  formatClock,
  remainingSeconds,
} from "../lib/avionScrum";
import type { StudentAvion } from "../lib/types";
import AvionIllustration from "./AvionIllustration";
import AvionIndicacion from "./AvionIndicacion";

const READ_KEY = "simeval-avion-read-v1";

export default function StudentAvionCard({ avion }: { avion: StudentAvion }) {
  const qc = useQueryClient();
  const hex = avion.hex;
  const onlyMember = avion.members.length === 1 ? avion.members[0]!.studentId : "";
  const [read, setRead] = useState(() => localStorage.getItem(READ_KEY) === "1");
  const [open, setOpen] = useState(() => localStorage.getItem(READ_KEY) !== "1");
  const [nomineeId, setNomineeId] = useState(avion.leaderId ?? onlyMember);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNomineeId(avion.leaderId ?? onlyMember);
  }, [avion.leaderId, onlyMember]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remain = remainingSeconds(avion.startedAt, avion.minutes || AVION_MINUTOS, avion.pausedAt);
  const paused = Boolean(avion.pausedAt);
  const done = Boolean(avion.startedAt) && remain === 0 && !paused;
  void now;

  const leaderMutation = useMutation({
    mutationFn: (leaderId: string) => chooseStudentAvionLeader(leaderId),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const startMutation = useMutation({
    mutationFn: startStudentAvionTimer,
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function markRead() {
    localStorage.setItem(READ_KEY, "1");
    setRead(true);
  }

  function confirmLeader() {
    if (!nomineeId) {
      setError("Marquen quién será el líder del equipo.");
      return;
    }
    leaderMutation.mutate(nomineeId);
  }

  function startTimer() {
    const ok = window.confirm(
      `¿Activar el reloj de ${avion.minutes} minutos?\n\nSolo el líder puede hacerlo. Cuando arranque, ya no podrán cambiar de líder.`,
    );
    if (!ok) return;
    startMutation.mutate();
  }

  return (
    <section className="glass mb-6 overflow-hidden border-2 p-0" style={{ borderColor: `${hex}66` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
        style={{ backgroundColor: `${hex}22` }}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
            {AVION_PROGRAMA}
            {avion.preview ? " · vista de prueba" : ""}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{AVION_TITULO}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {paused
              ? avion.startedAt
                ? `Pausado por el docente · ${formatClock(remain)}`
                : "Pausado por el docente. El reloj aún no arranca."
              : avion.startedAt
                ? done
                  ? "Tiempo agotado — levanten las manos. No sigan construyendo."
                  : `Reloj: ${formatClock(remain)}`
                : avion.leaderName
                  ? `Líder: ${avion.leaderName}. Lean y activen cuando estén listos.`
                  : "Lean las instrucciones, tomen su rol Scrum y elijan un líder."}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {open ? "Ocultar" : "Ver reto"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 px-5 pb-5 pt-2">
          <AvionIllustration compact />
          <AvionIndicacion />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Sprints del reto</h3>
            {AVION_SPRINTS.map((sprint) => (
              <div key={sprint.nivel} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: hex }}>
                  {sprint.nombre}
                </p>
                <p className="mt-1 text-sm text-slate-200">{sprint.detalle}</p>
              </div>
            ))}
          </div>

          {!read ? (
            <button
              type="button"
              onClick={markRead}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500"
            >
              Ya leí las instrucciones
            </button>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold text-white">Equipo</h3>
              <p className="mt-1 text-xs text-slate-400">
                Cada quien su rol, pero todos construyen. Elijan al líder; el botón de activar solo le
                aparece a esa persona.
              </p>
              <ul className="mt-3 space-y-2">
                {avion.members.map((m) => (
                  <li key={m.studentId}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                      <input
                        type="radio"
                        name="avion-leader"
                        value={m.studentId}
                        checked={nomineeId === m.studentId}
                        disabled={Boolean(avion.startedAt) || leaderMutation.isPending}
                        onChange={() => setNomineeId(m.studentId)}
                      />
                      <span>
                        {m.displayName}
                        {m.studentId === avion.leaderId ? " · líder actual" : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {!avion.startedAt ? (
                <button
                  type="button"
                  onClick={confirmLeader}
                  disabled={leaderMutation.isPending || !nomineeId}
                  className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                >
                  {leaderMutation.isPending ? "Guardando líder..." : "Confirmar líder del equipo"}
                </button>
              ) : null}

              {avion.isLeader && !avion.startedAt ? (
                <button
                  type="button"
                  onClick={startTimer}
                  disabled={startMutation.isPending || paused}
                  className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500 disabled:opacity-60"
                >
                  {paused
                    ? "Pausado — esperen a que reanude el docente"
                    : startMutation.isPending
                      ? "Activando..."
                      : `Activar actividad (${avion.minutes} min)`}
                </button>
              ) : null}

              {!avion.isLeader && avion.leaderName && !avion.startedAt ? (
                <p className="mt-3 text-sm text-slate-300">
                  Esperen a que {avion.leaderName} pulse <span className="font-semibold">Activar actividad</span>.
                </p>
              ) : null}

              {avion.startedAt ? (
                <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
                    {done ? "Tiempo agotado" : paused ? "Pausado" : "Tiempo restante"}
                  </p>
                  <p className="mt-1 font-mono text-4xl font-bold text-white">{formatClock(remain)}</p>
                  {paused ? (
                    <p className="mt-2 text-sm font-semibold text-amber-100">
                      El docente pausó el reto. El tiempo ya corrido se conserva.
                    </p>
                  ) : done ? (
                    <p className="mt-2 text-sm font-semibold text-rose-100">
                      Levanten las manos. No sigan construyendo.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
