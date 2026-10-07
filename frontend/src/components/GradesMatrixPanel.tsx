import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGradesMatrix, getApiErrorMessage, saveGradesBatch } from "../lib/api";
import { formatCalendarDate, getActivityKindLabel, partialLabel } from "../lib/dates";
import type { Activity } from "../lib/types";

function cellKey(studentId: string, activityId: string) {
  return `${studentId}::${activityId}`;
}

function ActivityHeaderCells({
  activities,
  selectedStudentId,
  highlightActivityId,
  hasActivityGrade,
}: {
  activities: Activity[];
  selectedStudentId: string | null;
  highlightActivityId: string | null;
  hasActivityGrade: (studentId: string, activityId: string) => boolean;
}) {
  return (
    <>
      <th className="sticky left-0 z-30 min-w-[9.5rem] border-b border-white/10 bg-slate-900 px-2 py-2 sm:min-w-[12.5rem] sm:px-3 sm:py-3 lg:static lg:min-w-[16rem] lg:w-[16rem]">
        Alumno
      </th>
      {activities.map((activity, index) => {
        const owed =
          Boolean(selectedStudentId) && !hasActivityGrade(selectedStudentId!, activity.id);
        const highlighted = activity.id === highlightActivityId && !owed;
        return (
          <th
            key={activity.id}
            className={`min-w-[5.75rem] border-b border-white/10 bg-slate-900 px-1.5 py-2 align-bottom sm:min-w-[8rem] sm:px-2 sm:py-3 lg:min-w-[9.5rem] lg:w-[9.5rem] ${
              owed
                ? "text-rose-100 shadow-[inset_0_0_0_1000px_rgba(244,63,94,0.22)]"
                : highlighted
                  ? "text-cyan-100 shadow-[inset_0_0_0_1000px_rgba(34,211,238,0.12)]"
                  : ""
            }`}
            title={
              owed
                ? `${activity.name} — este alumno aún no tiene calificación`
                : activity.name
            }
          >
            <p
              className={`font-bold normal-case tracking-normal lg:text-base ${
                owed ? "text-rose-300" : "text-cyan-300"
              }`}
            >
              {getActivityKindLabel(index, activity.name)}
            </p>
            <p
              className={`mt-0.5 max-w-[9.5rem] font-normal normal-case leading-snug tracking-normal line-clamp-2 lg:max-w-[11rem] lg:text-sm ${
                owed ? "text-rose-100" : "text-slate-300"
              }`}
            >
              {activity.name}
            </p>
            <p
              className={`mt-0.5 font-normal normal-case tracking-normal text-[10px] lg:text-xs ${
                owed ? "font-semibold text-rose-300" : "text-slate-500"
              }`}
            >
              {owed ? "Pendiente · " : ""}/ {activity.maxPoints}
              <span className="hidden sm:inline"> · {formatCalendarDate(activity.date)}</span>
            </p>
          </th>
        );
      })}
    </>
  );
}

