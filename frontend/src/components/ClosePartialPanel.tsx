import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  downloadListasF1Excel,
  fetchListasF1Preview,
  getApiErrorMessage,
  saveGroupExamScores,
  startNextPartial,
  updateGroupDiplomaSettings,
  updateGroupPartialSettings,
} from "../lib/api";
import { formatDateTime, partialLabel } from "../lib/dates";
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
  const diplomaEnabled = selectedGroup?.diplomaEnabled ?? false;
  const currentPartial = selectedGroup?.currentPartial ?? 1;
  const nextPartial = currentPartial + 1;
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [examOpen, setExamOpen] = useState(false);

  const previewQuery = useQuery({
    queryKey: ["listas-f1-preview", selectedGroupId],
    queryFn: () => fetchListasF1Preview(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  const preview = previewQuery.data;

  useEffect(() => {
    setDrafts({});
    setDirty(false);
    setActionError("");
    setActionSuccess("");
  }, [selectedGroupId, currentPartial]);

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
  const capturePartial = preview?.scalePartial ?? currentPartial;
  const activityCount = preview?.activityCount ?? 0;

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
      await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
      setActionError("");
      setActionSuccess(
        closed
          ? "Parcial cerrado. Valida las calificaciones y luego activa los diplomas. LISTAS F1 se descargó."
          : "Parcial reabierto. Los diplomas quedaron desactivados.",
      );
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
        `Examen guardado: ${result.saved} calificación(es)${result.cleared ? `, ${result.cleared} en blanco` : ""}.${
          currentPartial <= 1 && partialClosed ? " Puedes volver a descargar LISTAS F1 para ver el cambio." : ""
        }`,
      );
      await qc.invalidateQueries({ queryKey: ["listas-f1-preview", selectedGroupId] });
    },
    onError: (error) => {
      setActionSuccess("");
      setActionError(getApiErrorMessage(error));
    },
  });

  const startNextMutation = useMutation({
    mutationFn: () => startNextPartial(selectedGroupId),
    onSuccess: async (group) => {
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["listas-f1-preview", selectedGroupId] });
      setActionError("");
      setActionSuccess(
        `Ya puedes publicar actividades de ${partialLabel(group.currentPartial ?? currentPartial + 1).toLowerCase()}. El examen se puede capturar después.`,
      );
    },
    onError: (error) => {
      setActionSuccess("");
      setActionError(getApiErrorMessage(error));
    },
  });

  const diplomaMutation = useMutation({
    mutationFn: (enabled: boolean) => updateGroupDiplomaSettings(selectedGroupId, { diplomaEnabled: enabled }),
    onSuccess: async (_, enabled) => {
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
      setActionError("");
      setActionSuccess(
        enabled
          ? "Diplomas activados. Cada alumno ya puede descargar su reconocimiento con frase según su lugar en el ranking."
          : "Diplomas desactivados. Los alumnos ya no pueden descargarlos.",
      );
    },
    onError: (error) => {
      setActionSuccess("");
      setActionError(getApiErrorMessage(error));
    },
  });

  function handleToggleDiplomas() {
    if (!diplomaEnabled) {
      const ok = window.confirm(
        "¿Activar diplomas para este grupo?\n\nConfirma que ya validaste las calificaciones. Los alumnos podrán descargar su diploma con una frase motivadora según su posición en el ranking.",
      );
      if (!ok) return;
    }
    diplomaMutation.mutate(!diplomaEnabled);
  }

  function handleStartNextPartial() {
    const ok = window.confirm(
      `¿Comenzar ${partialLabel(nextPartial).toLowerCase()}?\n\nLas actividades actuales se compactan (no se borran). Las nuevas se publican ya como ${partialLabel(nextPartial).toLowerCase()}.\n\nNo hace falta capturar el examen ni cerrar el parcial; eso lo puedes hacer después.`,
    );
    if (!ok) return;
    startNextMutation.mutate();
  }

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
      `¿Cerrar el parcial de este grupo?${missingNote}\n\nSe descargará LISTAS F1 con % de asistencia, escala (máx. 6) y examen (máx. 4).\nLos alumnos NO podrán descargar diploma hasta que valides calificaciones y pulses Activar diplomas.`,
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
    <section className={`glass ${examOpen ? "mb-6 p-3 sm:p-5" : "mb-3 p-3 sm:px-4 sm:py-3"}`}>
      <button
        type="button"
        onClick={() => setExamOpen((open) => !open)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white sm:text-lg">Examen, cierre de parcial y LISTAS F1</h2>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Grupo {selectedGroup?.code} · {selectedGroup?.shift}
            {currentPartial > 1
              ? ` · ${partialLabel(currentPartial)} en curso`
              : partialClosed
                ? " · Parcial cerrado"
                : " · Parcial abierto"}
            {diplomaEnabled ? " · Diplomas activos" : partialClosed ? " · Diplomas pendientes de validar" : ""}
            {preview ? ` · Examen ${capturedCount}/${examRows.length}` : ""}
          </p>
        </div>
        <span className="mt-0.5 shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {examOpen ? "Ocultar" : "Mostrar"}
        </span>
      </button>

      {examOpen ? (
      <>
      <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
          {currentPartial < 4 ? (
            <button
              type="button"
              onClick={handleStartNextPartial}
              disabled={startNextMutation.isPending || !selectedGroupId}
              className="min-h-11 w-full rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60 sm:w-auto"
            >
              {startNextMutation.isPending
                ? "Cambiando..."
                : `Comenzar ${partialLabel(nextPartial).toLowerCase()}`}
            </button>
          ) : null}
          {partialClosed ? (
            <>
              <button
                type="button"
                onClick={handleToggleDiplomas}
                disabled={diplomaMutation.isPending || !selectedGroupId}
                className={`min-h-11 w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto ${
                  diplomaEnabled
                    ? "border border-amber-400/30 bg-amber-500/10 text-amber-200"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                }`}
              >
                {diplomaMutation.isPending
                  ? "Guardando..."
                  : diplomaEnabled
                    ? "Desactivar diplomas"
                    : "Activar diplomas"}
              </button>
              <button
                type="button"
                onClick={() => closeMutation.mutate(false)}
                disabled={closeMutation.isPending || !selectedGroupId}
                className="min-h-11 w-full rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-60 sm:w-auto"
              >
                {closeMutation.isPending ? "Guardando..." : "Reabrir parcial"}
              </button>
            </>
          ) : null}
        </div>
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
            <span className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">
              {partialLabel(capturePartial)} · {activityCount} actividad(es)
            </span>
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

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white sm:text-base">
                Captura de examen (0 a 4) · {partialLabel(capturePartial)}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                La escala se actualiza al calificar. El examen queda vacío hasta que lo apliques.
              </p>
            </div>
            <button
              type="button"
              onClick={() => saveExamMutation.mutate()}
              disabled={saveExamMutation.isPending || invalidCount > 0 || !examRows.length}
              className="min-h-11 w-full shrink-0 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60 sm:w-auto"
            >
              {saveExamMutation.isPending ? "Guardando..." : "Guardar calificaciones de examen"}
            </button>
          </div>

          <div className="mt-3 space-y-2 md:hidden">
            {examRows.map((row) => (
              <ExamCaptureCard
                key={row.studentId}
                row={row}
                activityCount={activityCount}
                draft={drafts[row.studentId] ?? ""}
                disabled={saveExamMutation.isPending}
                onChange={(value) => {
                  setDrafts((prev) => ({ ...prev, [row.studentId]: value }));
                  setDirty(true);
                }}
              />
            ))}
            {!examRows.length ? (
              <p className="rounded-xl border border-white/10 px-3 py-3 text-sm text-slate-500">
                Este grupo aún no tiene alumnos.
              </p>
            ) : null}
          </div>

          <div className="mt-3 hidden max-h-[28rem] overflow-auto rounded-xl border border-white/10 md:block">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-900/90 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="sticky left-0 bg-slate-900/90 px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Entregadas</th>
                  <th className="px-3 py-2">Puntos</th>
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
                    activityCount={activityCount}
                    draft={drafts[row.studentId] ?? ""}
                    disabled={saveExamMutation.isPending}
                    onChange={(value) => {
                      setDrafts((prev) => ({ ...prev, [row.studentId]: value }));
                      setDirty(true);
                    }}
                  />
                ))}
                {!examRows.length ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={7}>
                      Este grupo aún no tiene alumnos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-rose-400/20 bg-rose-500/5 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
          {currentPartial > 1
            ? "El parcial anterior ya está cerrado. Esta tabla es del parcial en curso: la escala se mueve con lo que calificas; el examen se captura cuando lo apliques. LISTAS F1 del primero se puede volver a descargar."
            : partialClosed
              ? diplomaEnabled
                ? "Los diplomas ya están activos. El examen se puede seguir capturando o corrigiendo; luego vuelve a descargar LISTAS F1 si hace falta."
                : "Parcial cerrado. Sigue capturando el examen si falta alguien. Cuando valides, pulsa Activar diplomas."
              : "El examen no es requisito para publicar el siguiente parcial. Al cerrar, LISTAS F1 se descarga; los diplomas se activan después, cuando valides."}
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {partialClosed ? (
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading || !preview?.excel.templateFound}
              className="min-h-11 w-full rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 sm:w-auto"
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
              className="min-h-11 w-full rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60 sm:w-auto"
            >
              {closeMutation.isPending || downloading ? "Procesando..." : "Cerrar parcial y descargar LISTAS F1"}
            </button>
          )}
        </div>
      </div>
      </>
      ) : null}

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

