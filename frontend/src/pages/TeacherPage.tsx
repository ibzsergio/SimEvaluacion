import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import GroupRankingPanel from "../components/GroupRankingPanel";
import GroupStudentsPanel from "../components/GroupStudentsPanel";
import WeeklyWinnersPanel from "../components/WeeklyWinnersPanel";
import Layout from "../components/Layout";
import {
  createActivity,
  fetchActivities,
  fetchActivityGrades,
  fetchGroups,
  getApiErrorMessage,
  saveGrade,
} from "../lib/api";
import type { Activity, GradeRow } from "../lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"alumnos" | "actividades" | "ranking" | "semanas">("alumnos");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: todayIso(),
    name: "",
    maxPoints: 10,
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  const groups = groupsQuery.data ?? [];

  useEffect(() => {
    if (!selectedGroupId && groups[0]?.id) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const activitiesQuery = useQuery({
    queryKey: ["activities", selectedGroupId],
    queryFn: () => fetchActivities(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const activities = activitiesQuery.data ?? [];
  const activeId = selectedId ?? activities[0]?.id ?? null;

  const gradesQuery = useQuery({
    queryKey: ["grades", activeId],
    queryFn: () => fetchActivityGrades(activeId!),
    enabled: !!activeId,
  });

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: async (activity) => {
      setFormError("");
      setFormSuccess(`Actividad "${activity.name}" publicada en grupo ${selectedGroup?.code}.`);
      await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
      setSelectedId(activity.id);
      setForm({ date: todayIso(), name: "", maxPoints: 10 });
    },
    onError: (error) => {
      setFormSuccess("");
      setFormError(getApiErrorMessage(error));
    },
  });

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === activeId) ?? gradesQuery.data?.activity,
    [activities, activeId, gradesQuery.data?.activity],
  );

  return (
    <Layout
      title="Panel del docente"
      subtitle="Grupos 201 y 202 · Turno matutino — Sergio Ibañez Montiel"
    >
      <div className="mb-6 flex gap-2 border-b border-white/10 pb-2">
        <TabButton active={tab === "alumnos"} onClick={() => setTab("alumnos")}>
          Alumnos (Excel)
        </TabButton>
        <TabButton active={tab === "actividades"} onClick={() => setTab("actividades")}>
          Actividades y calificaciones
        </TabButton>
        <TabButton active={tab === "ranking"} onClick={() => setTab("ranking")}>
          Ranking del grupo
        </TabButton>
        <TabButton active={tab === "semanas"} onClick={() => setTab("semanas")}>
          Semanas y parcial
        </TabButton>
      </div>

      {tab === "semanas" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <WeeklyWinnersPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "ranking" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <GroupRankingPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "alumnos" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <GroupStudentsPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGroupId(g.id);
                  setSelectedId(null);
                }}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                  g.id === selectedGroupId
                    ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100"
                    : "border-white/10 bg-white/5 text-slate-300"
                }`}
              >
                Grupo {g.code}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <section className="glass p-5">
              <h2 className="mb-1 text-lg font-semibold text-white">Nueva actividad</h2>
              <p className="mb-4 text-xs text-cyan-300/90">Grupo {selectedGroup?.code} · {selectedGroup?.shift}</p>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError("");
                  setFormSuccess("");
                  if (!selectedGroupId) {
                    setFormError("Selecciona un grupo.");
                    return;
                  }
                  if (form.name.trim().length < 2) {
                    setFormError("El nombre debe tener al menos 2 caracteres.");
                    return;
                  }
                  if (form.maxPoints < 1) {
                    setFormError("El valor máximo debe ser al menos 1 punto.");
                    return;
                  }
                  createMutation.mutate({
                    groupId: selectedGroupId,
                    date: form.date,
                    name: form.name.trim(),
                    maxPoints: form.maxPoints,
                  });
                }}
              >
                <label className="block text-xs text-slate-400">
                  Fecha
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
                    required
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Nombre de la actividad
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
                    placeholder="Práctica 1 — Variables"
                    required
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Valor máximo (puntos)
                  <input
                    type="number"
                    min={1}
                    value={form.maxPoints}
                    onChange={(e) => setForm((f) => ({ ...f, maxPoints: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
                  />
                </label>
                <p className="text-xs text-slate-500">
                  Al calificar, indicas cuántos puntos obtuvo cada alumno (de 0 a este valor).
                </p>
                {formError ? (
                  <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {formError}
                  </p>
                ) : null}
                {formSuccess ? (
                  <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                    {formSuccess}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                >
                  {createMutation.isPending ? "Guardando..." : "Publicar actividad"}
                </button>
              </form>

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Actividades del grupo</h3>
                <ul className="max-h-64 space-y-2 overflow-auto pr-1">
                  {activities.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                          a.id === activeId
                            ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                        }`}
                      >
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(a.date)} · {a.maxPoints} pts
                        </p>
                      </button>
                    </li>
                  ))}
                  {!activities.length && !activitiesQuery.isLoading ? (
                    <p className="text-xs text-slate-500">Sin actividades en este grupo.</p>
                  ) : null}
                </ul>
              </div>
            </section>

            <section className="glass p-5">
              {!activeId || !selectedActivity ? (
                <p className="text-slate-400">
                  Crea una actividad o importa alumnos en la pestaña &quot;Alumnos (Excel)&quot;.
                </p>
              ) : (
                <GradesTable
                  activity={selectedActivity}
                  rows={gradesQuery.data?.rows ?? []}
                  loading={gradesQuery.isLoading}
                  onSaved={() => {
                    qc.invalidateQueries({ queryKey: ["grades", activeId] });
                    qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
                  }}
                />
              )}
            </section>
          </div>
        </>
      )}
    </Layout>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

