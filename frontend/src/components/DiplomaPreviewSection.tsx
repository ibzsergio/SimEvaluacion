import { useEffect, useState } from "react";
import {
  downloadTeacherStudentDiploma,
  getApiErrorMessage,
  openTeacherDiplomaPreview,
  previewTeacherDiplomaBlobUrl,
} from "../lib/api";
import type { PartialSummaryRow } from "../lib/types";

const SUBJECT = "Desarrolla Software de Sistemas Informaticos";
const TEACHER = "Ing. Sergio Ibañez Montiel";

function DiplomaMockup({
  sampleName,
  groupCode,
  partialClosed,
  samplePlace,
  sampleScore,
  sampleExemption,
}: {
  sampleName: string;
  groupCode: string;
  partialClosed: boolean;
  samplePlace: number;
  sampleScore: number;
  sampleExemption: PartialSummaryRow["exemption"];
}) {
  const sealClass =
    sampleExemption.tier === "exempt"
      ? "bg-emerald-600 text-emerald-50 ring-emerald-300"
      : sampleExemption.tier === "can_exempt"
        ? "bg-sky-600 text-sky-50 ring-sky-300"
        : "bg-amber-600 text-amber-50 ring-amber-300";

  return (
    <div className="relative mx-auto max-w-xl overflow-hidden rounded-xl border-2 border-indigo-600 bg-slate-50 shadow-2xl">
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="absolute left-3 top-3 h-8 w-8 border-l-2 border-t-2 border-cyan-500" />
      <div className="absolute right-3 top-3 h-8 w-8 border-r-2 border-t-2 border-cyan-500" />
      <div className="absolute bottom-3 left-3 h-8 w-8 border-b-2 border-l-2 border-cyan-500" />
      <div className="absolute bottom-3 right-3 h-8 w-8 border-b-2 border-r-2 border-cyan-500" />

      <div className="relative bg-indigo-950 px-4 py-4 text-center">
        <p className="font-mono text-[10px] text-cyan-400">// PARCIAL · DESARROLLO DE SOFTWARE</p>
        <p className="mt-1 text-lg font-bold tracking-wide text-white">DIPLOMA DE RECONOCIMIENTO</p>
        <p className="text-[11px] text-indigo-200">Sistemas Informáticos · Evaluación por desempeño</p>
        <div className="mt-2 h-1 bg-cyan-500" />
      </div>

      <div className="relative flex gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-cyan-700">
            {"{"} <span className="text-indigo-700">{SUBJECT}</span> {"}"}
          </p>
          <p className="mt-3 text-xs text-slate-500">Se otorga el presente reconocimiento académico a</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{sampleName}</p>
          <div className="mt-2 h-0.5 w-full max-w-xs bg-cyan-500" />
          <p className="mt-2 text-[11px] text-slate-600">
            Grupo {groupCode} · {partialClosed ? "Parcial cerrado" : "Vista previa"}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-xs">
            <div>
              <p className="font-bold text-indigo-700">RANKING</p>
              <p className="font-bold text-slate-900">
                #{samplePlace}
              </p>
            </div>
            <div>
              <p className="font-bold text-indigo-700">PUNTOS</p>
              <p className="font-bold text-slate-900">{sampleScore}</p>
            </div>
          </div>

          <p
            className={`mt-3 text-sm font-extrabold ${
              sampleExemption.tier === "exempt"
                ? "text-emerald-700"
                : sampleExemption.tier === "can_exempt"
                  ? "text-sky-700"
                  : "text-amber-700"
            }`}
          >
            {sampleExemption.label}
          </p>

          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-100 p-2 text-[11px] leading-relaxed text-slate-600">
            Reconocimiento por el trabajo realizado en el parcial, con mensaje personalizado según
            ranking y desempeño en la materia.
          </p>

          <div className="mt-4 border-t border-slate-300 pt-2">
            <p className="text-xs font-bold text-slate-800">{TEACHER}</p>
            <p className="text-[10px] text-slate-500">Docente responsable de la materia</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center">
          <div
            className={`flex h-24 w-24 flex-col items-center justify-center rounded-full text-center ring-4 ${sealClass}`}
          >
            <span className="text-[10px] font-bold leading-tight">{sampleExemption.shortLabel}</span>
            <span className="text-xs font-bold">#{samplePlace}</span>
          </div>
          <p className="mt-2 font-mono text-[9px] text-cyan-700">&lt; / &gt;</p>
        </div>
      </div>
    </div>
  );
}

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
            Diseño tech para Desarrollo de Software — muestra con datos del grupo {groupCode}
            {sampleRow ? ` (${sampleName}, #${samplePlace})` : ""}.
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
          <DiplomaMockup
            sampleName={sampleName}
            groupCode={groupCode}
            partialClosed={partialClosed}
            samplePlace={samplePlace}
            sampleScore={sampleScore}
            sampleExemption={sampleExemption}
          />
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
              className="h-[480px] w-full rounded-lg border border-white/10 bg-white"
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
