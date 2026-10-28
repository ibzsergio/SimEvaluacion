import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentComms } from "../lib/api";
import { studentMaquinaFromAnnouncements } from "../lib/maquinaLive";
import {
  MAQUINA_FIRMAS_MAX,
  MAQUINA_MATERIALES,
  MAQUINA_MINUTOS,
  MAQUINA_PRODUCTO,
  MAQUINA_PRODUCTO_DEBE,
  MAQUINA_SPRINTS,
  MAQUINA_TITULO,
  elapsedSeconds,
  formatClock,
  maquinaRoleLabel,
  maquinaRoleTask,
  maquinaSprintAt,
  remainingSeconds,
} from "../lib/maquinaScrum";
import type { StudentExtra } from "../lib/types";

export default function StudentMaquinaCard({ extra }: { extra?: StudentExtra | null }) {
  const [now, setNow] = useState(() => Date.now());
  const comms = useQuery({
    queryKey: ["student-comms"],
    queryFn: fetchStudentComms,
    staleTime: 4_000,
    refetchInterval: 5_000,
  });
  const maquina = studentMaquinaFromAnnouncements(extra, comms.data?.announcements ?? []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  void now;

  if (!maquina) return null;

  const minutes = maquina.minutes || MAQUINA_MINUTOS;
  const remain = remainingSeconds(maquina.startedAt, minutes, maquina.pausedAt);
  const paused = Boolean(maquina.pausedAt);
  const done = Boolean(maquina.startedAt) && remain === 0 && !paused;
  const sprint = maquina.startedAt
    ? maquinaSprintAt(elapsedSeconds(maquina.startedAt, minutes, maquina.pausedAt))
    : null;
  const firmas = maquina.firmas ?? MAQUINA_FIRMAS_MAX;

  return (
    <section className="glass mb-6 overflow-hidden p-0">
      <div className="bg-gradient-to-r from-lime-600/30 to-emerald-500/10 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-lime-200">Actividad Scrum</p>
        <h2 className="mt-1 text-xl font-bold text-white">{MAQUINA_TITULO}</h2>
        <p className="mt-1 text-sm text-slate-200">
          {maquina.teamName ? `${maquina.teamName} · ` : ""}
          {MAQUINA_FIRMAS_MAX.toLocaleString("es-MX")} firmas · {minutes} minutos
        </p>
      </div>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="rounded-2xl border border-lime-400/30 bg-slate-950/40 px-4 py-3 text-center">
          <p className="font-mono text-4xl font-bold text-white">
            {!maquina.startedAt ? formatClock(minutes * 60) : paused ? formatClock(remain) : formatClock(remain)}
          </p>
          <p className="mt-1 text-sm text-lime-100">
            {!maquina.startedAt
              ? "Esperen a que el docente inicie los 50 minutos."
              : paused
                ? "Reloj en pausa."
                : done
                  ? "Tiempo agotado. Manos arriba."
                  : sprint?.nombre}
          </p>
          {sprint && maquina.startedAt && !done ? (
            <p className="mt-1 text-xs text-slate-400">{sprint.detalle}</p>
          ) : null}
        </div>

        <p className="text-sm text-slate-300">{MAQUINA_PRODUCTO}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          {MAQUINA_PRODUCTO_DEBE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          {MAQUINA_MATERIALES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        {maquina.noTeam ? (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Todavía no apareces en un equipo de Roles / Equipos.
          </p>
        ) : (
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
            <p>{maquina.leaderName ? `Líder: ${maquina.leaderName}` : "Su equipo aún no tiene líder."}</p>
            <p className="mt-1 text-lime-100">
              Firmas de tu equipo: {firmas.toLocaleString("es-MX")} de {MAQUINA_FIRMAS_MAX.toLocaleString("es-MX")}
            </p>
            {maquina.role ? (
              <p className="mt-2 text-xs text-slate-400">
                <span className="font-semibold text-white">{maquinaRoleLabel(maquina.role)}.</span>{" "}
                {maquinaRoleTask(maquina.role)}
              </p>
            ) : null}
          </div>
        )}

        {!maquina.startedAt ? (
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-400">
            {MAQUINA_SPRINTS.map((item) => (
              <li key={item.id}>
                {item.nombre}: {item.detalle}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
