import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchGradesMatrix, getApiErrorMessage, saveGradesBatch } from "../lib/api";
import { formatCalendarDate, getActivityKindLabel, partialLabel } from "../lib/dates";
import type { Activity } from "../lib/types";

function cellKey(studentId: string, activityId: string) {
  return `${studentId}::${activityId}`;
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

  function savedPoints(studentId: string, activityId: string) {
    const grade = cells[studentId]?.[activityId];
    return grade ? String(grade.points) : "";
  }

  function displayPoints(studentId: string, activityId: string) {
    const key = cellKey(studentId, activityId);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) return drafts[key] ?? "";
    return savedPoints(studentId, activityId);
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Calificar {partialLabel(partialNumber).toLowerCase()}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Una fila por alumno y una columna por actividad. Escribe y pasa a la siguiente con Tab;
            al salir de la casilla se guarda. Ya no hace falta cambiar de actividad.
          </p>
        </div>
        {activities.length > 0 && students.length > 0 ? (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={busy || dirtyCount === 0}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-50"
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
        className="mb-4 w-full max-w-md rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
      />

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
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/90 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="sticky left-0 z-20 min-w-[180px] bg-slate-900 px-3 py-3">Alumno</th>
                {activities.map((activity, index) => (
                  <th
                    key={activity.id}
                    className={`min-w-[108px] px-2 py-3 ${
                      activity.id === highlightActivityId ? "bg-cyan-500/15 text-cyan-100" : ""
                    }`}
                  >
                    <p className="font-bold normal-case tracking-normal text-cyan-300">
                      {getActivityKindLabel(index, activity.name)}
                    </p>
                    <p className="mt-0.5 max-w-[140px] truncate font-normal normal-case tracking-normal text-slate-300">
                      {activity.name}
                    </p>
                    <p className="mt-0.5 font-normal normal-case tracking-normal text-[10px] text-slate-500">
                      / {activity.maxPoints} · {formatCalendarDate(activity.date)}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="border-t border-white/5">
                  <td className="sticky left-0 z-10 bg-slate-950/95 px-3 py-2">
                    <p className="font-medium text-white">{student.displayName}</p>
                    <p className="font-mono text-[11px] text-cyan-300/80">
                      {student.controlNumber ?? "—"}
                    </p>
                  </td>
                  {activities.map((activity) => {
                    const key = cellKey(student.id, activity.id);
                    const value = displayPoints(student.id, activity.id);
                    const saved = cells[student.id]?.[activity.id];
                    const highlighted = activity.id === highlightActivityId;
                    return (
                      <td
                        key={activity.id}
                        className={`px-2 py-2 ${highlighted ? "bg-cyan-500/5" : ""}`}
                      >
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
                          className={`w-20 rounded-lg border bg-slate-900/60 px-2 py-1 text-white placeholder:text-slate-600 ${
                            saved
                              ? "border-emerald-400/30"
                              : "border-white/10"
                          }`}
                          title={saved ? `Guardado ${saved.points} / ${activity.maxPoints}` : "Sin calificar"}
                        />
                        {savingKey === key ? (
                          <span className="ml-1 text-[10px] text-slate-500">...</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
