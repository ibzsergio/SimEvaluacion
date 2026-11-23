import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  downloadStudentArbolPdf,
  fetchStudentArbol,
  getApiErrorMessage,
  saveStudentArbol,
  uploadStudentArbolPdf,
} from "../lib/api";
import { ARBOL_PDF_MAX_BYTES, ARBOL_TEXTO_MAX, ARBOL_TITULO, formatoHoraArbol, pdfPareceValido } from "../lib/arbolNavidad";

export default function StudentArbolNavidadCard({ groupCode }: { groupCode?: string | null }) {
  const puedeVer = groupCode === "301" || groupCode === "PRUEBA";
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const query = useQuery({
    queryKey: ["student-arbol"],
    queryFn: fetchStudentArbol,
    enabled: puedeVer,
    refetchInterval: puedeVer ? 15_000 : false,
  });
  const data = query.data;
  useEffect(() => {
    if (data && !synced) {
      setText(data.text);
      setSynced(true);
    }
  }, [data, synced]);
  const saveMutation = useMutation({
    mutationFn: () => saveStudentArbol(text),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-arbol"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const uploadMutation = useMutation({
    mutationFn: uploadStudentArbolPdf,
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-arbol"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (!puedeVer || !data?.released || data.groupCode !== "301") return null;
  const puedeEscribir = !data.preview;

  return (
    <section className="glass mb-6 border border-rose-300/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-rose-200">Actividad Scrum · grupo 301</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{ARBOL_TITULO}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-100">
        Escribe tu propuesta del árbol de Navidad que les toca adornar. Cada alumno entrega la suya. También puedes
        subir las imágenes en un solo PDF de máximo 5 MB. Si vuelves a subir el archivo, reemplaza al anterior. Esta
        actividad no pone calificación.
      </p>
      <label className="mt-4 block text-sm font-semibold text-white" htmlFor="arbol-propuesta">
        Tu propuesta
      </label>
      <textarea
        id="arbol-propuesta"
        value={text}
        maxLength={ARBOL_TEXTO_MAX}
        disabled={!puedeEscribir || saveMutation.isPending}
        rows={6}
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white disabled:opacity-60"
        onChange={(event) => setText(event.target.value)}
      />
      <p className="mt-1 text-xs text-slate-400">
        {text.trim().length} / {ARBOL_TEXTO_MAX}
        {data.updatedAt ? ` · Guardada a las ${formatoHoraArbol(data.updatedAt)}` : ""}
      </p>
      <button
        type="button"
        disabled={!puedeEscribir || !text.trim() || saveMutation.isPending}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-rose-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "Guardando..." : "Guardar propuesta"}
      </button>
      <div className="mt-4 rounded-2xl border border-white/10 p-4">
        <p className="text-sm font-semibold text-white">Imágenes en un PDF, máximo 5 MB</p>
        {data.file ? (
          <div className="mt-2">
            <p className="text-sm text-emerald-100">
              Ya está: {data.file.fileName}. Lo subiste a las {formatoHoraArbol(data.file.uploadedAt)}.
            </p>
            <button
              type="button"
              disabled={downloading}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              onClick={() => {
                const fileName = data.file?.fileName ?? "propuesta-arbol.pdf";
                setDownloading(true);
                setError("");
                downloadStudentArbolPdf(fileName)
                  .catch((err) => setError(getApiErrorMessage(err)))
                  .finally(() => setDownloading(false));
              }}
            >
              {downloading ? "Descargando..." : "Descargar PDF"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-amber-100">Todavía no subes el PDF.</p>
        )}
        <label
          className={`mt-3 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-sm ${
            !puedeEscribir || uploadMutation.isPending ? "pointer-events-none opacity-50" : "hover:bg-green-500"
          }`}
        >
          {uploadMutation.isPending ? "Subiendo PDF..." : "Seleccionar archivo"}
          <input
            type="file"
            accept=".pdf,application/pdf"
            disabled={!puedeEscribir || uploadMutation.isPending}
            className="sr-only"
            onChange={(event) => {
              const input = event.target;
              const picked = input.files?.[0];
              if (!picked) return;
              setError("");
              void picked.arrayBuffer().then(
                (bytes) => {
                  input.value = "";
                  if (bytes.byteLength === 0) {
                    setError("No se pudo leer el PDF. Ciérralo si está abierto y vuelve a elegirlo.");
                    return;
                  }
                  if (bytes.byteLength > ARBOL_PDF_MAX_BYTES) {
                    setError("El PDF pesa más de 5 MB. Redúcelo y vuelve a subirlo.");
                    return;
                  }
                  if (!pdfPareceValido(bytes)) {
                    setError("Ese archivo no es un PDF. Sube un solo PDF de máximo 5 MB.");
                    return;
                  }
                  const name = picked.name?.toLowerCase().endsWith(".pdf") ? picked.name : "propuesta-arbol.pdf";
                  uploadMutation.mutate(new File([bytes], name, { type: "application/pdf" }));
                },
                () => {
                  input.value = "";
                  setError("No se pudo leer el PDF. Vuelve a elegirlo.");
                },
              );
            }}
          />
        </label>
        {data.file ? <p className="mt-2 text-sm text-slate-300">Puedes elegir otro PDF para reemplazar el actual.</p> : null}
        {uploadMutation.isPending ? <p className="mt-2 text-sm text-slate-300">Subiendo...</p> : null}
      </div>
      {data.preview ? <p className="mt-3 text-sm text-cyan-100">La cuenta de prueba no envía la propuesta ni el PDF.</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}