function ExamCaptureCard({
  row,
  activityCount,
  draft,
  disabled,
  onChange,
}: {
  row: ListasF1PreviewRow;
  activityCount: number;
  draft: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const parsed = parseExamDraft(draft);
  const invalid = parsed === "invalid";
  const total = liveTotal(row.scale6, draft);
  const isFirst = row.scale6 >= 6 && (row.rankingScore ?? 0) > 0;
  return (
    <article
      className={`rounded-xl border px-3 py-2.5 ${
        invalid ? "border-rose-400/50 bg-rose-500/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{row.displayName}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {row.deliveredCount ?? 0}/{activityCount} · {row.activityPoints} pts · {row.attendancePercent}%
            {isFirst ? " · 1°" : ""}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs font-semibold text-cyan-100">
          Escala {row.scale6.toFixed(1)}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="min-w-0 flex-1 text-[11px] text-slate-400">
          Examen
          <input
            type="number"
            min={0}
            max={4}
            step={0.1}
            inputMode="decimal"
            value={draft}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0–4"
            className={`mt-0.5 h-11 w-full rounded-lg border bg-slate-900/60 px-3 text-base text-white disabled:opacity-60 ${
              invalid ? "border-rose-400/60" : "border-white/15"
            }`}
          />
        </label>
        <p className="w-16 shrink-0 pt-4 text-right text-sm font-semibold text-emerald-200">
          {total == null ? "—" : total.toFixed(1)}
        </p>
      </div>
    </article>
  );
}

function ExamCaptureRow({
  row,
  activityCount,
  draft,
  disabled,
  onChange,
}: {
  row: ListasF1PreviewRow;
  activityCount: number;
  draft: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const parsed = parseExamDraft(draft);
  const invalid = parsed === "invalid";
  const total = liveTotal(row.scale6, draft);
  const priority = (row.firstGradings ?? 0) > 0 && row.deliveryPriority <= 10;
  const isFirst = row.scale6 >= 6 && (row.rankingScore ?? 0) > 0;
  return (
    <tr
      className={`border-t border-white/5 ${priority || isFirst ? "bg-amber-500/5" : ""} ${
        invalid ? "bg-rose-500/10" : ""
      }`}
    >
      <td className="sticky left-0 bg-slate-950 px-3 py-1.5 align-top">
        <p className="font-medium text-white">{row.displayName}</p>
        {priority ? (
          <p className="text-[11px] text-amber-200/90">
            Prioridad para el 4 · entregó primero
            {row.firstGradedAt ? ` · ${formatDateTime(row.firstGradedAt)}` : ""}
          </p>
        ) : row.firstGradedAt ? (
          <p className="text-[11px] text-slate-500">1ª entrega {formatDateTime(row.firstGradedAt)}</p>
        ) : isFirst ? (
          <p className="text-[11px] text-amber-200/90">1° del ranking · escala 6.0</p>
        ) : null}
      </td>
      <td className="px-3 py-1.5 align-top text-slate-300">
        {row.deliveredCount ?? 0}/{activityCount}
      </td>
      <td className="px-3 py-1.5 align-top text-slate-300">{row.activityPoints}</td>
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
