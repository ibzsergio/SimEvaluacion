import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createAnnouncement,
  createTask,
  deleteAnnouncement,
  deleteSchoolCalendar,
  deleteTask,
  fetchTeacherComms,
  getApiErrorMessage,
  openTeacherCalendarFile,
  uploadSchoolCalendar,
} from "../lib/api";

export default function TeacherCommsPanel() {
  const qc = useQueryClient();
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", groupId: "" });
  const [taskForm, setTaskForm] = useState({ title: "", body: "", groupId: "", dueDate: "" });
  const [calendarTitle, setCalendarTitle] = useState("Calendario escolar");
  const [semesterLabel, setSemesterLabel] = useState("");
  const [calendarFile, setCalendarFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useQuery({
    queryKey: ["teacher-comms"],
    queryFn: fetchTeacherComms,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["teacher-comms"] });

  const announcementMutation = useMutation({
    mutationFn: () =>
      createAnnouncement({
        title: announcementForm.title.trim(),
        body: announcementForm.body.trim(),
        groupId: announcementForm.groupId || null,
      }),
    onSuccess: () => {
      setAnnouncementForm({ title: "", body: "", groupId: "" });
      setSuccess("Aviso publicado.");
      setError("");
      invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const taskMutation = useMutation({
    mutationFn: () =>
      createTask({
        title: taskForm.title.trim(),
        body: taskForm.body.trim(),
        groupId: taskForm.groupId || null,
        dueDate: taskForm.dueDate || null,
      }),
    onSuccess: () => {
      setTaskForm({ title: "", body: "", groupId: "", dueDate: "" });
      setSuccess("Tarea publicada.");
      setError("");
      invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const calendarMutation = useMutation({
    mutationFn: () => {
      if (!calendarFile) throw new Error("file_required");
      return uploadSchoolCalendar(calendarFile, calendarTitle, semesterLabel);
    },
    onSuccess: () => {
      setCalendarFile(null);
      setSuccess("Calendario escolar actualizado.");
      setError("");
      invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const data = query.data;
  if (query.isLoading) return <p className="text-slate-400">Cargando comunicación...</p>;
  if (!data) return <p className="text-rose-300">No se pudo cargar la comunicación.</p>;

  const groups = data.groups;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}

      <section className="glass p-6">
        <h2 className="text-lg font-semibold text-white">Calendario escolar</h2>
        <p className="mt-1 text-sm text-slate-400">
          Sube PDF o imagen (JPEG, PNG, WebP). Los alumnos lo verán en su panel y en la app instalada.
        </p>
        {data.calendar ? (
          <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-slate-200">
            <p className="font-semibold text-white">{data.calendar.title}</p>
            {data.calendar.semesterLabel ? (
              <p className="text-slate-400">{data.calendar.semesterLabel}</p>
            ) : null}
            <p className="text-xs text-slate-500">
              {data.calendar.fileName} · Publicado {formatDate(data.calendar.publishedAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openTeacherCalendarFile().catch((err) => setError(getApiErrorMessage(err)))}
                className="rounded-lg bg-cyan-500/90 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Ver archivo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("¿Eliminar el calendario escolar?")) return;
                  deleteSchoolCalendar()
                    .then(() => {
                      setSuccess("Calendario eliminado.");
                      invalidate();
                    })
                    .catch((err) => setError(getApiErrorMessage(err)));
                }}
                className="rounded-lg border border-rose-400/30 px-4 py-2 text-xs text-rose-200 hover:bg-rose-500/15"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Aún no hay calendario publicado.</p>
        )}
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            if (!calendarFile) {
              setError("Selecciona un archivo.");
              return;
            }
            calendarMutation.mutate();
          }}
        >
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Título
            <input
              value={calendarTitle}
              onChange={(e) => setCalendarTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Etiqueta del semestre (opcional)
            <input
              value={semesterLabel}
              onChange={(e) => setSemesterLabel(e.target.value)}
              placeholder="Agosto 2026 – Enero 2027"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Archivo
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setCalendarFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm text-slate-300"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={calendarMutation.isPending}
              className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {calendarMutation.isPending ? "Subiendo..." : "Publicar calendario"}
            </button>
          </div>
        </form>
      </section>

      <section className="glass p-6">
        <h2 className="text-lg font-semibold text-white">Nuevo aviso</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            if (announcementForm.title.trim().length < 1 || announcementForm.body.trim().length < 1) {
              setError("Título y mensaje son obligatorios.");
              return;
            }
            announcementMutation.mutate();
          }}
        >
          <label className="block text-xs text-slate-400">
            Grupo (opcional — vacío = todos)
            <select
              value={announcementForm.groupId}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, groupId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            >
              <option value="">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Grupo {g.code} · {g.shift}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Título
            <input
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
              required
            />
          </label>
          <label className="block text-xs text-slate-400">
            Mensaje
            <textarea
              value={announcementForm.body}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
              required
            />
          </label>
          <button
            type="submit"
            disabled={announcementMutation.isPending}
            className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {announcementMutation.isPending ? "Publicando..." : "Publicar aviso"}
          </button>
        </form>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Avisos publicados</h3>
          <ul className="space-y-2">
            {data.announcements.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-white">{a.title}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("¿Eliminar este aviso?")) return;
                      deleteAnnouncement(a.id)
                        .then(() => invalidate())
                        .catch((err) => setError(getApiErrorMessage(err)));
                    }}
                    className="text-xs text-rose-300 hover:text-rose-200"
                  >
                    Eliminar
                  </button>
                </div>
                <p className="mt-1 text-slate-300">{a.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {a.group?.code ? `Grupo ${a.group.code}` : "Todos"} · {formatDate(a.createdAt)}
                </p>
              </li>
            ))}
            {!data.announcements.length ? (
              <p className="text-xs text-slate-500">Sin avisos.</p>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="glass p-6">
        <h2 className="text-lg font-semibold text-white">Nueva tarea</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            if (taskForm.title.trim().length < 1 || taskForm.body.trim().length < 1) {
              setError("Título y descripción son obligatorios.");
              return;
            }
            taskMutation.mutate();
          }}
        >
          <label className="block text-xs text-slate-400">
            Grupo (opcional)
            <select
              value={taskForm.groupId}
              onChange={(e) => setTaskForm((f) => ({ ...f, groupId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            >
              <option value="">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Grupo {g.code} · {g.shift}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Título
            <input
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
              required
            />
          </label>
          <label className="block text-xs text-slate-400">
            Descripción / instrucciones
            <textarea
              value={taskForm.body}
              onChange={(e) => setTaskForm((f) => ({ ...f, body: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
              required
            />
          </label>
          <label className="block text-xs text-slate-400">
            Fecha límite (opcional)
            <input
              type="date"
              value={taskForm.dueDate}
              onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
          </label>
          <button
            type="submit"
            disabled={taskMutation.isPending}
            className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {taskMutation.isPending ? "Publicando..." : "Publicar tarea"}
          </button>
        </form>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Tareas publicadas</h3>
          <ul className="space-y-2">
            {data.tasks.map((t) => (
              <li key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-white">{t.title}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("¿Eliminar esta tarea?")) return;
                      deleteTask(t.id)
                        .then(() => invalidate())
                        .catch((err) => setError(getApiErrorMessage(err)));
                    }}
                    className="text-xs text-rose-300 hover:text-rose-200"
                  >
                    Eliminar
                  </button>
                </div>
                <p className="mt-1 text-slate-300">{t.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {t.group?.code ? `Grupo ${t.group.code}` : "Todos"}
                  {t.dueDate ? ` · Entrega: ${formatDate(t.dueDate)}` : ""}
                  · {formatDate(t.createdAt)}
                </p>
              </li>
            ))}
            {!data.tasks.length ? <p className="text-xs text-slate-500">Sin tareas.</p> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
