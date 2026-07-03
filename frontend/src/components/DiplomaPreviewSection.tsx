import { useEffect, useState } from "react";
import {
  downloadTeacherStudentDiploma,
  getApiErrorMessage,
  openTeacherDiplomaPreview,
  previewTeacherDiplomaBlobUrl,
} from "../lib/api";
import type { PartialSummaryRow } from "../lib/types";
import { ExemptionBadge } from "./ExemptionBadge";

const SUBJECT = "Desarrolla Software de Sistemas Informaticos";
const TEACHER = "Ing. Sergio Ibañez Montiel";

export default function DiplomaPreviewSection({
  groupId,
  groupCode,
  partialClosed,
  sampleRow,
}: {
  groupId: string;
  groupCode: string;
  partialClosed: boolean;
  sampleRow?: PartialSummaryRow;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const sampleName = sampleRow?.displayName ?? "Alumno de ejemplo";
  const samplePlace = sampleRow?.place ?? 5;
  const sampleScore = sampleRow?.totalPoints ?? 8500;
  const sampleExemption = sampleRow?.exemption ?? {
    tier: "exempt" as const,
    label: "¡EXENTADO!",
    shortLabel: "EXENTADO",
  };

  useEffect(() => {
    let active = true;
    setLoadingPdf(true);
    setPdfError("");
    previewTeacherDiplomaBlobUrl(groupId)
      .then((url) => {
        if (active) setPdfUrl(url);
      })
      .catch((err) => {
        if (active) setPdfError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoadingPdf(false);
      });

    return () => {
      active = false;
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [groupId]);

  return (
    <section className="glass mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Vista previa del diploma (PDF)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Así lo verán los alumnos al cerrar el parcial. La muestra usa datos reales del grupo{" "}
            {groupCode}
            {sampleRow ? ` (${sampleName}, lugar #${samplePlace})` : ""}.
          </p>
        </div>
        <button
          type="button"
          disabled={loadingPdf}
          onClick={() => openTeacherDiplomaPreview(groupId).catch((err) => window.alert(getApiErrorMessage(err)))}
          className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
        >
          Abrir PDF en pestaña nueva
        </button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Maqueta visual (referencia)
          </p>
          <div className="mx-auto max-w-lg rounded-lg border-4 border-double border-slate-700 bg-gradient-to-b from-slate-50 to-slate-100 p-6 text-slate-900 shadow-inner">
            <div className="rounded border border-cyan-700/30 p-5">
              <p className="text-center text-xl font-bold tracking-wide text-slate-900">
                DIPLOMA DE RECONOCIMIENTO
              </p>
              <p className="mt-2 text-center text-sm font-medium text-cyan-800">{SUBJECT}</p>
              <p className="mt-4 text-center text-xs text-slate-600">
                Se otorga el presente reconocimiento a
              </p>
              <p className="mt-2 text-center text-lg font-bold text-slate-900">{sampleName}</p>
              <p className="mt-2 text-center text-xs text-slate-600">
                Grupo {groupCode} · {partialClosed ? "Parcial cerrado" : "Vista previa"}
              </p>
              <div className="mt-4 flex justify-center">
                <ExemptionBadge exemption={sampleExemption} />
              </div>
              <p className="mt-3 text-center text-xs text-slate-600">
                Lugar #{samplePlace} · {sampleScore} puntos totales
              </p>
              <p className="mt-4 text-justify text-xs leading-relaxed text-slate-700">
                Reconocimiento por el trabajo realizado durante el parcial en la materia, con mensaje
                alentador personalizado según el lugar en el ranking.
              </p>
              <p className="mt-6 text-center text-xs font-medium text-slate-600">{TEACHER}</p>
              <p className="text-center text-[10px] text-slate-500">Docente</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            PDF real (mismo archivo que recibe el alumno)
          </p>
          {pdfError ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {pdfError}
            </p>
          ) : loadingPdf ? (
            <p className="py-20 text-center text-sm text-slate-400">Generando vista previa...</p>
          ) : pdfUrl ? (
            <iframe
              title="Vista previa del diploma"
              src={pdfUrl}
              className="h-[420px] w-full rounded-lg border border-white/10 bg-white"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function DiplomaRowActions({
  groupId,
  studentId,
  studentName,
}: {
  groupId: string;
  studentId: string;
  studentName: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      title={`Ver diploma de ${studentName}`}
      onClick={async () => {
        setPending(true);
        try {
          await downloadTeacherStudentDiploma(groupId, studentId, studentName);
        } catch (err) {
          window.alert(getApiErrorMessage(err));
        } finally {
          setPending(false);
        }
      }}
      className="rounded-lg border border-indigo-400/30 px-2 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/15 disabled:opacity-60"
    >
      {pending ? "..." : "Diploma"}
    </button>
  );
}
