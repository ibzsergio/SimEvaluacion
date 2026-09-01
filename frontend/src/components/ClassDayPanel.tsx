import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  downloadDayAttendanceExcel,
  downloadDayAttendancePdf,
  downloadMasterAttendanceExcel,
  downloadWeekAttendanceExcel,
  downloadWeekAttendancePdf,
  fetchClassDaySheet,
  getApiErrorMessage,
  saveClassDayRecords,
} from "../lib/api";
import { todayLocalIso } from "../lib/dates";
import type { AttendanceStatus, ClassDayRow, ClassGroup } from "../lib/types";

function getSchoolWeekLabel(anchorIso: string) {
  const d = new Date(`${anchorIso}T12:00:00.000Z`);
  const utcDay = d.getUTCDay();
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const fmt = (x: Date) =>
    x.toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${fmt(monday)} — ${fmt(friday)}`;
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
  const [date, setDate] = useState(todayLocalIso());
  const [search, setSearch] = useState("");
  const [localRows, setLocalRows] = useState<LocalRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const weekLabel = getSchoolWeekLabel(date);

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
      setSuccess(
        `Guardado: ${result.saved} alumnos registrados para ${date}. Descarga el Excel oficial cuando lo necesites.`,
      );
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

  const missedToday = useMemo(
    () => localRows.filter((r) => r.attendance === "ABSENT" || r.attendance === "LATE"),
    [localRows],
  );

  /** Número consecutivo en lista alfabética (1, 2, 3…). */
  const listPositionById = useMemo(() => {
    const map = new Map<string, number>();
    localRows.forEach((r, i) => map.set(r.student.id, i + 1));
    return map;
  }, [localRows]);

  function toggleStars(current: number, star: number) {
    return current === star ? star - 1 : star;
  }

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

  async function handleDownload(kind: "day-xlsx" | "day-pdf" | "week-xlsx" | "week-pdf") {
    if (!selectedGroup) return;
    setDownloading(kind);
    setError("");
    try {
      if (kind === "day-xlsx") {
        await downloadDayAttendanceExcel(selectedGroupId, selectedGroup.code, date);
      } else if (kind === "day-pdf") {
        await downloadDayAttendancePdf(selectedGroupId, selectedGroup.code, date);
      } else if (kind === "week-xlsx") {
        await downloadWeekAttendanceExcel(selectedGroupId, selectedGroup.code, date);
      } else {
        await downloadWeekAttendancePdf(selectedGroupId, selectedGroup.code, date);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDownloading(null);
    }
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
              Las estrellas suman 1 punto c/u en el ranking (máx. 3 por día). Toca una estrella para
              asignar; vuelve a tocar la misma para bajar o quitar todas.
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

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <p className="text-sm font-semibold text-white">Exportar reportes</p>
            <p className="mt-1 text-xs text-slate-400">
              Descarga el Excel oficial con todas las fechas y horas desde la app. Si marcas
              justificada (J), ese día queda sin horas en el Excel. Semana escolar:{" "}
              <span className="text-slate-300">{weekLabel}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloading !== null}
              onClick={async () => {
                setDownloading("master");
                try {
                  await downloadMasterAttendanceExcel();
                } finally {
                  setDownloading(null);
                }
              }}
              className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-60"
            >
              {downloading === "master" ? "..." : "Descargar LISTAS (oficial)"}
            </button>
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => handleDownload("day-xlsx")}
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-60"
            >
              {downloading === "day-xlsx" ? "..." : "Excel del día"}
            </button>
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => handleDownload("day-pdf")}
              className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-60"
            >
              {downloading === "day-pdf" ? "..." : "PDF del día"}
            </button>
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => handleDownload("week-xlsx")}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-60"
            >
              {downloading === "week-xlsx" ? "..." : "Excel semanal + gráficos"}
            </button>
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => handleDownload("week-pdf")}
              className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-60"
            >
              {downloading === "week-pdf" ? "..." : "PDF semanal + gráficos"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Los reportes marcan con alerta a quienes no asistieron o llegaron tarde.
          </p>
        </div>

        {missedToday.length > 0 ? (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <p className="font-semibold">⚠ {missedToday.length} alumno(s) sin asistir o con tardanza hoy</p>
            <p className="mt-1 text-xs text-rose-200/90">
              {missedToday.map((r) => r.student.displayName).join(" · ")}
            </p>
          </div>
        ) : null}

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
                {filteredRows.map((row) => {
                  const missed = row.attendance === "ABSENT" || row.attendance === "LATE";
                  return (
                    <tr
                      key={row.student.id}
                      className={`border-t border-white/5 ${
                        row.attendance === "ABSENT"
                          ? "bg-rose-500/10"
                          : row.attendance === "LATE"
                            ? "bg-amber-500/10"
                            : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className={`font-medium ${missed ? "text-rose-200" : "text-white"}`}>
                          {missed ? "⚠ " : ""}
                          {row.student.displayName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.student.controlNumber ?? "—"} · Lista #
                          {listPositionById.get(row.student.id) ?? "—"}
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
                        <div className="flex flex-wrap items-center gap-1">
                          {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                updateRow(row.student.id, { stars: toggleStars(row.stars, star) })
                              }
                              className="text-xl leading-none transition hover:scale-110"
                              aria-label={
                                row.stars >= star
                                  ? `${star} estrella(s) — tocar para bajar`
                                  : `Asignar ${star} estrella(s)`
                              }
                            >
                              {row.stars >= star ? "⭐" : "☆"}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => updateRow(row.student.id, { stars: 0 })}
                            className={`ml-2 rounded-lg border px-2 py-0.5 text-xs font-semibold ${
                              row.stars === 0
                                ? "border-slate-600 text-slate-500"
                                : "border-white/15 text-slate-400 hover:border-rose-400/40 hover:text-rose-200"
                            }`}
                            title="Quitar todas las estrellas"
                          >
                            Sin estrellas
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
