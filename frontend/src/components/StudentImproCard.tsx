import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chooseStudentImproLeader, getApiErrorMessage, startStudentImproTimer } from "../lib/api";
import {
  IMPRO_FIRMAS_MAX,
  IMPRO_MINUTOS,
  IMPRO_PROGRAMA,
  IMPRO_TITULO,
  elapsedSeconds,
  formatClock,
  improRoleLabel,
  improRoleTask,
  improSprintAt,
  remainingSeconds,
} from "../lib/improScrum";
import type { StudentImpro } from "../lib/types";
import ImproIndicacion from "./ImproIndicacion";

const READ_KEY = "simeval-impro-read-v1";

export default function StudentImproCard({ impro }: { impro: StudentImpro }) {
  const qc = useQueryClient();
  const hex = impro.hex;
  const onlyMember = impro.members.length === 1 ? impro.members[0]!.studentId : "";
  const [read, setRead] = useState(() => localStorage.getItem(READ_KEY) === "1");
  const [open, setOpen] = useState(() => localStorage.getItem(READ_KEY) !== "1");
  const [nomineeId, setNomineeId] = useState(impro.leaderId ?? onlyMember);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const firmasMax = impro.firmasMax ?? IMPRO_FIRMAS_MAX;
  const firmasShown =
    impro.firmas ??
    Math.max(0, firmasMax - (impro.notes ?? []).reduce((acc, note) => acc + Math.max(0, note.points), 0));

  useEffect(() => {
    setNomineeId(impro.leaderId ?? onlyMember);
  }, [impro.leaderId, onlyMember]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remain = remainingSeconds(impro.startedAt, impro.minutes || IMPRO_MINUTOS, impro.pausedAt);
  const paused = Boolean(impro.pausedAt);
  const done = Boolean(impro.startedAt) && remain === 0 && !paused;
  const sprint = impro.startedAt
    ? improSprintAt(elapsedSeconds(impro.startedAt, impro.minutes || IMPRO_MINUTOS, impro.pausedAt))
    : null;
  void now;

  const leaderMutation = useMutation({
    mutationFn: (leaderId: string) => chooseStudentImproLeader(leaderId),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const startMutation = useMutation({
    mutationFn: startStudentImproTimer,
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
      `¿Activar el reloj de ${impro.minutes || IMPRO_MINUTOS} minutos?\n\nSolo el líder puede hacerlo. Cuando arranque, ya no podrán cambiar de líder.`,
    );
    if (!ok) return;
    startMutation.mutate();
  }

  const headline = impro.noTeam
    ? "Aún no estás en un equipo de Roles / Equipos."
    : paused
      ? impro.startedAt
        ? `Pausado por el docente · ${formatClock(remain)}`
        : "Pausado por el docente. El reloj aún no arranca."
      : impro.startedAt
        ? done
          ? "Tiempo agotado — manos arriba. No sigan construyendo."
          : sprint?.id === "silencio"
            ? `Silencio · ${formatClock(remain)}`
            : `${sprint?.nombre ?? "Reloj"} · ${formatClock(remain)}`
        : impro.leaderName
          ? `Líder: ${impro.leaderName}. Lean y activen cuando estén listos.`
          : "Lean el reto, tomen su rol y elijan un líder.";

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
            {IMPRO_PROGRAMA}
            {impro.teamName ? ` · ${impro.teamName}` : ""}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{IMPRO_TITULO}</h2>
          <p className="mt-1 text-sm text-slate-300">{headline}</p>
        </div>
        <span className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {open ? "Ocultar" : "Ver reto"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 px-5 pb-5 pt-2">
          {sprint?.id === "silencio" && !done && !paused ? (
            <div className="rounded-xl border border-orange-400/40 bg-orange-500/15 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-200">Ahora: silencio</p>
              <p className="mt-1 text-sm text-orange-50">
                Nadie habla. Comuníquense con notas y gestos hasta el minuto 22.
              </p>
            </div>
          ) : null}

          {impro.firmas != null || (impro.notes && impro.notes.length > 0) ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Tus Firmas</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {firmasShown.toLocaleString("es-MX")} / {firmasMax.toLocaleString("es-MX")}
              </p>
              {impro.notes && impro.notes.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-amber-100">
                  {impro.notes.map((n) => (
                    <li key={n.id}>
                      {n.label}
                      {n.studentName ? ` · ${n.studentName}` : ""} −{n.points}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-amber-100">Sin notas. El docente aún puede anotar.</p>
              )}
            </div>
          ) : null}

          <ImproIndicacion />

          {!impro.role ? null : (
            <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-200">Tu encargo</p>
              <p className="mt-1 text-sm font-semibold text-white">{improRoleLabel(impro.role)}</p>
              <p className="mt-1 text-sm text-orange-50">{improRoleTask(impro.role)}</p>
            </div>
          )}

          {impro.noTeam ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              No apareces en un equipo de Roles / Equipos. El docente te puede asignar ahí.
            </p>
          ) : !read ? (
            <button
              type="button"
              onClick={markRead}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500"
            >
              Ya leí las instrucciones
            </button>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold text-white">Equipo de proyecto</h3>
              <p className="mt-1 text-xs text-slate-400">
                El mismo de Roles / Equipos. Elijan al líder; el botón de activar solo le aparece a esa
                persona. Todos construyen.
              </p>
              <ul className="mt-3 space-y-2">
                {impro.members.map((m) => (
                  <li key={m.studentId}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                      <input
                        type="radio"
                        name="impro-leader"
                        value={m.studentId}
                        checked={nomineeId === m.studentId}
                        disabled={Boolean(impro.startedAt) || leaderMutation.isPending}
                        onChange={() => setNomineeId(m.studentId)}
                      />
                      <span>
                        {m.displayName}
                        {m.role ? ` · ${improRoleLabel(m.role)}` : ""}
                        {m.studentId === impro.leaderId ? " · líder actual" : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {!impro.startedAt ? (
                <button
                  type="button"
                  onClick={confirmLeader}
                  disabled={leaderMutation.isPending || !nomineeId}
                  className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                >
                  {leaderMutation.isPending ? "Guardando líder..." : "Confirmar líder del equipo"}
                </button>
              ) : null}

              {impro.isLeader && !impro.startedAt ? (
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
                      : `Activar actividad (${impro.minutes || IMPRO_MINUTOS} min)`}
                </button>
              ) : null}

              {!impro.isLeader && impro.leaderName && !impro.startedAt ? (
                <p className="mt-3 text-sm text-slate-300">
                  Esperen a que {impro.leaderName} pulse <span className="font-semibold">Activar actividad</span>.
                </p>
              ) : null}

              {impro.startedAt ? (
                <div
                  className={`mt-4 rounded-xl border p-4 text-center ${
                    sprint?.id === "silencio" && !done
                      ? "border-orange-400/40 bg-orange-500/15"
                      : "border-amber-400/30 bg-amber-500/10"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
                    {done ? "Tiempo agotado" : paused ? "Pausado" : (sprint?.nombre ?? "Tiempo restante")}
                  </p>
                  <p className="mt-1 font-mono text-4xl font-bold text-white">{formatClock(remain)}</p>
                  {paused ? (
                    <p className="mt-2 text-sm font-semibold text-amber-100">
                      El docente pausó el reto. El tiempo ya corrido se conserva.
                    </p>
                  ) : done ? (
                    <p className="mt-2 text-sm font-semibold text-rose-100">
                      Manos arriba. El puesto se queda como está.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-200">{sprint?.detalle}</p>
                  )}
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
