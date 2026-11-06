import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudentExamDelivery, getApiErrorMessage, uploadExamPdf } from "../lib/api";
import {
  EXAMEN_CHECKS,
  EXAMEN_CIERRE_TEXTO,
  EXAMEN_PDF_MAX_BYTES,
  EXAMEN_PROGRAMA,
  EXAMEN_REGLAS,
  EXAMEN_TITULO,
  examenAbierto,
  examenEsGrupo,
  formatExamenSize,
} from "../lib/examScrum";

export default function StudentExamenCard({ groupCode }: { groupCode?: string | null }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const abierto = examenAbierto(now);
  const deliveryQuery = useQuery({
    queryKey: ["student-examen-delivery"],
    queryFn: fetchStudentExamDelivery,
    enabled: examenEsGrupo(groupCode),
    retry: false,
    refetchInterval: 15_000,
  });
  const uploadMutation = useMutation({
    mutationFn: (next: File) => uploadExamPdf(next),
    onSuccess: async () => {
      setLocalError("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["student-examen-delivery"] });
    },
    onError: (error) => setLocalError(getApiErrorMessage(error)),
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!examenEsGrupo(groupCode)) return null;
  if (deliveryQuery.data && deliveryQuery.data.allowed === false) return null;

  const ready = EXAMEN_CHECKS.every((item) => checked[item.id]);
  const delivery = deliveryQuery.data?.delivery ?? null;

  function chooseFile(next: File | null) {
    setLocalError("");
    if (!next) {
      setFile(null);
      return;
    }
    const name = next.name.toLowerCase();
    if (!name.endsWith(".pdf") && next.type !== "application/pdf") {
      setFile(null);
      setLocalError("Solo se puede subir un PDF.");
      return;
    }
    if (next.size > EXAMEN_PDF_MAX_BYTES) {
      setFile(null);
      setLocalError("El PDF pesa más de 3 MB. Redúcelo y vuelve a elegirlo.");
      return;
    }
    setFile(next);
  }

  return (
    <section className="glass mb-6 overflow-hidden p-0">
      <div className="bg-gradient-to-r from-amber-500/30 to-yellow-500/10 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-100">{EXAMEN_PROGRAMA}</p>
        <h2 className="mt-1 text-xl font-bold text-white">{EXAMEN_TITULO}</h2>
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${abierto ? "bg-amber-500/15 text-amber-50" : "bg-rose-500/15 text-rose-100"}`}>
          {EXAMEN_CIERRE_TEXTO}
          {abierto ? "" : " Esa hora ya pasó y ya no se acepta el PDF."}
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="rounded-2xl border border-amber-300/50 bg-amber-400/10 px-4 py-3">
          <p className="text-sm font-bold text-amber-50">Margen amarillo</p>
          <p className="mt-1 text-sm text-amber-50">
            Todas las hojas del examen llevan margen amarillo. Si no lo traen, el examen no se toma en cuenta.
          </p>
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-100">
          {EXAMEN_REGLAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-sm font-bold text-white">Antes de subir, confirma tu PDF</p>
          <ul className="mt-2 space-y-2">
            {EXAMEN_CHECKS.map((item) => (
              <li key={item.id}>
                <label className="flex items-start gap-2 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(checked[item.id])}
                    onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                  />
                  <span>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-sm font-bold text-white">Subir mi examen</p>
          {delivery ? (
            <p className="mt-2 text-sm text-emerald-100">
              Ya está tu archivo {delivery.fileName} ({formatExamenSize(delivery.sizeBytes)}). Si lo vuelves a subir, reemplaza el anterior.
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-100">Todavía no subes tu examen.</p>
          )}
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={!ready || !abierto || uploadMutation.isPending}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            className="mt-3 block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950 disabled:opacity-50"
          />
          {file ? (
            <p className="mt-2 text-sm text-slate-200">
              {file.name} · {formatExamenSize(file.size)}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!ready || !file || !abierto || uploadMutation.isPending}
            onClick={() => file && uploadMutation.mutate(file)}
            className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {uploadMutation.isPending ? "Subiendo…" : delivery ? "Reemplazar PDF" : "Subir PDF del examen"}
          </button>
          {!abierto ? null : !ready ? (
            <p className="mt-2 text-sm text-slate-400">Marca todas las casillas para poder elegir el archivo.</p>
          ) : null}
          {localError ? <p className="mt-2 text-sm text-rose-200">{localError}</p> : null}
          {deliveryQuery.isError ? (
            <p className="mt-2 text-sm text-rose-200">{getApiErrorMessage(deliveryQuery.error)}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
