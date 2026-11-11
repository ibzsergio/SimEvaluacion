import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudentComms, fetchStudentCrudDelivery, getApiErrorMessage, uploadCrudPdf } from "../lib/api";
import { studentCrudReleased } from "../lib/crudLive";
import {
  CRUD_CHECKS,
  CRUD_CODIGO,
  CRUD_CONTEXTO,
  CRUD_EVIDENCIAS,
  CRUD_PASOS,
  CRUD_PDF_MAX_BYTES,
  CRUD_PROGRAMA,
  CRUD_TABLA_EJEMPLO,
  CRUD_TABLAS,
  CRUD_TITULO,
  formatCrudSize,
} from "../lib/crudScrum";

export default function StudentCrudCard() {
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const comms = useQuery({
    queryKey: ["student-comms"],
    queryFn: fetchStudentComms,
    staleTime: 4_000,
    refetchInterval: 8_000,
  });
  const released = studentCrudReleased(comms.data?.announcements ?? []);
  const deliveryQuery = useQuery({
    queryKey: ["student-crud-delivery"],
    queryFn: fetchStudentCrudDelivery,
    enabled: released,
    retry: false,
    refetchInterval: 15_000,
  });
  const uploadMutation = useMutation({
    mutationFn: (next: File) => uploadCrudPdf(next),
    onSuccess: async () => {
      setLocalError("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["student-crud-delivery"] });
    },
    onError: (error) => setLocalError(getApiErrorMessage(error)),
  });
  if (!released) return null;
  if (deliveryQuery.data && deliveryQuery.data.allowed === false) return null;

  const ready = CRUD_CHECKS.every((item) => checked[item.id]);
  const delivery = deliveryQuery.data?.delivery ?? null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(CRUD_CODIGO);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

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
    if (next.size > CRUD_PDF_MAX_BYTES) {
      setFile(null);
      setLocalError("El PDF pesa más de 12 MB. Redúcelo y vuelve a elegirlo.");
      return;
    }
    setFile(next);
  }

  return (
    <section className="glass mb-6 border border-emerald-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">{CRUD_PROGRAMA}</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{CRUD_TITULO}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{CRUD_CONTEXTO}</p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-100">
        {CRUD_PASOS.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-emerald-100">
        Si MySQL pide contraseña, escríbanla en <span className="font-semibold">password</span>. El ejemplo usa la base y
        la tabla que ustedes ya crearon. Para las 5 tablas copian ese archivo, cambian el nombre de la tabla y los
        campos, y dejan la misma función <span className="font-semibold">conectar()</span>.
      </p>
      <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3">
        <p className="text-sm font-bold text-white">Tabla del ejemplo, {CRUD_TABLA_EJEMPLO.nombre}</p>
        <p className="mt-1 text-sm text-slate-300">{CRUD_TABLA_EJEMPLO.uso}</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-100">
          {CRUD_TABLA_EJEMPLO.atributos.map((atributo) => (
            <li key={atributo.campo}>
              <span className="font-semibold">{atributo.campo}</span> {atributo.tipo}
              {atributo.nota ? ` · ${atributo.nota}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-sm font-bold text-white">Las 5 tablas que crea el equipo</p>
        {CRUD_TABLAS.map((tabla) => (
          <div key={tabla.nombre} className="rounded-2xl border border-white/10 px-4 py-3">
            <p className="font-semibold text-emerald-100">{tabla.nombre}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-100">
              {tabla.atributos.map((atributo) => (
                <li key={atributo.campo}>
                  <span className="font-semibold">{atributo.campo}</span> {atributo.tipo}
                  {atributo.nota ? ` · ${atributo.nota}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Ejemplo · solo se conecta</p>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            {copied ? "Copiado" : "Copiar ejemplo"}
          </button>
        </div>
        <pre className="max-h-80 overflow-auto p-3 text-xs leading-relaxed text-emerald-100">{CRUD_CODIGO}</pre>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3">
        <p className="text-sm font-bold text-white">Qué tienes que subir</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-50">
          {CRUD_EVIDENCIAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3">
        <p className="text-sm font-bold text-white">Antes de subir, confirma tu PDF</p>
        <ul className="mt-2 space-y-2">
          {CRUD_CHECKS.map((item) => (
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

      <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3">
        <p className="text-sm font-bold text-white">Subir mis evidencias</p>
        <p className="mt-2 text-sm text-slate-300">
          Equipo {deliveryQuery.data?.teamName ?? "de proyecto"}. Un integrante sube el archivo de todos.
        </p>
        {delivery ? (
          <p className="mt-2 text-sm text-emerald-100">
            Ya está el archivo {delivery.fileName} ({formatCrudSize(delivery.sizeBytes)}), lo subió {delivery.uploadedByName}. Si lo vuelven a subir, reemplaza el anterior.
          </p>
        ) : (
          <p className="mt-2 text-sm text-emerald-100">El equipo todavía no sube el PDF de las 5 tablas.</p>
        )}
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={!ready || uploadMutation.isPending}
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950 disabled:opacity-50"
        />
        {file ? (
          <p className="mt-2 text-sm text-slate-200">
            {file.name} · {formatCrudSize(file.size)}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!ready || !file || uploadMutation.isPending}
          onClick={() => file && uploadMutation.mutate(file)}
          className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          {uploadMutation.isPending ? "Subiendo…" : delivery ? "Reemplazar PDF" : "Subir PDF"}
        </button>
        {!ready ? <p className="mt-2 text-sm text-slate-400">Marca todas las casillas para poder elegir el archivo.</p> : null}
        {localError ? <p className="mt-2 text-sm text-rose-200">{localError}</p> : null}
        {deliveryQuery.isError ? <p className="mt-2 text-sm text-rose-200">{getApiErrorMessage(deliveryQuery.error)}</p> : null}
      </div>
    </section>
  );
}
