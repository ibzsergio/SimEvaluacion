import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudentBasedatosDelivery, fetchStudentComms, getApiErrorMessage, uploadBasedatosPdf } from "../lib/api";
import { studentBasedatosFromAnnouncements } from "../lib/basedatosLive";
import {
  BASEDATOS_FIRMAS_MAX,
  BASEDATOS_PDF_MAX_BYTES,
  BASEDATOS_PRODUCTOS,
  BASEDATOS_PROGRAMA,
  BASEDATOS_REGLAS,
  BASEDATOS_TITULO,
  basedatosCheckItems,
  basedatosProductHeading,
  formatBasedatosSize,
} from "../lib/basedatosScrum";
import type { StudentExtra } from "../lib/types";

export default function StudentBasedatosCard({
  extra,
  studentId,
}: {
  extra?: StudentExtra | null;
  studentId?: string | null;
}) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const comms = useQuery({
    queryKey: ["student-comms"],
    queryFn: fetchStudentComms,
    staleTime: 4_000,
    refetchInterval: 8_000,
  });
  const deliveryQuery = useQuery({
    queryKey: ["student-basedatos-delivery"],
    queryFn: fetchStudentBasedatosDelivery,
    retry: false,
    refetchInterval: 10_000,
  });
  const uploadMutation = useMutation({
    mutationFn: (next: File) => uploadBasedatosPdf(next),
    onSuccess: async () => {
      setLocalError("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["student-basedatos-delivery"] });
    },
    onError: (error) => setLocalError(getApiErrorMessage(error)),
  });
  const activity = studentBasedatosFromAnnouncements(extra, comms.data?.announcements ?? [], studentId);
  const checks = useMemo(() => basedatosCheckItems(), []);
  if (!activity) return null;

  const firmas = activity.firmas ?? BASEDATOS_FIRMAS_MAX;
  const ready = checks.every((item) => checked[item.id]);
  const delivery = deliveryQuery.data?.delivery;

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
    if (next.size > BASEDATOS_PDF_MAX_BYTES) {
      setFile(null);
      setLocalError("El PDF pesa más de 5 MB. Redúcelo y vuelve a elegirlo.");
      return;
    }
    setFile(next);
  }

  return (
    <section className="glass mb-6 overflow-hidden p-0">
      <div className="bg-gradient-to-r from-sky-600/30 to-cyan-500/10 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">{BASEDATOS_PROGRAMA}</p>
        <h2 className="mt-1 text-xl font-bold text-white">{BASEDATOS_TITULO}</h2>
        <p className="mt-1 text-sm text-slate-200">
          {activity.teamName ? `${activity.teamName} · ` : ""}
          {firmas.toLocaleString("es-MX")} / {BASEDATOS_FIRMAS_MAX.toLocaleString("es-MX")} puntos
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        {activity.noTeam ? (
          <p className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Aún no estás en un equipo de Roles / Equipos. La entrega es por equipo.
          </p>
        ) : null}

        <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3">
          <p className="text-sm font-bold text-white">Un solo PDF del equipo</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-100">
            {BASEDATOS_REGLAS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {BASEDATOS_PRODUCTOS.map((product) => (
          <div key={product.id} className="rounded-2xl border border-white/10 px-4 py-3">
            <p className="text-sm font-bold text-white">
              {basedatosProductHeading(product)}
            </p>
            <ul className="mt-2 space-y-2">
              {product.items.map((item) => (
                <li key={item.id}>
                  <label className="flex items-start gap-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(checked[item.id])}
                      onChange={(event) =>
                        setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))
                      }
                    />
                    <span>{item.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-sm font-bold text-white">Subir el PDF</p>
          <p className="mt-1 text-sm text-slate-300">
            Marca todas las casillas. Así confirmas que el PDF trae carátula, las cuatro secciones con su título, el script completo y las capturas. Un integrante lo sube; si lo vuelven a subir, reemplaza el anterior.
          </p>
          {delivery ? (
            <p className="mt-2 text-sm text-emerald-100">
              Ya está el archivo {delivery.fileName} ({formatBasedatosSize(delivery.sizeBytes)}), lo subió {delivery.uploadedByName}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-100">Este equipo todavía no sube el PDF.</p>
          )}
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={!ready || uploadMutation.isPending}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            className="mt-3 block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950 disabled:opacity-50"
          />
          {file ? (
            <p className="mt-2 text-sm text-slate-200">
              {file.name} · {formatBasedatosSize(file.size)}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!ready || !file || uploadMutation.isPending || activity.noTeam}
            onClick={() => file && uploadMutation.mutate(file)}
            className="mt-3 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {uploadMutation.isPending ? "Subiendo…" : delivery ? "Reemplazar PDF" : "Subir PDF del equipo"}
          </button>
          {!ready ? (
            <p className="mt-2 text-sm text-slate-400">Falta marcar el checklist para poder elegir el archivo.</p>
          ) : null}
          {localError ? <p className="mt-2 text-sm text-rose-200">{localError}</p> : null}
          {deliveryQuery.isError ? (
            <p className="mt-2 text-sm text-rose-200">{getApiErrorMessage(deliveryQuery.error)}</p>
          ) : null}
        </div>

        {(activity.notes ?? []).length > 0 ? (
          <ul className="space-y-1 text-sm text-rose-100">
            {(activity.notes ?? []).map((note) => (
              <li key={note.id}>
                −{note.points} {note.label}
                {note.studentName ? ` · ${note.studentName}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
