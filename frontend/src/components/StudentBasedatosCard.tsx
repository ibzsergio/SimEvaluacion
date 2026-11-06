import { useQuery } from "@tanstack/react-query";
import { fetchStudentComms } from "../lib/api";
import { studentBasedatosFromAnnouncements } from "../lib/basedatosLive";
import {
  BASEDATOS_BLOQUES,
  BASEDATOS_CADA_QUIEN,
  BASEDATOS_EJEMPLO,
  BASEDATOS_FIRMAS_MAX,
  BASEDATOS_FUNCIONES,
  BASEDATOS_PREGUNTAS,
  BASEDATOS_PROGRAMA,
  BASEDATOS_SI_SOBRAN,
  BASEDATOS_SISTEMA,
  BASEDATOS_TITULO,
  basedatosRoleLabel,
  basedatosRoleTask,
} from "../lib/basedatosScrum";
import type { StudentExtra } from "../lib/types";

export default function StudentBasedatosCard({
  extra,
  studentId,
}: {
  extra?: StudentExtra | null;
  studentId?: string | null;
}) {
  const comms = useQuery({
    queryKey: ["student-comms"],
    queryFn: fetchStudentComms,
    staleTime: 4_000,
    refetchInterval: 8_000,
  });
  const activity = studentBasedatosFromAnnouncements(extra, comms.data?.announcements ?? [], studentId);
  if (!activity) return null;

  const firmas = activity.firmas ?? BASEDATOS_FIRMAS_MAX;
  const role = basedatosRoleLabel(activity.role);

  return (
    <section className="glass mb-6 overflow-hidden p-0">
      <div className="bg-gradient-to-r from-sky-600/30 to-cyan-500/10 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">{BASEDATOS_PROGRAMA}</p>
        <h2 className="mt-1 text-xl font-bold text-white">{BASEDATOS_TITULO}</h2>
        <p className="mt-1 text-sm text-slate-200">
          {activity.teamName ? `${activity.teamName} · ` : ""}
          {role ? `${role} · ` : ""}
          {firmas.toLocaleString("es-MX")} / {BASEDATOS_FIRMAS_MAX.toLocaleString("es-MX")} firmas
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        {activity.noTeam ? (
          <p className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Aún no estás en un equipo de Roles / Equipos. Pide al docente que te asigne y, mientras tanto, abre tu archivo.
          </p>
        ) : null}

        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-sm font-bold text-white">El sistema que ya tienen en las pantallas</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-100">
            {BASEDATOS_SISTEMA.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Las funciones</p>
          <ul className="mt-2 space-y-2">
            {BASEDATOS_FUNCIONES.map((item) => (
              <li key={item.id} className="rounded-2xl border border-white/10 px-3 py-2">
                <p className="text-sm font-semibold text-white">{item.nombre}</p>
                <p className="text-sm text-sky-100">{item.quien}</p>
                <p className="text-sm text-slate-300">{item.hace}</p>
                <p className="mt-1 text-sm text-slate-400">{item.cambio}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3">
          <p className="text-sm font-bold text-white">Tu función, en tu computadora</p>
          <p className="mt-1 text-sm text-sky-50">Para esa función contestas esto, además de que el programa corra:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-100">
            {BASEDATOS_PREGUNTAS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-100">
            {BASEDATOS_CADA_QUIEN.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-sky-100">{BASEDATOS_SI_SOBRAN}</p>
        </div>

        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tu encargo extra</p>
          <p className="mt-1 text-sm text-slate-100">{basedatosRoleTask(activity.role)}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Las horas de la sala</p>
          <ol className="mt-2 space-y-2">
            {BASEDATOS_BLOQUES.map((block) => (
              <li key={block.id}>
                <p className="text-sm font-semibold text-white">{block.nombre}</p>
                <p className="text-sm text-slate-300">{block.detalle}</p>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Así se ve tu archivo</p>
          <p className="mt-1 text-sm text-slate-400">
            Este ejemplo es pasar lista. Cámbialo por la función que te tocó y por los nombres de tu modelo.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
            {BASEDATOS_EJEMPLO}
          </pre>
        </div>

        {(activity.notes ?? []).length > 0 ? (
          <ul className="space-y-1 text-sm text-rose-100">
            {(activity.notes ?? []).map((note) => (
              <li key={note.id}>
                −{note.points} {note.label}
                {note.studentName ? ` · ${note.studentName}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
