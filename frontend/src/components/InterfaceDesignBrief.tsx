import { formatCalendarDate } from "../lib/dates";
import {
  INTERFACE_ACTIVITY_NAME,
  INTERFACE_CLOSE_ISO,
  INTERFACE_CRITERIA,
  INTERFACE_MAX_POINTS,
} from "../lib/interfaceDesign";

export default function InterfaceDesignBrief({
  mode,
  released = false,
  points,
  teamName,
  notes = [],
  onRelease,
  releasing = false,
}: {
  mode: "teacher" | "student";
  released?: boolean;
  points?: number | null;
  teamName?: string | null;
  notes?: Array<{ id: string; label: string; points: number; studentName?: string | null }>;
  onRelease?: (released: boolean) => void;
  releasing?: boolean;
}) {
  const dateLabel = formatCalendarDate(INTERFACE_CLOSE_ISO);

  return (
    <section className="glass mb-4 overflow-hidden p-0">
      <div className="bg-gradient-to-r from-violet-600/30 to-cyan-500/10 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-200">
          Segundo parcial · actividad de equipo
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">{INTERFACE_ACTIVITY_NAME}</h2>
        <p className="mt-1 text-sm text-slate-200">
          Hasta {INTERFACE_MAX_POINTS.toLocaleString("es-MX")} puntos · cierra el {dateLabel}
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <p className="text-sm text-slate-300">
          El equipo parte de {INTERFACE_MAX_POINTS.toLocaleString("es-MX")} puntos. El puntaje baja
          si no se cumple lo de abajo.
        </p>
        <ul className="space-y-2">
          {INTERFACE_CRITERIA.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                {"penalty" in item && item.penalty ? (
                  <span className="shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-100">
                    {item.penalty}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{item.detail}</p>
            </li>
          ))}
        </ul>

        {mode === "student" ? (
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
            <p>{teamName ? `Tu equipo: ${teamName}` : "Cuando el docente te asigne equipo, aquí verás tu puntaje."}</p>
            {points != null ? (
              <p className="mt-1 text-emerald-200">
                Tu puntaje:{" "}
                <span className="font-bold text-white">
                  {points.toLocaleString("es-MX")} de {INTERFACE_MAX_POINTS.toLocaleString("es-MX")}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-slate-400">Todavía sin registrar. El equipo parte de 3,000.</p>
            )}
            {notes.length ? (
              <ul className="mt-2 space-y-1 text-xs text-amber-100">
                {notes.map((note) => (
                  <li key={note.id}>
                    {note.label}
                    {note.studentName ? ` · ${note.studentName}` : ""} −{note.points}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {mode === "teacher" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <p className="text-sm text-slate-300">
              {released
                ? "Los alumnos ya la ven en su teléfono."
                : "Solo tú la ves. Los alumnos todavía no."}
            </p>
            <button
              type="button"
              disabled={releasing || !onRelease}
              onClick={() => onRelease?.(!released)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                released
                  ? "border border-white/15 bg-white/10 hover:bg-white/15"
                  : "bg-violet-600 hover:bg-violet-500"
              }`}
            >
              {releasing ? "Guardando..." : released ? "Ocultar a los alumnos" : "Liberar a los alumnos"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
