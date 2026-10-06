import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chooseStudentLecturaLeader,
  getApiErrorMessage,
  startStudentLecturaTimer,
} from "../lib/api";
import {
  colorDeEquipo,
  formatClock,
  LECTURA_MINUTOS,
  LECTURA_PROGRAMA,
  remainingSeconds,
} from "../lib/lecturaTkinter";
import type { StudentLectura } from "../lib/types";
import LecturaIndicacion from "./LecturaIndicacion";

const READ_KEY = "simeval-lectura-read-v1";

export default function StudentColorReadingCard({ lectura }: { lectura: StudentLectura }) {
  const qc = useQueryClient();
  const options = useMemo(() => {
    const past = lectura.pastReadings ?? [];
    const rest = past.filter((item) => item.sessionNumber !== lectura.sessionNumber);
    return [lectura, ...rest];
  }, [lectura]);

  const [sessionNumber, setSessionNumber] = useState(lectura.sessionNumber);
  const shown = options.find((item) => item.sessionNumber === sessionNumber) ?? lectura;
  const paint = colorDeEquipo(shown.columna, shown.hex);
  const hex = paint.hex;
  const colorName = paint.name;
  const myName = shown.displayName || shown.teammates.find((m) => m.isMe)?.displayName || "Tu turno";
  const isLive = shown.sessionNumber === lectura.sessionNumber;
  const minutes = lectura.minutes || LECTURA_MINUTOS;
  const [open, setOpen] = useState(() => localStorage.getItem(READ_KEY) !== "1");
  const [read, setRead] = useState(() => localStorage.getItem(READ_KEY) === "1");
  const [nomineeId, setNomineeId] = useState(lectura.leaderId ?? "");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [openParas, setOpenParas] = useState<Record<string, boolean>>(() => {
    const mine = shown.teammates.find((m) => m.isMe);
    return mine ? { [mine.studentId]: true } : {};
  });

  useEffect(() => {
    setNomineeId(lectura.leaderId ?? "");
  }, [lectura.leaderId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  void now;

  const remain = remainingSeconds(isLive ? lectura.startedAt : null, minutes);
  const done = Boolean(isLive && lectura.startedAt) && remain === 0;
  const timerOn = Boolean(isLive && lectura.startedAt);

  const leaderMutation = useMutation({
    mutationFn: (leaderId: string) => chooseStudentLecturaLeader(leaderId),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const startMutation = useMutation({
    mutationFn: startStudentLecturaTimer,
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function chooseSession(next: number) {
    setSessionNumber(next);
    const item = options.find((o) => o.sessionNumber === next) ?? lectura;
    const mine = item.teammates.find((m) => m.isMe);
    setOpenParas(mine ? { [mine.studentId]: true } : {});
  }

  function togglePara(id: string) {
    setOpenParas((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
      `¿Activar el reloj de ${minutes} minutos?\n\nSolo el líder puede hacerlo. Cuando arranque, ya no podrán cambiar de líder. Entonces sí leen los párrafos en voz alta.`,
    );
    if (!ok) return;
    startMutation.mutate();
  }

  const headerStatus = !isLive
    ? `Consulta · sesión ${shown.sessionNumber}`
    : timerOn
      ? done
        ? "Tiempo agotado — levanten las manos."
        : `Reloj: ${formatClock(remain)}`
      : lectura.leaderName
        ? `Líder: ${lectura.leaderName}. Lean y activen cuando estén listos.`
        : "Lean las instrucciones y elijan un líder.";

  return (
    <section className="glass mb-6 overflow-hidden border-2 p-0" style={{ borderColor: hex }}>
      {options.length > 1 ? (
        <div className="px-5 pt-4 no-print">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Consultar lectura
            <select
              value={shown.sessionNumber}
              onChange={(e) => chooseSession(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white"
            >
              {options.map((item) => (
                <option key={item.sessionNumber} value={item.sessionNumber}>
                  Sesión {item.sessionNumber} · {item.topic} · {item.titulo}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left no-print"
        style={{ backgroundColor: `${hex}40` }}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
            {LECTURA_PROGRAMA} · {colorName} · columna {shown.columna}
          </p>
          <p className="mt-1 text-xs text-slate-400">{shown.topic}</p>
          <h2 className="mt-1 text-lg font-bold text-white">{shown.titulo}</h2>
          <p className="mt-1 text-sm text-slate-300">{headerStatus}</p>
        </div>
        <span className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {open ? "Ocultar" : "Ver lectura"}
        </span>
      </button>

      <div className="hidden px-5 py-4 print:block" style={{ backgroundColor: `${hex}40` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
          Solo tu equipo · {colorName} · sesión {shown.sessionNumber}
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">{shown.titulo}</h2>
      </div>

      <div className={open ? "block" : "hidden print:block"}>
        {isLive ? (
          <div className="space-y-5 border-t border-white/10 px-5 py-5">
            <LecturaIndicacion />

            {!read ? (
              <button
                type="button"
                onClick={markRead}
                className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Ya leí las instrucciones
              </button>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-white">Equipo</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Elijan al líder; el botón de activar solo le aparece a esa persona. El reloj dura {minutes}{" "}
                  minutos.
                </p>
                <ul className="mt-3 space-y-2">
                  {shown.teammates.map((m) => (
                    <li key={m.studentId}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                        <input
                          type="radio"
                          name="lectura-leader"
                          value={m.studentId}
                          checked={nomineeId === m.studentId}
                          disabled={timerOn || leaderMutation.isPending}
                          onChange={() => setNomineeId(m.studentId)}
                        />
                        <span>
                          {m.displayName}
                          {m.studentId === lectura.leaderId ? " · líder actual" : ""}
                          {m.isMe ? " · tú" : ""}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {!timerOn ? (
                  <button
                    type="button"
                    onClick={confirmLeader}
                    disabled={leaderMutation.isPending || !nomineeId}
                    className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                  >
                    {leaderMutation.isPending ? "Guardando líder..." : "Confirmar líder del equipo"}
                  </button>
                ) : null}

                {lectura.isLeader && !timerOn ? (
                  <button
                    type="button"
                    onClick={startTimer}
                    disabled={startMutation.isPending}
                    className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {startMutation.isPending ? "Activando..." : `Activar actividad (${minutes} min)`}
                  </button>
                ) : null}

                {!lectura.isLeader && lectura.leaderName && !timerOn ? (
                  <p className="mt-3 text-sm text-slate-300">
                    Esperen a que {lectura.leaderName} pulse{" "}
                    <span className="font-semibold">Activar actividad</span>.
                  </p>
                ) : null}

                {timerOn ? (
                  <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
                      {done ? "Tiempo agotado" : "Tiempo restante"}
                    </p>
                    <p className="mt-1 font-mono text-4xl font-bold text-white">{formatClock(remain)}</p>
                    {done ? (
                      <p className="mt-2 text-sm font-semibold text-rose-100">
                        Levanten las manos. Cierren Canva y prepárense a exponer.
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

        {(!isLive || timerOn) ? (
          <>
            <div className="border-t border-white/10 px-5 py-5" style={{ backgroundColor: `${hex}40` }}>
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">
                Tú lees este párrafo en voz alta
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {shown.roleName} · {myName}
              </p>
              <p className="mt-3 max-w-prose text-[15px] leading-7 text-white">{shown.paragraph}</p>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lectura completa de tu equipo (toca un nombre para ver u ocultar su párrafo)
              </p>
              <ol className="mt-3 space-y-3">
                {shown.teammates.map((m) => {
                  const paraOpen = Boolean(openParas[m.studentId]);
                  return (
                    <li
                      key={m.studentId}
                      className={`rounded-xl border ${
                        m.isMe
                          ? "border-cyan-400/50 bg-cyan-500/15 ring-1 ring-cyan-300/30"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => togglePara(m.studentId)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left no-print"
                        aria-expanded={paraOpen}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          {m.roleName}
                          {m.isMe ? " · tú" : ""} · {m.displayName}
                        </p>
                        <span className="text-xs font-semibold text-slate-400">
                          {paraOpen ? "Ocultar" : "Ver"}
                        </span>
                      </button>
                      <p className="hidden px-4 pb-3 text-xs font-bold uppercase tracking-wide text-slate-400 print:block">
                        {m.roleName}
                        {m.isMe ? " · tú" : ""} · {m.displayName}
                      </p>
                      <p
                        className={`max-w-prose px-4 pb-3 text-[15px] leading-7 text-slate-100 ${
                          paraOpen ? "block" : "hidden print:block"
                        }`}
                      >
                        {m.paragraph}
                      </p>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3">
                <p className="text-sm font-semibold text-indigo-100">Producto de todo el equipo</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">
                  {shown.producto ||
                    "Armen UN solo organizador gráfico o mapa cognitivo en Canva y expónganlo frente al grupo."}
                </p>
              </div>
            </div>
          </>
        ) : isLive && read && !timerOn ? (
          <p className="border-t border-white/10 px-5 py-4 text-sm text-slate-400">
            Los párrafos se muestran cuando el líder active el reloj de {minutes} minutos.
          </p>
        ) : null}
      </div>
    </section>
  );
}
