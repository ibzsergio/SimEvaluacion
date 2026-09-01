import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchClassDaySheet, getApiErrorMessage, saveClassDayRecords } from "../lib/api";
import type { AttendanceStatus, ClassDayRow, ClassGroup } from "../lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; short: string }[] = [
  { value: "PRESENT", label: "Presente", short: "P" },
  { value: "LATE", label: "Tarde", short: "T" },
  { value: "ABSENT", label: "Falta", short: "A" },
  { value: "JUSTIFIED", label: "Justificada", short: "J" },
];

type LocalRow = ClassDayRow;

export default function ClassDayPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [localRows, setLocalRows] = useState<LocalRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useQuery({
    queryKey: ["class-day", selectedGroupId, date],
    queryFn: () => fetchClassDaySheet(selectedGroupId, date),
    enabled: !!selectedGroupId,
  });

  useEffect(() => {
    if (query.data?.rows) {
      setLocalRows(query.data.rows);
      setSuccess("");
      setError("");
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveClassDayRecords(
        selectedGroupId,
        date,
        localRows.map((r) => ({
          studentId: r.student.id,
          attendance: r.attendance,
          stars: r.stars,
        })),
      ),
    onSuccess: async (result) => {
      setSuccess(`Guardado: ${result.saved} alumnos registrados para ${date}.`);
      setError("");
      await qc.invalidateQueries({ queryKey: ["class-day", selectedGroupId, date] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const maxStars = query.data?.maxStars ?? 3;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return localRows;
    return localRows.filter(
      (r) =>
        r.student.displayName.toLowerCase().includes(q) ||
        (r.student.controlNumber ?? "").includes(q) ||
        String(r.student.listNumber ?? "").includes(q),
    );
  }, [localRows, search]);

  function updateRow(studentId: string, patch: Partial<Pick<LocalRow, "attendance" | "stars">>) {
    setLocalRows((rows) =>
      rows.map((r) => (r.student.id === studentId ? { ...r, ...patch, saved: false } : r)),
    );
    setSuccess("");
  }

  function markAllPresent() {
    setLocalRows((rows) =>
      rows.map((r) => ({ ...r, attendance: "PRESENT" as AttendanceStatus, saved: false })),
    );
  }

  if (!selectedGroupId) {
    return <p className="text-slate-400">Selecciona un grupo.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectGroup(g.id)}
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

      <section className="glass p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Asistencia y participación</h2>
            <p className="mt-1 text-sm text-slate-400">
              Las estrellas suman puntos en la escala del alumno (1 estrella = 1 punto de firmas).
            </p>
          </div>
          <label className="block text-xs text-slate-400">
            Fecha de clase
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar alumno..."
            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={markAllPresent}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100"
          >
            Marcar todos presentes
          </button>
          <button
            type="button"
            disabled={saveMutation.isPending || query.isLoading}
            onClick={() => saveMutation.mutate()}
            className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {saveMutation.isPending ? "Guardando..." : "Guardar día"}
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}

        {query.isLoading ? (
          <p className="mt-4 text-slate-400">Cargando lista...</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Alumno</th>
                  <th className="px-4 py-3">Asistencia</th>
                  <th className="px-4 py-3">Participación</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.student.id} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{row.student.displayName}</p>
                      <p className="text-xs text-slate-500">
                        {row.student.controlNumber ?? "—"} · Lista #{row.student.listNumber ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ATTENDANCE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.label}
                            onClick={() => updateRow(row.student.id, { attendance: opt.value })}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                              row.attendance === opt.value
                                ? opt.value === "PRESENT"
                                  ? "bg-emerald-500 text-slate-950"
                                  : opt.value === "ABSENT"
                                    ? "bg-rose-500 text-white"
                                    : opt.value === "LATE"
                                      ? "bg-amber-500 text-slate-950"
                                      : "bg-indigo-500 text-white"
                                : "border border-white/10 text-slate-400 hover:bg-white/5"
                            }`}
                          >
                            {opt.short}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => updateRow(row.student.id, { stars: star })}
                            className="text-xl leading-none transition hover:scale-110"
                            aria-label={`${star} estrella(s)`}
                          >
                            {row.stars >= star ? "⭐" : "☆"}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => updateRow(row.student.id, { stars: 0 })}
                          className="ml-2 text-xs text-slate-500 hover:text-slate-300"
                        >
                          0
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? (
              <p className="p-4 text-sm text-slate-500">Sin alumnos en este grupo.</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
