import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  downloadListasF1Excel,
  fetchListasF1Preview,
  getApiErrorMessage,
  saveGroupExamScores,
  updateGroupPartialSettings,
} from "../lib/api";
import { formatDateTime } from "../lib/dates";
import type { ClassGroup, ListasF1PreviewRow } from "../lib/types";

function parseExamDraft(raw: string): number | null | "invalid" {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 4) return "invalid";
  return Math.round(n * 10) / 10;
}

function liveTotal(scale6: number, draft: string) {
  const parsed = parseExamDraft(draft);
  if (parsed === "invalid" || parsed == null) return null;
  return Math.round(Math.min(10, scale6 + parsed) * 10) / 10;
}

function sortRowsByName(rows: ListasF1PreviewRow[]) {
  return [...rows].sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" }) ||
      (a.listNumber ?? 999) - (b.listNumber ?? 999),
  );
}

export default function ClosePartialPanel({
  groups,
  selectedGroupId,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
}) {
  const qc = useQueryClient();
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const partialClosed = selectedGroup?.partialClosed ?? false;
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const previewQuery = useQuery({
    queryKey: ["listas-f1-preview", selectedGroupId],
    queryFn: () => fetchListasF1Preview(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const preview = previewQuery.data;

  useEffect(() => {
    setDrafts({});
    setDirty(false);
    setActionError("");
    setActionSuccess("");
  }, [selectedGroupId]);

  useEffect(() => {
    if (!preview || dirty) return;
    const next: Record<string, string> = {};
    for (const row of preview.rows) {
      next[row.studentId] = row.examScore4 == null ? "" : String(row.examScore4);
    }
    setDrafts(next);
  }, [preview, dirty]);

  const examRows = useMemo(
    () => (preview ? sortRowsByName(preview.rows) : []),
    [preview],
  );

  const capturedCount = useMemo(() => {
    return examRows.filter((row) => {
      const parsed = parseExamDraft(drafts[row.studentId] ?? "");
      return parsed !== "invalid" && parsed != null;
    }).length;
  }, [examRows, drafts]);

  const invalidCount = useMemo(() => {
    return examRows.filter((row) => parseExamDraft(drafts[row.studentId] ?? "") === "invalid").length;
  }, [examRows, drafts]);

  const closeMutation = useMutation({
    mutationFn: (closed: boolean) => updateGroupPartialSettings(selectedGroupId, { partialClosed: closed }),
    onSuccess: async (_, closed) => {
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["listas-f1-preview", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["group-weeks", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["partial-summary", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
      setActionError("");
      setActionSuccess(closed ? "Parcial cerrado. Se descargó LISTAS F1 con asistencia, escala y examen." : "Parcial reabierto.");
    },
    onError: (error) => {
      setActionSuccess("");
      setActionError(getApiErrorMessage(error));
    },
  });

  const saveExamMutation = useMutation({
    mutationFn: () => {
      if (!preview) return Promise.reject(new Error("Sin datos del grupo."));
      const scores = preview.rows.map((row) => {
        const parsed = parseExamDraft(drafts[row.studentId] ?? "");
        if (parsed === "invalid") {
          throw new Error(`Examen inválido para ${row.displayName}. Debe ser de 0 a 4.`);
        }
        return { studentId: row.studentId, examScore4: parsed };
      });
      return saveGroupExamScores(selectedGroupId, scores);
    },
    onSuccess: async (result) => {
      setDirty(false);
      setActionError("");
      setActionSuccess(
        `Examen guardado: ${result.saved} calificación(es)${result.cleared ? `, ${result.cleared} en blanco` : ""}.`,
      );
      await qc.invalidateQueries({ queryKey: ["listas-f1-preview", selectedGroupId] });
    },
    onError: (error) => {
      setActionSuccess("");
      setActionError(getApiErrorMessage(error));
    },
  });

  async function handleDownload() {
    setActionError("");
    setDownloading(true);
    try {
      await downloadListasF1Excel();
      setActionSuccess("Se descargó LISTAS F1 con % de asistencia, escala y examen capturado.");
    } catch (error) {
      setActionSuccess("");
      setActionError(getApiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  async function persistExamIfNeeded() {
    if (!dirty && !saveExamMutation.isPending) return;
    await saveExamMutation.mutateAsync();
  }

  async function handleCloseAndDownload() {
    if (invalidCount > 0) {
      setActionError("Hay calificaciones de examen inválidas. Corrige los valores (0 a 4) antes de cerrar.");
      return;
    }
    const missing = (preview?.rows.length ?? 0) - capturedCount;
    const missingNote =
      missing > 0 ? `\n\nAún faltan ${missing} alumno(s) sin examen; su columna Examen quedará vacía.` : "";
    const ok = window.confirm(
      `¿Cerrar el parcial de este grupo?${missingNote}\n\nSe descargará LISTAS F1 con % de asistencia, escala (máx. 6) y examen (máx. 4).\nLos alumnos podrán descargar su diploma.`,
    );
    if (!ok) return;
    try {
      await persistExamIfNeeded();
      await closeMutation.mutateAsync(true);
      await handleDownload();
    } catch {
      // El error ya se muestra en onError / handleDownload.
    }
  }

  const sheets = preview?.excel.sheets ?? [];
  const missingSheets = sheets.filter((s) => !s.found).map((s) => s.code);

  return (
    <section className="glass mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Examen, cierre de parcial y LISTAS F1</h2>
          <p className="mt-1 text-sm text-slate-400">
            Grupo {selectedGroup?.code} · {selectedGroup?.shift}
            {partialClosed ? " · Parcial cerrado" : " · Parcial abierto"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {partialClosed ? (
            <button
              type="button"
              onClick={() => closeMutation.mutate(false)}
              disabled={closeMutation.isPending || !selectedGroupId}
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-60"
            >
              {closeMutation.isPending ? "Guardando..." : "Reabrir parcial"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-400/25 bg-indigo-500/5 px-4 py-3 text-sm text-slate-300">
        <p className="font-semibold text-indigo-100">Escala 6 + examen 4 = 10</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-400">
          <li>
            <strong className="text-slate-200">Escala (máx. 6)</strong> — mismos puntos del ranking. El 1°
            obtiene 6.
          </li>
          <li>
            <strong className="text-slate-200">Examen (máx. 4)</strong> — lo capturas tú, en orden
            alfabético como en las actividades. La columna Prioridad marca quién entregó primero (prioridad
            para el 4).
          </li>
          <li>
            <strong className="text-slate-200">% asistencia</strong> — solo la falta (F) baja el porcentaje.
          </li>
          <li>
            Al terminar la captura, <strong className="text-slate-200">cierra el parcial</strong> y se descarga
            LISTAS F1 con asistencia, escala, examen y calificación final.
          </li>
        </ul>
      </div>

      {previewQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-400">Calculando escala, asistencia y prioridad de entrega...</p>
      ) : previewQuery.isError ? (
        <p className="mt-4 text-sm text-rose-200">{getApiErrorMessage(previewQuery.error)}</p>
      ) : preview ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {preview.excel.templateFound ? (
              <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                Plantilla LISTAS F1 encontrada
              </span>
            ) : (
              <span className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-rose-100">
                Falta la plantilla LISTAS F1 en el servidor
              </span>
            )}
            {sheets.map((sheet) => (
              <span
                key={sheet.code}
                className={`rounded-lg border px-2.5 py-1 ${
                  sheet.found
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-400/30 bg-rose-500/10 text-rose-100"
                }`}
              >
                Hoja {sheet.code}: {sheet.found ? `${sheet.excelStudents} alumnos` : "no está en el Excel"}
              </span>
            ))}
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              Examen capturado: {capturedCount}/{examRows.length}
            </span>
          </div>
          {missingSheets.length > 0 ? (
            <p className="mt-2 text-xs text-amber-200">
              El formato oficial debe traer las hojas {preview.excel.expectedGroups.join(" y ")}. Falta:{" "}
              {missingSheets.join(", ")}.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              El Excel oficial trae los grupos {preview.excel.expectedGroups.join(" y ")}. Se llenan ambas
              hojas por nombre y número de control.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Captura de examen (0 a 4)</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Orden alfabético, igual que en actividades. El total se calcula en vivo (escala + examen).
              </p>
            </div>
            <button
              type="button"
              onClick={() => saveExamMutation.mutate()}
              disabled={saveExamMutation.isPending || invalidCount > 0 || !examRows.length}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {saveExamMutation.isPending ? "Guardando..." : "Guardar calificaciones de examen"}
            </button>
          </div>

          <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-900/90 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">% Asist.</th>
                  <th className="px-3 py-2">Escala / 6</th>
                  <th className="px-3 py-2">Examen / 4</th>
                  <th className="px-3 py-2">Total / 10</th>
                </tr>
              </thead>
              <tbody>
                {examRows.map((row) => (
                  <ExamCaptureRow
                    key={row.studentId}
                    row={row}
                    draft={drafts[row.studentId] ?? ""}
                    disabled={partialClosed || saveExamMutation.isPending}
                    onChange={(value) => {
                      setDrafts((prev) => ({ ...prev, [row.studentId]: value }));
                      setDirty(true);
                    }}
                  />
                ))}
                {!examRows.length ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={5}>
                      Este grupo aún no tiene alumnos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-500/5 px-4 py-3">
        <p className="text-sm text-slate-300">
          Cuando termines de capturar el examen, cierra el parcial para descargar LISTAS F1.
        </p>
        <div className="flex flex-wrap gap-2">
          {partialClosed ? (
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading || !preview?.excel.templateFound}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {downloading ? "Descargando..." : "Descargar LISTAS F1"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleCloseAndDownload()}
              disabled={
                closeMutation.isPending ||
                downloading ||
                saveExamMutation.isPending ||
                !selectedGroupId ||
                invalidCount > 0
              }
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
            >
              {closeMutation.isPending || downloading ? "Procesando..." : "Cerrar parcial y descargar LISTAS F1"}
            </button>
          )}
        </div>
      </div>

      {actionError ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {actionError}
        </p>
      ) : null}
      {actionSuccess ? (
        <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {actionSuccess}
        </p>
      ) : null}
    </section>
  );
}

function ExamCaptureRow({
  row,
  draft,
  disabled,
  onChange,
}: {
  row: ListasF1PreviewRow;
  draft: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const parsed = parseExamDraft(draft);
  const invalid = parsed === "invalid";
  const total = liveTotal(row.scale6, draft);
  const priority = row.deliveryPriority <= 10;
  return (
    <tr
      className={`border-t border-white/5 ${priority ? "bg-amber-500/5" : ""} ${
        invalid ? "bg-rose-500/10" : ""
      }`}
    >
      <td className="px-3 py-1.5 align-top">
        <p className="font-medium text-white">{row.displayName}</p>
        {priority ? (
          <p className="text-[11px] text-amber-200/90">
            Prioridad para el 4 · entregó primero
            {row.firstGradedAt ? ` · ${formatDateTime(row.firstGradedAt)}` : ""}
          </p>
        ) : row.firstGradedAt ? (
          <p className="text-[11px] text-slate-500">1ª entrega {formatDateTime(row.firstGradedAt)}</p>
        ) : null}
      </td>
      <td className="px-3 py-1.5 align-top text-slate-300">{row.attendancePercent}%</td>
      <td className="px-3 py-1.5 align-top font-semibold text-cyan-100">{row.scale6.toFixed(1)}</td>
      <td className="px-3 py-1.5 align-top">
        <input
          type="number"
          min={0}
          max={4}
          step={0.1}
          value={draft}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0–4"
          className={`w-20 rounded-lg border bg-slate-900/60 px-2 py-1 text-sm text-white disabled:opacity-60 ${
            invalid ? "border-rose-400/60" : "border-white/15"
          }`}
        />
      </td>
      <td className="px-3 py-1.5 align-top font-semibold text-emerald-200">
        {total == null ? "—" : total.toFixed(1)}
      </td>
    </tr>
  );
}
