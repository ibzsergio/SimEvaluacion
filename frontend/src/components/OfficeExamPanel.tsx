import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  downloadOfficeExamGradesExcel,
  downloadOfficeExamGradesExcelBoth,
  fetchOfficeExamTeacher,
  getApiErrorMessage,
  recalculateOfficeExamGrades,
  updateOfficeExamSettings,
} from "../lib/api";
import type { ClassGroup } from "../lib/types";

function statusLabel(status: string) {
  if (status === "SUBMITTED") return "Terminado";
  if (status === "IN_PROGRESS") return "En progreso";
  return "Sin iniciar";
}

export default function OfficeExamPanel({ groups }: { groups: ClassGroup[] }) {
  const qc = useQueryClient();
  const [downloadingGroupId, setDownloadingGroupId] = useState<string | null>(null);
  const [downloadingBoth, setDownloadingBoth] = useState(false);

  const query = useQuery({
    queryKey: ["office-exam-teacher"],
    queryFn: fetchOfficeExamTeacher,
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateOfficeExamSettings(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["office-exam-teacher"] }),
  });

  const recalcMutation = useMutation({
    mutationFn: recalculateOfficeExamGrades,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["office-exam-teacher"] });
      window.alert(`Calificaciones actualizadas: ${result.updated} de ${result.total} exámenes terminados.`);
    },
    onError: (err) => window.alert(getApiErrorMessage(err)),
  });

  const sortedRows = useMemo(() => {
    if (!query.data?.rows) return [];
    return [...query.data.rows].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" }),
    );
  }, [query.data?.rows]);

  const data = query.data;
  if (query.isLoading) return <p className="text-slate-400">Cargando examen Office...</p>;
  if (!data) return <p className="text-rose-300">No se pudo cargar el examen.</p>;

  const { exam, summary } = data;

  return (
    <div className="space-y-6">
      <section className="glass p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{exam.title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {exam.questionCount} preguntas · {summary.wordCount} Word · {summary.powerpointCount}{" "}
              PowerPoint · {summary.excelCount} Excel
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Las calificaciones usan el ranking actual (Top 10 = exentado). Si cambian los puntos,
              pulsa «Recalcular calificaciones».
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={recalcMutation.isPending}
              onClick={() => recalcMutation.mutate()}
              className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-5 py-2.5 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
            >
              {recalcMutation.isPending ? "Recalculando..." : "Recalcular calificaciones"}
            </button>
            <button
              type="button"
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate(!exam.enabledForStudents)}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-60 ${
                exam.enabledForStudents
                  ? "border border-amber-400/40 bg-amber-500/15 text-amber-100"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              }`}
            >
              {toggleMutation.isPending
                ? "Guardando..."
                : exam.enabledForStudents
                  ? "Deshabilitar para alumnos"
                  : "Habilitar examen para alumnos"}
            </button>
          </div>
        </div>

        {exam.enabledForStudents ? (
          <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Examen habilitado — los alumnos ya pueden verlo e iniciarlo.
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-indigo-400/25 bg-indigo-500/5 px-3 py-2 text-xs text-slate-400">
            El examen está oculto para los alumnos. Revisa las preguntas abajo antes de habilitarlo.
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Alumnos" value={summary.totalStudents} />
          <Stat label="Terminaron" value={summary.submitted} color="text-emerald-300" />
          <Stat label="En progreso" value={summary.inProgress} color="text-amber-300" />
          <Stat label="Sin iniciar" value={summary.notStarted} color="text-slate-400" />
        </div>
      </section>

      <section className="glass p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Descargar calificaciones (Excel)</h3>
            <p className="mt-1 text-xs text-slate-500">
              Alumno · Escala (0-6) · Calificación examen (0-4) · Calificación total (0-10), orden alfabético.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={downloadingGroupId === g.id}
                onClick={async () => {
                  setDownloadingGroupId(g.id);
                  try {
                    await downloadOfficeExamGradesExcel(g.id, g.code);
                  } catch (err) {
                    window.alert(getApiErrorMessage(err));
                  } finally {
                    setDownloadingGroupId(null);
                  }
                }}
                className="rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-60"
              >
                {downloadingGroupId === g.id ? "Generando..." : `Excel Grupo ${g.code}`}
              </button>
            ))}
            <button
              type="button"
              disabled={downloadingBoth}
              onClick={async () => {
                setDownloadingBoth(true);
                try {
                  await downloadOfficeExamGradesExcelBoth();
                } catch (err) {
                  window.alert(getApiErrorMessage(err));
                } finally {
                  setDownloadingBoth(false);
                }
              }}
              className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
            >
              {downloadingBoth ? "Generando..." : "Excel 201 + 202"}
            </button>
          </div>
        </div>
      </section>

      <section className="glass p-6">
        <h3 className="text-base font-semibold text-white">Panorama general — Calificación materia</h3>
        <p className="mt-1 text-xs text-slate-500">
          Escala (6 pts) = (puntos alumno ÷ puntos del #11) × 6 · Examen (4 pts) = aciertos/75 × 4 ·
          EXENTADOS: 10 fijo
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Alumno</th>
                <th className="px-3 py-2 text-center">#</th>
                <th className="px-3 py-2 text-center">Escala</th>
                <th className="px-3 py-2 text-center">Examen</th>
                <th className="px-3 py-2 text-center">Total</th>
                <th className="px-3 py-2">Estado examen</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.studentId} className="border-t border-white/5">
                  <td className="px-3 py-2 text-cyan-300">{r.groupCode}</td>
                  <td className="px-3 py-2 text-white">{r.displayName}</td>
                  <td className="px-3 py-2 text-center text-slate-300">#{r.place}</td>
                  <td className="px-3 py-2 text-center">{r.firmasScore6.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center">{r.examScore4.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center font-bold text-cyan-300">
                    {r.isExempt ? "10 ★" : r.finalGrade.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {statusLabel(r.examStatus)}
                    {r.examCorrect != null ? ` · ${r.examCorrect}/75` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass p-6">
        <h3 className="text-base font-semibold text-white">Banco de preguntas (solo docente)</h3>
        <p className="mt-1 text-xs text-slate-500">Vista previa de las 75 preguntas — no visible para alumnos hasta habilitar.</p>
        <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto pr-2">
          {exam.questionsPreview?.map((q, i) => (
            <article key={q.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-sm">
              <p className="text-xs font-bold text-cyan-400">
                {i + 1}. {q.program}
              </p>
              <p className="mt-1 text-white">{q.questionText}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                <li className={q.correctOption === "A" ? "text-emerald-300 font-bold" : ""}>A) {q.optionA}</li>
                <li className={q.correctOption === "B" ? "text-emerald-300 font-bold" : ""}>B) {q.optionB}</li>
                <li className={q.correctOption === "C" ? "text-emerald-300 font-bold" : ""}>C) {q.optionC}</li>
                <li className={q.correctOption === "D" ? "text-emerald-300 font-bold" : ""}>D) {q.optionD}</li>
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
