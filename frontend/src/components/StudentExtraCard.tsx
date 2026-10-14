import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chooseStudentExtraLeader,
  getApiErrorMessage,
  startStudentExtraTimer,
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
import type { StudentExtra } from "../lib/types";
import ExtraIllustration from "./ExtraIllustration";
import ExtraIndicacion from "./ExtraIndicacion";

const READ_KEY = "simeval-extra-read-v1";

export default function StudentExtraCard({ extra }: { extra: StudentExtra }) {
  const qc = useQueryClient();
  const hex = extra.hex;
  const [read, setRead] = useState(() => localStorage.getItem(READ_KEY) === "1");
  const [open, setOpen] = useState(() => localStorage.getItem(READ_KEY) !== "1");
  const [nomineeId, setNomineeId] = useState(extra.leaderId ?? "");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNomineeId(extra.leaderId ?? "");
  }, [extra.leaderId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remain = remainingSeconds(extra.startedAt, extra.minutes || EXTRA_MINUTOS, extra.pausedAt);
  const paused = Boolean(extra.pausedAt);
  const done = Boolean(extra.startedAt) && remain === 0 && !paused;
  void now;

  const leaderMutation = useMutation({
    mutationFn: (leaderId: string) => chooseStudentExtraLeader(leaderId),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const startMutation = useMutation({
    mutationFn: startStudentExtraTimer,
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
      `¿Activar el reloj de ${extra.minutes} minutos?\n\nSolo el líder puede hacerlo. Cuando arranque, ya no podrán cambiar de líder.`,
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
            {EXTRA_PROGRAMA} · {extra.teamName ?? extra.columna ?? extra.colorName}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{EXTRA_TITULO}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {paused
              ? extra.startedAt
                ? `Pausado por el docente · ${formatClock(remain)}`
                : "Pausado por el docente. El reloj aún no arranca."
              : extra.startedAt
                ? done
                  ? "Tiempo agotado — levanten las manos. No sigan pegando."
                  : `Reloj: ${formatClock(remain)}`
                : extra.leaderName
                  ? `Líder: ${extra.leaderName}. Lean y activen cuando estén listos.`
                  : "Lean las instrucciones y elijan un líder."}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {open ? "Ocultar" : "Ver reto"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 px-5 pb-5 pt-2">
          <ExtraIllustration compact />
          <ExtraIndicacion />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Misión por rol (todos pegan)</h3>
            {EXTRA_SECCIONES.map((sec) => (
              <div key={sec.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: hex }}>
                  {sec.rol} · {sec.titulo}
                </p>
                <p className="mt-1 text-sm text-slate-200">{sec.detalle}</p>
              </div>
            ))}
          </div>

          {!read ? (
            <button
              type="button"
              onClick={markRead}
              className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
            >
              Ya leí las instrucciones
            </button>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold text-white">
                {extra.rosterMode === "project" ? "Equipo de proyecto" : "Equipo"}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {extra.rosterMode === "project"
                  ? "El mismo de Roles / Equipos. Elijan al líder (de preferencia Scrum Master); el reloj solo lo activa esa persona."
                  : "Elijan al líder (de preferencia Scrum Master); el reloj solo lo activa esa persona."}
              </p>
              <ul className="mt-3 space-y-2">
                {extra.members.map((m) => (
                  <li key={m.studentId}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                      <input
                        type="radio"
                        name="extra-leader"
                        value={m.studentId}
                        checked={nomineeId === m.studentId}
                        disabled={Boolean(extra.startedAt) || leaderMutation.isPending}
                        onChange={() => setNomineeId(m.studentId)}
                      />
                      <span>
                        {m.displayName}
                        {m.role ? ` · ${extraRoleLabel(m.role)}` : ""}
                        {m.studentId === extra.leaderId ? " · líder actual" : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {!extra.startedAt ? (
                <button
                  type="button"
                  onClick={confirmLeader}
                  disabled={leaderMutation.isPending || !nomineeId}
                  className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                >
                  {leaderMutation.isPending ? "Guardando líder..." : "Confirmar líder del equipo"}
                </button>
              ) : null}

              {extra.isLeader && !extra.startedAt ? (
                <button
                  type="button"
                  onClick={startTimer}
                  disabled={startMutation.isPending || paused}
                  className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {paused
                    ? "Pausado — esperen a que reanude el docente"
                    : startMutation.isPending
                      ? "Activando..."
                      : `Activar actividad (${extra.minutes} min)`}
                </button>
              ) : null}

              {!extra.isLeader && extra.leaderName && !extra.startedAt ? (
                <p className="mt-3 text-sm text-slate-300">
                  Esperen a que {extra.leaderName} pulse <span className="font-semibold">Activar actividad</span>.
                </p>
              ) : null}

              {extra.startedAt ? (
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
                      Levanten las manos. No sigan pegando. Preparen el titular para gritarlo.
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
