import { useQuery } from "@tanstack/react-query";
import { fetchStudentComms, getApiErrorMessage, openStudentCalendarFile } from "../lib/api";

export default function StudentCommunication() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-comms"],
    queryFn: fetchStudentComms,
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return (
      <section className="glass mb-6 p-6 text-slate-400">
        Cargando avisos y tareas...
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass mb-6 border border-rose-400/30 p-6 text-sm text-rose-200">
        {getApiErrorMessage(error)}
      </section>
    );
  }

  if (!data) return null;

  const hasContent =
    data.calendar || data.announcements.length > 0 || data.tasks.length > 0;

  if (!hasContent) return null;

  return (
    <div className="mb-6 space-y-6">
      {data.calendar ? (
        <section className="glass border border-indigo-400/30 bg-indigo-500/10 p-6">
          <h2 className="text-lg font-semibold text-white">Calendario escolar</h2>
          <p className="mt-1 text-sm text-slate-300">{data.calendar.title}</p>
          {data.calendar.semesterLabel ? (
            <p className="text-sm text-indigo-200">{data.calendar.semesterLabel}</p>
          ) : null}
          <button
            type="button"
            onClick={() => openStudentCalendarFile().catch((err) => window.alert(getApiErrorMessage(err)))}
            className="mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white hover:from-indigo-400 hover:to-cyan-400"
          >
            Ver / descargar calendario
          </button>
        </section>
      ) : null}

      {data.announcements.length > 0 ? (
        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Avisos del docente</h2>
          <ul className="space-y-3">
            {data.announcements.map((a) => (
              <li
                key={a.id}
                className="rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-4"
              >
                <p className="font-semibold text-white">{a.title}</p>
                <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{a.body}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDate(a.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.tasks.length > 0 ? (
        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Tareas</h2>
          <ul className="space-y-3">
            {data.tasks.map((t) => (
              <li
                key={t.id}
                className="rounded-2xl border border-amber-400/25 bg-amber-500/5 p-4"
              >
                <p className="font-semibold text-white">{t.title}</p>
                <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{t.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {t.dueDate ? `Entrega: ${formatDate(t.dueDate)} · ` : ""}
                  Publicada {formatDate(t.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
