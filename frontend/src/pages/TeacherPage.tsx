import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import AccessQrPanel from "../components/AccessQrPanel";
import ClassDayPanel from "../components/ClassDayPanel";
import GradesMatrixPanel from "../components/GradesMatrixPanel";
import GroupDeliveryStatusPanel from "../components/GroupDeliveryStatusPanel";
import GroupGradesImportPanel from "../components/GroupGradesImportPanel";
import GroupRankingPanel from "../components/GroupRankingPanel";
import GroupStudentsPanel from "../components/GroupStudentsPanel";
import ColorReadingPanel from "../components/ColorReadingPanel";
import IcebreakerRoulettePanel from "../components/IcebreakerRoulettePanel";
import SeatingPanel from "../components/SeatingPanel";
import TeacherSkillSurveyPanel from "../components/TeacherSkillSurveyPanel";
import SemesterPanel from "../components/SemesterPanel";
import TeacherCommsPanel from "../components/TeacherCommsPanel";
import ClosePartialPanel from "../components/ClosePartialPanel";
import WeeklyWinnersPanel from "../components/WeeklyWinnersPanel";
import Layout from "../components/Layout";
import {
  createActivity,
  deleteActivity,
  downloadBothGroupsTotalsExcel,
  fetchActivities,
  fetchGroups,
  getApiErrorMessage,
  startNextPartial,
  updateActivity,
} from "../lib/api";
import { formatGroupCodesPlus, formatTeacherGroupsSubtitle } from "../lib/groups";
import {
  formatCalendarDate,
  formatDateTime,
  getActivityKindLabel,
  partialLabel,
  todayLocalIso,
  toDateInputValue,
} from "../lib/dates";
import type { Activity } from "../lib/types";