type PointsDraft = { points: string };

function GradesTable({
  activity,
  rows,
  loading,
  onSaved,
}: {
  activity: Activity;
  rows: GradeRow[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, PointsDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts({});
    setSaveError(null);
  }, [activity.id]);

  function getDraft(row: GradeRow): PointsDraft {
    if (drafts[row.student.id]) return drafts[row.student.id];
    if (row.grade != null) return { points: String(row.grade.points) };
    return { points: "" };
  }

  async function handleSave(studentId: string) {
    const row = rows.find((r) => r.student.id === studentId);
    if (!row) return;
    const draft = getDraft(row);
    const trimmed = draft.points.trim();
    if (trimmed === "") {
      setSaveError("Escribe los puntos antes de guardar.");
      return;
    }
    const points = Number(trimmed);
    if (!Number.isFinite(points) || points < 0 || points > activity.maxPoints) {
      setSaveError(`Los puntos deben estar entre 0 y ${activity.maxPoints}.`);
      return;
    }
    setSaveError(null);
    setSavingId(studentId);
    try {
      await saveGrade(activity.id, studentId, { points });
      onSaved();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{activity.name}</h2>
        <p className="text-sm text-slate-400">
          {formatDate(activity.date)} · Valor máximo: {activity.maxPoints} pts
        </p>
        {saveError ? (
          <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {saveError}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando alumnos...</p>
      ) : rows.length === 0 ? (
        <p className="text-amber-200/90 text-sm">
          No hay alumnos en este grupo. Importa la lista en la pestaña Alumnos (Excel).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Control</th>
                <th className="px-4 py-3">Alumno</th>
                <th className="px-4 py-3">Entrega</th>
                <th className="px-4 py-3">Puntos obtenidos</th>
                <th className="px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = getDraft(row);
                return (
                  <tr key={row.student.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-cyan-300">
                      {row.student.controlNumber ?? row.student.listNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{row.student.displayName}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {row.submission ? (
                        <span className="text-cyan-300">
                          {formatDateTime(row.submission.submittedAt)}
                        </span>
                      ) : (
                        <span className="text-amber-400/90">Sin entregar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={activity.maxPoints}
                          value={draft.points}
                          placeholder="—"
                          onChange={(e) => {
                            setSaveError(null);
                            setDrafts((d) => ({
                              ...d,
                              [row.student.id]: { points: e.target.value },
                            }));
                          }}
                          className="w-20 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-white placeholder:text-slate-600"
                        />
                        <span className="text-xs text-slate-500">/ {activity.maxPoints}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSave(row.student.id)}
                        disabled={savingId === row.student.id || draft.points.trim() === ""}
                        className="rounded-lg bg-cyan-500/90 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                      >
                        {savingId === row.student.id ? "..." : "Guardar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
