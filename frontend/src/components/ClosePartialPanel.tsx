import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  downloadListasF1Excel,
  fetchListasF1Preview,
  getApiErrorMessage,
  updateGroupPartialSettings,
} from "../lib/api";
import type { ClassGroup } from "../lib/types";

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

  const previewQuery = useQuery({
    queryKey: ["listas-f1-preview", selectedGroupId],
    queryFn: () => fetchListasF1Preview(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const preview = previewQuery.data;
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
      setActionSuccess(
        closed
          ? "Parcial cerrado. Se descargó LISTAS F1 con % de asistencia y escala. El examen lo llenas tú."
          : "Parcial reabierto.",
      );
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
      setActionSuccess("Se descargó LISTAS F1 con % de asistencia y escala. La columna Examen queda para ti.");
    } catch (error) {
      setActionSuccess("");
      setActionError(getApiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  async function handleCloseAndDownload() {
    const ok = window.confirm(
      "¿Finalizar y cerrar el parcial de este grupo?\n\nSe calculará la escala (máximo 6) y se descargará LISTAS F1 con % de asistencia y escala.\nTú llenas la calificación de examen.\nLos alumnos podrán descargar su diploma.",
    );
    if (!ok) return;
    try {
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
          <h2 className="text-lg font-semibold text-white">Finalizar y cerrar el parcial</h2>
          <p className="mt-1 text-sm text-slate-400">
            Grupo {selectedGroup?.code} · {selectedGroup?.shift}
            {partialClosed ? " · Parcial cerrado" : " · Parcial abierto"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading || !preview?.excel.templateFound}
            className="rounded-xl border border-cyan-400/30 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-60"
          >
            {downloading ? "Descargando..." : "Descargar LISTAS F1"}
          </button>
          {partialClosed ? (
            <button
              type="button"
              onClick={() => closeMutation.mutate(false)}
              disabled={closeMutation.isPending || !selectedGroupId}
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-60"
            >
              {closeMutation.isPending ? "Guardando..." : "Reabrir parcial"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleCloseAndDownload()}
              disabled={closeMutation.isPending || downloading || !selectedGroupId}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
            >
              {closeMutation.isPending || downloading ? "Procesando..." : "Finalizar y cerrar el parcial"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-400/25 bg-indigo-500/5 px-4 py-3 text-sm text-slate-300">
        <p className="font-semibold text-indigo-100">Cómo se obtienen los 6 puntos de escala</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-400">
          <li>
            Se usan los <strong className="text-slate-200">mismos puntos del ranking</strong>: trabajos +
            estrellas de participación.
          </li>
          <li>
            <strong className="text-slate-200">Quien va 1° obtiene 6</strong>. El resto: sus puntos ÷ puntos
            del 1° × 6.
          </li>
          <li>
            <strong className="text-slate-200">Examen: 4 puntos</strong> — no se llena automático. La
            calificación final del Excel suma escala + examen cuando tú captures el examen.
          </li>
        </ul>
      </div>

      {previewQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-400">Calculando escala y asistencia...</p>
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
              {preview.excel.matchedInExcel}/{preview.rows.length} alumnos del grupo {preview.group.code} coinciden
              con el Excel
            </span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              {preview.activityCount} actividades · {preview.activityMax} pts máx.
              {preview.useParticipation
                ? ` · 1° del ranking: ${preview.firstPlaceScore} pts`
                : " · 1° del ranking (solo trabajos)"}
            </span>
          </div>
          {missingSheets.length > 0 ? (
            <p className="mt-2 text-xs text-amber-200">
              El formato oficial debe traer las hojas {preview.excel.expectedGroups.join(" y ")}. Falta:{" "}
              {missingSheets.join(", ")}.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              El Excel oficial trae los grupos {preview.excel.expectedGroups.join(" y ")}. Al descargar se
              llenan ambas hojas cruzando nombre y número de control; el examen (columna G) se deja vacío.
              {preview.excel.teacherGroups.some((code) => !preview.excel.expectedGroups.includes(code))
                ? ` Tus grupos en el sistema son ${preview.excel.teacherGroups.join(" y ")}.`
                : null}
            </p>
          )}

          <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-900/90 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">% Asist.</th>
                  <th className="px-3 py-2">Trabajos</th>
                  <th className="px-3 py-2">Particip.</th>
                  <th className="px-3 py-2">Escala / 6</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.studentId} className="border-t border-white/5 text-slate-200">
                    <td className="px-3 py-1.5">{row.displayName}</td>
                    <td className="px-3 py-1.5">{row.attendancePercent}%</td>
                    <td className="px-3 py-1.5">
                      {row.activityPoints}
                      <span className="ml-1 text-xs text-slate-500">/{row.activityMax}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      {preview.useParticipation ? `${row.participationStars} est.` : "—"}
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-cyan-100">{row.scale6.toFixed(1)}</td>
                  </tr>
                ))}
                {!preview.rows.length ? (
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