export default function TeacherPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<
    | "alumnos"
    | "actividades"
    | "entregas"
    | "importar"
    | "ranking"
    | "semanas"
    | "comunicacion"
    | "semestre"
    | "asistencia"
    | "asientos"
    | "equipos"
    | "rompehielo"
    | "lectura"
    | "acceso"
  >("alumnos");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: todayLocalIso(),
    name: "",
    maxPoints: 10,
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [collapsedPartials, setCollapsedPartials] = useState<Record<number, boolean>>({});
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [downloadingExcel, setDownloadingExcel] = useState(false);

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

  useEffect(() => {
    setSelectedId(null);
    setEditingActivityId(null);
    setCollapsedPartials({});
    if (selectedGroupId) {
      void qc.refetchQueries({ queryKey: ["activities", selectedGroupId] });
    }
  }, [selectedGroupId, qc]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const activitiesQuery = useQuery({
    queryKey: ["activities", selectedGroupId],
    queryFn: () => fetchActivities(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const activities = activitiesQuery.data ?? [];
  const currentPartial = selectedGroup?.currentPartial ?? 1;
  const activityPartialNumbers = useMemo(() => {
    const nums = new Set(activities.map((a) => a.partialNumber ?? 1));
    nums.add(currentPartial);
    return [...nums].sort((a, b) => a - b);
  }, [activities, currentPartial]);
  const currentActivities = activities.filter((a) => (a.partialNumber ?? 1) === currentPartial);
  const activeId = selectedId ?? currentActivities[0]?.id ?? null;

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: async (activity) => {
      setFormError("");
      setFormSuccess(`Actividad "${activity.name}" publicada en grupo ${selectedGroup?.code}.`);
      await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["grades-matrix", selectedGroupId] });
      setSelectedId(activity.id);
      resetActivityForm();
    },
    onError: (error) => {
      setFormSuccess("");
      setFormError(getApiErrorMessage(error));
    },
  });

  const startNextPartialMutation = useMutation({
    mutationFn: () => startNextPartial(selectedGroupId),
    onSuccess: async (group) => {
      setFormError("");
      setFormSuccess(
        `Ahora publicas ${partialLabel(group.currentPartial ?? currentPartial + 1).toLowerCase()}. El examen del parcial anterior se puede capturar después.`,
      );
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
    },
    onError: (error) => {
      setFormSuccess("");
      setFormError(getApiErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { activityId: string; date: string; name: string; maxPoints: number }) =>
      updateActivity(payload.activityId, {
        date: payload.date,
        name: payload.name,
        maxPoints: payload.maxPoints,
      }),
    onSuccess: async (activity) => {
      setFormError("");
      setFormSuccess(`Actividad "${activity.name}" actualizada.`);
      setEditingActivityId(null);
      resetActivityForm();
      await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["grades-matrix", selectedGroupId] });
      setSelectedId(activity.id);
    },
    onError: (error) => {
      setFormSuccess("");
      setFormError(getApiErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteActivity,
    onSuccess: async (_data, deletedId) => {
      setFormError("");
      setFormSuccess("Actividad eliminada.");
      if (editingActivityId === deletedId) {
        setEditingActivityId(null);
        resetActivityForm();
      }
      if (selectedId === deletedId) setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["grades-matrix", selectedGroupId] });
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error));
    },
  });

  function resetActivityForm() {
    setForm({ date: todayLocalIso(), name: "", maxPoints: 10 });
  }

  function startEditActivity(activity: Activity) {
    setEditingActivityId(activity.id);
    setFormError("");
    setFormSuccess("");
    setForm({
      date: toDateInputValue(activity.date),
      name: activity.name,
      maxPoints: activity.maxPoints,
    });
    setSelectedId(activity.id);
  }

  function cancelEditActivity() {
    setEditingActivityId(null);
    resetActivityForm();
    setFormError("");
  }

  function handleDeleteActivity(activity: Activity) {
    const ok = window.confirm(
      `¿Eliminar la actividad "${activity.name}"?\n\nSe borrarán también las calificaciones de todos los alumnos.`,
    );
    if (!ok) return;
    setFormSuccess("");
    deleteMutation.mutate(activity.id);
  }

  const activityFormPending = createMutation.isPending || updateMutation.isPending;

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === activeId) ?? null,
    [activities, activeId],
  );
  const matrixPartial = selectedActivity?.partialNumber ?? currentPartial;

  const groupsLabelPlus = formatGroupCodesPlus(groups);
  const groupsSubtitle = formatTeacherGroupsSubtitle(groups);

  return (
    <Layout
      title="Panel del docente"
      subtitle={groupsSubtitle}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "alumnos"} onClick={() => setTab("alumnos")}>
          Alumnos (Excel)
        </TabButton>
        <TabButton active={tab === "actividades"} onClick={() => setTab("actividades")}>
          Actividades y calificaciones
        </TabButton>
        <TabButton active={tab === "entregas"} onClick={() => setTab("entregas")}>
          Historial entregas
        </TabButton>
        <TabButton active={tab === "importar"} onClick={() => setTab("importar")}>
          Importar Excel
        </TabButton>
        <TabButton active={tab === "ranking"} onClick={() => setTab("ranking")}>
          Ranking del grupo
        </TabButton>
        <TabButton active={tab === "semanas"} onClick={() => setTab("semanas")}>
          Semanas y parcial
        </TabButton>
        <TabButton active={tab === "comunicacion"} onClick={() => setTab("comunicacion")}>
          Comunicación
        </TabButton>
        <TabButton active={tab === "semestre"} onClick={() => setTab("semestre")}>
          Nuevo semestre
        </TabButton>
        <TabButton active={tab === "asistencia"} onClick={() => setTab("asistencia")}>
          Asistencia
        </TabButton>
        <TabButton active={tab === "asientos"} onClick={() => setTab("asientos")}>
          Butacas
        </TabButton>
        <TabButton active={tab === "equipos"} onClick={() => setTab("equipos")}>
          Roles / Equipos
        </TabButton>
        <TabButton active={tab === "rompehielo"} onClick={() => setTab("rompehielo")}>
          Ruleta rompehielo
        </TabButton>
        <TabButton active={tab === "lectura"} onClick={() => setTab("lectura")}>
          Lectura por colores
        </TabButton>
        <TabButton active={tab === "acceso"} onClick={() => setTab("acceso")}>
          QR / Acceso
        </TabButton>
        </div>
        <button
          type="button"
          disabled={downloadingExcel}
          onClick={async () => {
            setDownloadingExcel(true);
            try {
              await downloadBothGroupsTotalsExcel(groups);
            } catch (err) {
              window.alert(getApiErrorMessage(err));
            } finally {
              setDownloadingExcel(false);
            }
          }}
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
        >
          {downloadingExcel ? "Generando Excel..." : `Descargar Excel ${groupsLabelPlus}`}
        </button>
      </div>

      {tab === "importar" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <GroupGradesImportPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "comunicacion" ? (
        <TeacherCommsPanel />
      ) : tab === "semestre" ? (
        <SemesterPanel />
      ) : tab === "asistencia" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <ClassDayPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "asientos" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <SeatingPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "equipos" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <TeacherSkillSurveyPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "rompehielo" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <IcebreakerRoulettePanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "lectura" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <ColorReadingPanel
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => setSelectedGroupId(id)}
          />
        ) : null
      ) : tab === "acceso" ? (
        <AccessQrPanel />
      ) : tab === "semanas" ? (
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
      ) : tab === "entregas" ? (
        groupsQuery.isLoading ? (
          <p className="text-slate-400">Cargando grupos...</p>
        ) : selectedGroupId ? (
          <GroupDeliveryStatusPanel
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
                <span className="ml-1 font-normal opacity-80">
                  (
                  {g.id === selectedGroupId
                    ? currentActivities.length
                    : (g.activityCount ?? 0)}{" "}
                  act.)
                </span>
              </button>
            ))}
          </div>

          {selectedGroupId ? (
            <ClosePartialPanel groups={groups} selectedGroupId={selectedGroupId} />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <section className="glass p-5">
              <h2 className="mb-1 text-lg font-semibold text-white">
                {editingActivityId ? "Editar actividad" : "Nueva actividad"}
              </h2>
              <p className="mb-3 text-xs text-cyan-300/90">
                Grupo {selectedGroup?.code} · {selectedGroup?.shift} · {partialLabel(currentPartial)}
              </p>
              {currentPartial < 4 && !editingActivityId ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = currentPartial + 1;
                    const ok = window.confirm(
                      `¿Comenzar ${partialLabel(next).toLowerCase()}?\n\nLas actividades de ${partialLabel(currentPartial).toLowerCase()} se compactan (no se borran). Las nuevas se publican ya como ${partialLabel(next).toLowerCase()}.\n\nNo hace falta capturar el examen ni cerrar el parcial.`,
                    );
                    if (!ok) return;
                    setFormError("");
                    startNextPartialMutation.mutate();
                  }}
                  disabled={startNextPartialMutation.isPending || !selectedGroupId}
                  className="mb-4 w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  {startNextPartialMutation.isPending
                    ? "Cambiando..."
                    : `Comenzar ${partialLabel(currentPartial + 1).toLowerCase()} sin examen`}
                </button>
              ) : null}
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
                  const payload = {
                    date: form.date,
                    name: form.name.trim(),
                    maxPoints: form.maxPoints,
                  };
                  if (editingActivityId) {
                    updateMutation.mutate({ activityId: editingActivityId, ...payload });
                  } else {
                    createMutation.mutate({ groupId: selectedGroupId, ...payload });
                  }
                }}
              >
                <label className="block text-xs text-slate-400">
                  Fecha de la actividad
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
                    required
                  />
                </label>
                <p className="text-xs text-slate-500">
                  La fecha de publicación se registra al guardar la actividad.
                </p>
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
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={activityFormPending}
                    className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                  >
                    {activityFormPending
                      ? "Guardando..."
                      : editingActivityId
                        ? "Guardar cambios"
                        : "Publicar actividad"}
                  </button>
                  {editingActivityId ? (
                    <button
                      type="button"
                      onClick={cancelEditActivity}
                      disabled={activityFormPending}
                      className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Actividades del grupo</h3>
                <div className="max-h-[70vh] min-h-[28rem] space-y-4 overflow-auto pr-1">
                  {activityPartialNumbers.map((partialNo, sectionIndex) => {
                    const items = activities.filter((a) => (a.partialNumber ?? 1) === partialNo);
                    const isCurrent = partialNo === currentPartial;
                    const collapsed = !isCurrent && collapsedPartials[partialNo] !== false;
                    const showCut = sectionIndex > 0;
                    return (
                      <div key={partialNo}>
                        {showCut ? (
                          <div className="mb-3 flex items-center gap-2 py-1">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
                            <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
                              Corte de parcial
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
                          </div>
                        ) : null}
                        <div
                          className={`rounded-xl border px-2 py-2 ${
                            isCurrent
                              ? "border-indigo-400/30 bg-indigo-500/5"
                              : "border-white/10 bg-slate-950/40"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (isCurrent) return;
                              setCollapsedPartials((prev) => ({
                                ...prev,
                                [partialNo]: prev[partialNo] === false ? true : false,
                              }));
                            }}
                            className="mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1 text-left"
                          >
                            <span
                              className={`text-xs font-bold uppercase tracking-wide ${
                                isCurrent ? "text-indigo-200" : "text-slate-400"
                              }`}
                            >
                              {partialLabel(partialNo)}
                              <span className="ml-2 font-normal opacity-80">
                                ({items.length} {items.length === 1 ? "actividad" : "actividades"})
                              </span>
                            </span>
                            {!isCurrent ? (
                              <span className="text-[11px] text-slate-500">
                                {collapsed ? "Mostrar" : "Ocultar"}
                              </span>
                            ) : (
                              <span className="text-[11px] text-indigo-300/80">Actual</span>
                            )}
                          </button>
                          {collapsed ? (
                            <p className="px-2 pb-1 text-[11px] text-slate-500">
                              Compactado para aclaraciones. No se borra.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {items.map((a, index) => (
                                <ActivityListItem
                                  key={a.id}
                                  activity={a}
                                  index={index}
                                  active={a.id === activeId}
                                  pendingDelete={deleteMutation.isPending}
                                  onSelect={() => setSelectedId(a.id)}
                                  onEdit={() => startEditActivity(a)}
                                  onDelete={() => handleDeleteActivity(a)}
                                />
                              ))}
                              {!items.length ? (
                                <p className="px-2 pb-1 text-xs text-slate-500">
                                  Aún no hay actividades en este parcial.
                                </p>
                              ) : null}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!activities.length && !activitiesQuery.isLoading && currentPartial <= 1 ? (
                    <p className="text-xs text-slate-500">Sin actividades en este grupo.</p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="glass min-w-0 p-5">
              {selectedGroupId ? (
                <GradesMatrixPanel
                  groupId={selectedGroupId}
                  partialNumber={matrixPartial}
                  highlightActivityId={activeId}
                />
              ) : (
                <p className="text-slate-400">Selecciona un grupo.</p>
              )}
            </section>
          </div>
        </>
      )}
    </Layout>
  );
}

function ActivityListItem({
  activity,
  index,
  active,
  pendingDelete,
  onSelect,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  index: number;
  active: boolean;
  pendingDelete: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`rounded-xl border text-sm transition ${
        active ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-start gap-1 p-1">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-400/90">
            {getActivityKindLabel(index, activity.name)}
          </p>
          <p className={`font-medium ${active ? "text-cyan-100" : "text-slate-200"}`}>{activity.name}</p>
          <p className="text-xs text-slate-400">
            {formatCalendarDate(activity.date)} · {activity.maxPoints} pts
            {activity.createdAt ? (
              <span className="text-slate-500"> · Publicada {formatDateTime(activity.createdAt)}</span>
            ) : null}
          </p>
        </button>
        <div className="flex shrink-0 flex-col gap-1 pt-1">
          <button
            type="button"
            title="Editar"
            onClick={onEdit}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Editar
          </button>
          <button
            type="button"
            title="Eliminar"
            onClick={onDelete}
            disabled={pendingDelete}
            className="rounded-lg border border-rose-400/30 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/15 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </li>
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