export default function GradesMatrixPanel({
  groupId,
  partialNumber,
  highlightActivityId,
}: {
  groupId: string;
  partialNumber: number;
  highlightActivityId: string | null;
}) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["grades-matrix", groupId, partialNumber],
    queryFn: () => fetchGradesMatrix(groupId, partialNumber),
    enabled: !!groupId,
  });

  useEffect(() => {
    setDrafts({});
    setSearch("");
    setError("");
    setSuccess("");
    setSelectedStudentId(null);
  }, [groupId, partialNumber]);

  const activities = query.data?.activities ?? [];
  const students = query.data?.students ?? [];
  const cells = query.data?.cells ?? {};

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        (s.controlNumber ?? "").includes(q) ||
        String(s.listNumber ?? "").includes(q),
    );
  }, [students, search]);

  useEffect(() => {
    if (filteredStudents.length === 1) {
      setSelectedStudentId(filteredStudents[0]!.id);
    }
  }, [filteredStudents]);

  function savedPoints(studentId: string, activityId: string) {
    const grade = cells[studentId]?.[activityId];
    return grade ? String(grade.points) : "";
  }

  function displayPoints(studentId: string, activityId: string) {
    const key = cellKey(studentId, activityId);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) return drafts[key] ?? "";
    return savedPoints(studentId, activityId);
  }

  function hasActivityGrade(studentId: string, activityId: string) {
    return displayPoints(studentId, activityId).trim() !== "";
  }

  function studentProgress(studentId: string) {
    const total = activities.length;
    const done = activities.filter((a) => hasActivityGrade(studentId, a.id)).length;
    return { done, total, complete: total > 0 && done === total };
  }

  function collectDirty(): Array<{ activityId: string; studentId: string; points: number }> | null {
    const toSave: Array<{ activityId: string; studentId: string; points: number }> = [];
    for (const [key, raw] of Object.entries(drafts)) {
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const sep = key.indexOf("::");
      if (sep < 0) continue;
      const studentId = key.slice(0, sep);
      const activityId = key.slice(sep + 2);
      const activity = activities.find((a) => a.id === activityId);
      if (!activity) continue;
      const points = Number(trimmed);
      if (!Number.isFinite(points) || points < 0 || points > activity.maxPoints) {
        const student = students.find((s) => s.id === studentId);
        setError(
          `Puntos inválidos para ${student?.displayName ?? "alumno"} en ${activity.name}: 0 a ${activity.maxPoints}.`,
        );
        return null;
      }
      if (savedPoints(studentId, activityId) === String(Math.round(points))) continue;
      toSave.push({ activityId, studentId, points: Math.round(points) });
    }
    return toSave;
  }

  const saveMutation = useMutation({
    mutationFn: (grades: Array<{ activityId: string; studentId: string; points: number }>) =>
      saveGradesBatch(groupId, grades),
    onSuccess: async (result, variables) => {
      setError("");
      setSuccess(
        result.saved === 1 ? "Calificación guardada." : `Guardadas ${result.saved} calificaciones.`,
      );
      setDrafts((prev) => {
        const next = { ...prev };
        for (const g of variables) delete next[cellKey(g.studentId, g.activityId)];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["grades-matrix", groupId, partialNumber] });
      await qc.invalidateQueries({ queryKey: ["group-ranking", groupId] });
      await qc.invalidateQueries({ queryKey: ["delivery-status", groupId] });
      await qc.invalidateQueries({ queryKey: ["listas-f1-preview", groupId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
    onSettled: () => setSavingKey(null),
  });

  async function saveCell(studentId: string, activity: Activity, rawValue?: string) {
    const key = cellKey(studentId, activity.id);
    const raw = (rawValue ?? drafts[key] ?? savedPoints(studentId, activity.id)).trim();
    if (raw === "") return;
    const points = Number(raw);
    if (!Number.isFinite(points) || points < 0 || points > activity.maxPoints) {
      setError(`Los puntos de ${activity.name} deben estar entre 0 y ${activity.maxPoints}.`);
      return;
    }
    const rounded = Math.round(points);
    if (savedPoints(studentId, activity.id) === String(rounded)) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setError("");
    setSuccess("");
    setSavingKey(key);
    saveMutation.mutate([{ activityId: activity.id, studentId, points: rounded }]);
  }

  function handleSaveAll() {
    const toSave = collectDirty();
    if (toSave === null) return;
    if (toSave.length === 0) {
      setError("No hay cambios por guardar.");
      return;
    }
    setError("");
    setSuccess("");
    setSavingKey("all");
    saveMutation.mutate(toSave);
  }

  const dirtyCount = Object.entries(drafts).filter(([, v]) => v.trim() !== "").length;

  function syncHeaderScroll(from: "header" | "body") {
    const header = headerScrollRef.current;
    const body = tableScrollRef.current;
    if (!header || !body) return;
    if (from === "body") header.scrollLeft = body.scrollLeft;
    else body.scrollLeft = header.scrollLeft;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white lg:text-xl">Calificar {partialLabel(partialNumber).toLowerCase()}</h2>
          <p className="mt-1 hidden text-sm text-slate-400 sm:block lg:text-base">
            Una fila por alumno y una columna por actividad. Escribe y pasa a la siguiente con Tab;
            al salir de la casilla se guarda. Ya no hace falta cambiar de actividad.
          </p>
        </div>
        {activities.length > 0 && students.length > 0 ? (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saveMutation.isPending || dirtyCount === 0}
            className="min-h-11 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-50 sm:w-auto"
          >
            {savingKey === "all" ? "Guardando..." : `Guardar cambios (${dirtyCount})`}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar alumno..."
        className="mb-2 w-full max-w-md rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2.5 text-base text-white placeholder:text-slate-500 sm:text-sm lg:text-base"
      />
      <p className="mb-3 text-xs text-slate-500 sm:mb-4">
        Junto al nombre ves cuántas lleva. Toca un alumno para marcar en rojo las que le faltan. Al bajar
        la lista, el nombre de cada actividad se queda fijo arriba.
      </p>

      {query.isLoading ? (
        <p className="text-slate-400">Cargando tabla de calificaciones...</p>
      ) : activities.length === 0 ? (
        <p className="text-slate-400">
          Publica una o más actividades a la izquierda para calificarlas juntas aquí.
        </p>
      ) : students.length === 0 ? (
        <p className="text-sm text-amber-200/90">
          No hay alumnos en este grupo. Importa la lista en la pestaña Alumnos (Excel).
        </p>
      ) : (
        <div className="relative flex max-h-[min(70dvh,36rem)] min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 sm:max-h-[min(80dvh,52rem)] lg:h-[calc(100dvh-5rem)] lg:max-h-[calc(100dvh-5rem)] lg:min-h-[calc(100dvh-5rem)]">
          <div
            ref={headerScrollRef}
            className="hidden shrink-0 overflow-x-auto overflow-y-hidden bg-slate-900 lg:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={() => syncHeaderScroll("header")}
          >
            <table className="min-w-full table-fixed border-separate border-spacing-0 text-left text-sm uppercase tracking-wide text-slate-400 lg:text-base">
              <thead>
                <tr>
                  <ActivityHeaderCells
                    activities={activities}
                    selectedStudentId={selectedStudentId}
                    highlightActivityId={highlightActivityId}
                    hasActivityGrade={hasActivityGrade}
                  />
                </tr>
              </thead>
            </table>
          </div>
          <div
            ref={tableScrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain"
            onScroll={() => syncHeaderScroll("body")}
          >
          <table className="min-w-full border-separate border-spacing-0 text-sm lg:table-fixed lg:text-base">
            <thead className="sticky top-0 z-20 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400 lg:hidden">
              <tr>
                <ActivityHeaderCells
                  activities={activities}
                  selectedStudentId={selectedStudentId}
                  highlightActivityId={highlightActivityId}
                  hasActivityGrade={hasActivityGrade}
                />
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const progress = studentProgress(student.id);
                const selected = student.id === selectedStudentId;
                return (
                <tr
                  key={student.id}
                  className={`border-t border-white/5 ${selected ? "bg-white/[0.04]" : ""}`}
                >
                  <td className="sticky left-0 z-10 max-w-[9.5rem] bg-slate-950 px-2 py-2 sm:max-w-none sm:px-3 lg:min-w-[16rem] lg:w-[16rem] lg:py-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudentId((prev) => (prev === student.id ? null : student.id))
                      }
                      className="w-full rounded-lg px-1 py-0.5 text-left hover:bg-white/5"
                      title="Ver qué actividades le faltan"
                    >
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-medium text-white lg:text-lg">
                        <span className="line-clamp-2 break-words sm:line-clamp-none lg:line-clamp-1">{student.displayName}</span>
                        <span
                          className={`tabular-nums text-xs font-bold lg:text-sm ${
                            progress.complete ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {progress.done}/{progress.total}
                        </span>
                      </p>
                      <p className="font-mono text-[11px] text-cyan-300/80 lg:text-sm">
                        {student.controlNumber ?? "—"}
                      </p>
                    </button>
                  </td>
                  {activities.map((activity, index) => {
                    const key = cellKey(student.id, activity.id);
                    const value = displayPoints(student.id, activity.id);
                    const saved = cells[student.id]?.[activity.id];
                    const missing = !hasActivityGrade(student.id, activity.id);
                    const highlighted = activity.id === highlightActivityId;
                    const markOwed = selected && missing;
                    const kindLabel = getActivityKindLabel(index, activity.name);
                    return (
                      <td
                        key={activity.id}
                        className={`px-2 py-2 lg:min-w-[9.5rem] lg:w-[9.5rem] lg:py-1 ${
                          markOwed
                            ? "bg-rose-500/10"
                            : highlighted
                              ? "bg-cyan-500/5"
                              : ""
                        }`}
                      >
                        <p
                          className={`mb-0.5 max-w-[5.5rem] truncate text-[10px] font-semibold leading-none sm:max-w-[6.5rem] lg:hidden ${
                            markOwed ? "text-rose-400" : "text-cyan-400/90"
                          }`}
                          title={activity.name}
                        >
                          {kindLabel}
                        </p>
                        <input
                          type="number"
                          min={0}
                          max={activity.maxPoints}
                          value={value}
                          placeholder="—"
                          onChange={(e) => {
                            setError("");
                            setSuccess("");
                            setDrafts((prev) => ({ ...prev, [key]: e.target.value }));
                          }}
                          onBlur={(e) => {
                            if (!(key in drafts) && e.target.value === savedPoints(student.id, activity.id)) {
                              return;
                            }
                            void saveCell(student.id, activity, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                      className={`h-10 w-[3.75rem] min-w-[3.75rem] rounded-lg border bg-slate-900/80 px-1.5 text-base text-white placeholder:text-slate-600 sm:w-20 sm:px-2 lg:h-10 lg:w-[5.75rem] lg:min-w-[5.75rem] lg:px-2.5 lg:text-lg ${
                            saved
                              ? "border-emerald-400/30"
                              : markOwed
                                ? "border-rose-400/50"
                                : "border-white/10"
                          }`}
                          title={
                            saved
                              ? `${kindLabel} · ${activity.name} — ${saved.points} / ${activity.maxPoints}`
                              : `${kindLabel} · ${activity.name} — sin calificar`
                          }
                          aria-label={`${student.displayName} · ${kindLabel} · ${activity.name}`}
                        />
                        {savingKey === key ? (
                          <span className="ml-1 text-[10px] text-slate-500">...</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
