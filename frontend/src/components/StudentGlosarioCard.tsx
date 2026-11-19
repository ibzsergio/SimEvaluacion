import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchStudentGlosario, getApiErrorMessage, uploadGlosarioPdf } from "../lib/api";
import {
  formatoHoraGlosario,
  GLOSARIO_CIERRE,
  GLOSARIO_PDF_MAX_BYTES,
  GLOSARIO_TITULO,
  glosarioEntrega,
  glosarioTramos,
} from "../lib/glosario";

const CHECKS = [
  { id: "caratula", label: "La primera hoja es la carátula de Canva, con los datos del equipo, el nombre del proyecto y el título Glosario Bilingüe." },
  { id: "glosario", label: "El glosario trae cada palabra clave de la interfaz y, aparte, su descripción. Está en español." },
  { id: "reporte", label: "Está el reporte general: cómo funciona la aplicación, para quién está dirigida, el objetivo y lo demás que la explique." },
  { id: "integrantes", label: "Se indica qué hizo cada integrante." },
];

export default function StudentGlosarioCard({ groupCode }: { groupCode?: string | null }) {
  const code = groupCode?.trim();
  const visible = code === "301" || code === "302";
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["student-glosario"],
    queryFn: fetchStudentGlosario,
    enabled: visible,
    retry: false,
    refetchInterval: visible ? 15_000 : false,
  });
  const uploadMutation = useMutation({
    mutationFn: uploadGlosarioPdf,
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["student-glosario"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;
  const data = query.data;
  const entrega = glosarioEntrega(code, now);
  const ready = CHECKS.every((item) => checked[item.id]);
  const puedeSubir = entrega.open && !data?.preview;

  return (
    <section className="glass mb-6 border border-teal-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-teal-200">Actividad Scrum · equipo de proyecto</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{GLOSARIO_TITULO}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-100">
        <p>
          El equipo elabora el glosario de la interfaz de su proyecto. Cada entrada es una palabra clave y, aparte, su
          descripción. En esta entrega va solo en español. La traducción al inglés se hace después, en la asignatura.
        </p>
        <p>
          En el mismo archivo agregan el reporte general del sistema: cómo funciona la aplicación, para quién está
          dirigida, cuál es su objetivo y lo demás que la explique. Ese reporte servirá para la difusión institucional
          y, más adelante, se podrá presentar en inglés.
        </p>
        <p>
          Todo va en un solo PDF, de máximo 3 MB. Primero la carátula de Canva, con los datos del equipo, el nombre del
          proyecto y el título Glosario Bilingüe. Después el glosario y el reporte, indicando qué hizo cada integrante.
        </p>
      </div>
      <div className="mt-3 rounded-xl border border-rose-300/40 bg-rose-500/15 p-3 text-sm text-rose-50">
        <p className="font-bold">Grupo {code}. Hoy, jueves 19 de noviembre.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {glosarioTramos(code).map((tramo) => (
            <li key={tramo.until}>{tramo.texto}</li>
          ))}
        </ul>
        <p className="mt-2 font-semibold">{GLOSARIO_CIERRE}</p>
        <p className="mt-2">
          {entrega.open
            ? `Si suben el PDF en este momento, la máxima es ${entrega.points.toLocaleString("es-MX")}. La calificación la publica el docente después de revisar el archivo.`
            : "En este momento ya no se acepta el PDF."}
        </p>
      </div>
      {data?.preview ? (
        <p className="mt-3 text-sm text-cyan-100">
          Vista de prueba. Así leen las instrucciones los alumnos. Esta cuenta no sube el PDF.
        </p>
      ) : null}
      {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      {data && !data.preview ? (
        <div className="mt-4 rounded-2xl border border-white/10 p-4">
          <p className="text-sm font-semibold text-white">PDF del equipo, máximo 3 MB</p>
          <p className="mt-1 text-sm text-slate-300">Lo sube el líder o un integrante. Si lo vuelven a subir, cuenta la hora del archivo nuevo.</p>
          {data.delivery ? (
            <p className="mt-2 text-sm text-emerald-100">
              Ya está: {data.delivery.fileName}. Lo subió {data.delivery.uploadedByName} a las{" "}
              {formatoHoraGlosario(data.delivery.uploadedAt)}. La máxima de esa hora es{" "}
              {data.delivery.points.toLocaleString("es-MX")}. La calificación la publica el docente.
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-100">El equipo todavía no sube el PDF.</p>
          )}
          <ul className="mt-3 space-y-2">
            {CHECKS.map((item) => (
              <li key={item.id}>
                <label className="flex items-start gap-2 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(checked[item.id])}
                    disabled={!puedeSubir}
                    onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={!puedeSubir || !ready || uploadMutation.isPending}
            className="mt-3 block w-full text-sm text-slate-200 disabled:opacity-50"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > GLOSARIO_PDF_MAX_BYTES) {
                setError("El PDF pesa más de 3 MB. Redúcelo y vuelve a subirlo.");
                return;
              }
              uploadMutation.mutate(file);
            }}
          />
          {!entrega.open ? <p className="mt-2 text-sm font-semibold text-rose-200">{GLOSARIO_CIERRE}</p> : null}
          {entrega.open && !ready ? <p className="mt-2 text-sm text-slate-400">Marca las casillas para elegir el archivo.</p> : null}
          {uploadMutation.isPending ? <p className="mt-2 text-sm text-slate-300">Subiendo...</p> : null}
          {error ? <p className="mt-2 text-sm text-rose-200">{error}</p> : null}
        </div>
      ) : query.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Cargando el equipo...</p>
      ) : null}
    </section>
  );
}
