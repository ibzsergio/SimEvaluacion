import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  downloadStudentGlosarioEnglishPdf,
  downloadStudentGlosarioPdf,
  fetchStudentGlosario,
  getApiErrorMessage,
  uploadGlosarioEnglishPdf,
  uploadGlosarioPdf,
} from "../lib/api";
import {
  formatoHoraGlosario,
  glosarioCierre,
  GLOSARIO_PDF_MAX_BYTES,
  GLOSARIO_TITULO,
  glosarioEntrega,
  glosarioTramos,
} from "../lib/glosario";
import { copiarPdf } from "../lib/pdfArchivo";

const CHECKS_EN = [
  { id: "portada", label: "La primera hoja es la portada de Canva, con los datos del equipo, el nombre del proyecto y el título Glosario Bilingüe." },
  { id: "glosario", label: "El glosario está traducido al inglés, con cada palabra clave y su descripción, y va ordenado alfabéticamente." },
  { id: "descripcion", label: "Está la descripción del proyecto en inglés: cómo funciona, para quién es y cuál es su objetivo." },
];

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
  const [checkedEn, setCheckedEn] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [errorEn, setErrorEn] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadingEn, setDownloadingEn] = useState(false);
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
  const englishMutation = useMutation({
    mutationFn: uploadGlosarioEnglishPdf,
    onSuccess: async () => {
      setErrorEn("");
      await queryClient.invalidateQueries({ queryKey: ["student-glosario"] });
    },
    onError: (err) => setErrorEn(getApiErrorMessage(err)),
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
  const readyEn = CHECKS_EN.every((item) => checkedEn[item.id]);
  const puedeSubir = entrega.open && !data?.preview;
  const puedeReemplazar = puedeSubir && Boolean(data?.delivery);
  const puedeIngles = Boolean(data && !data.preview && entrega.open);
  const puedeReemplazarIngles = puedeIngles && Boolean(data?.english);

  return (
    <section className="glass mb-6 border border-teal-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-teal-200">Actividad Scrum · equipo de proyecto</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{GLOSARIO_TITULO}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-100">
        <p>
          El equipo elabora el glosario de la interfaz de su proyecto. Cada entrada es una palabra clave y, aparte, su
          descripción. La primera entrega va en español. Abajo está el apartado para subir el mismo trabajo ya traducido
          al inglés.
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
        <p className="font-bold">
          {code === "301" || code === "302"
            ? `Grupo ${code}. Hasta las 6:00 p. m. del miércoles 25 de noviembre.`
            : `Grupo ${code}. Esta entrega no está abierta.`}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {glosarioTramos(code).map((tramo) => (
            <li key={tramo.until}>{tramo.texto}</li>
          ))}
        </ul>
        <p className="mt-2 font-semibold">{glosarioCierre(code)}</p>
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
          <p className="mt-1 text-sm text-slate-300">
            Lo sube el líder o un integrante. Si se equivocaron de archivo o quieren corregirlo, descárguenlo y vuelvan a
            subirlo mientras la entrega siga abierta. Cuenta la hora del archivo nuevo.
          </p>
          {data.delivery ? (
            <div className="mt-2">
              <p className="text-sm text-emerald-100">
                Ya está: {data.delivery.fileName}. Lo subió {data.delivery.uploadedByName} a las{" "}
                {formatoHoraGlosario(data.delivery.uploadedAt)}. La máxima de esa hora es{" "}
                {data.delivery.points.toLocaleString("es-MX")}. La calificación la publica el docente.
              </p>
              <button
                type="button"
                disabled={downloading}
                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                onClick={() => {
                  const fileName = data.delivery?.fileName ?? "glosario.pdf";
                  setDownloading(true);
                  setError("");
                  downloadStudentGlosarioPdf(fileName)
                    .catch((err) => setError(getApiErrorMessage(err)))
                    .finally(() => setDownloading(false));
                }}
              >
                {downloading ? "Descargando..." : "Descargar PDF"}
              </button>
            </div>
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
            disabled={!(puedeSubir && (ready || puedeReemplazar)) || uploadMutation.isPending}
            className="mt-3 block w-full text-sm text-slate-200 disabled:opacity-50"
            onChange={(event) => {
              const input = event.target;
              const file = input.files?.[0];
              if (!file) return;
              void copiarPdf(file, GLOSARIO_PDF_MAX_BYTES)
                .then((pdf) => {
                  input.value = "";
                  uploadMutation.mutate(pdf);
                })
                .catch((error: unknown) => {
                  input.value = "";
                  setError(error instanceof Error ? error.message : "No se pudo leer el PDF. Vuelve a elegirlo.");
                });
            }}
          />
          {!entrega.open ? <p className="mt-2 text-sm font-semibold text-rose-200">{glosarioCierre(code)}</p> : null}
          {entrega.open && !ready && !puedeReemplazar ? (
            <p className="mt-2 text-sm text-slate-400">Marca las casillas para elegir el archivo.</p>
          ) : null}
          {puedeReemplazar ? (
            <p className="mt-2 text-sm text-slate-300">Pueden elegir otro PDF para reemplazar el actual.</p>
          ) : null}
          {uploadMutation.isPending ? <p className="mt-2 text-sm text-slate-300">Subiendo...</p> : null}
          {error ? <p className="mt-2 text-sm text-rose-200">{error}</p> : null}
        </div>
      ) : query.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Cargando el equipo...</p>
      ) : null}
      <div className="mt-4 rounded-2xl border border-sky-300/30 p-4">
        <p className="text-sm font-semibold text-white">Glosario en inglés, máximo 3 MB</p>
        <p className="mt-1 text-sm text-slate-300">
          Es el mismo trabajo, ya traducido. Un solo PDF: portada, glosario en inglés ordenado alfabéticamente y
          descripción del proyecto. Lo sube el líder o un integrante. Si lo vuelven a subir, reemplaza al anterior. La
          calificación la publica el docente después de revisar el archivo. Los grupos 301 y 302 lo pueden subir
          hasta las 6:00 p. m. del miércoles 25 de noviembre.
        </p>
        {!entrega.open ? (
          <p className="mt-2 text-sm font-semibold text-rose-200">{glosarioCierre(code)}</p>
        ) : null}
        {data?.english ? (
          <div className="mt-2">
            <p className="text-sm text-emerald-100">
              Ya está: {data.english.fileName}. Lo subió {data.english.uploadedByName} a las{" "}
              {formatoHoraGlosario(data.english.uploadedAt)}.
            </p>
            <button
              type="button"
              disabled={downloadingEn}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              onClick={() => {
                const fileName = data.english?.fileName ?? "glosario-ingles.pdf";
                setDownloadingEn(true);
                setErrorEn("");
                downloadStudentGlosarioEnglishPdf(fileName)
                  .catch((err) => setErrorEn(getApiErrorMessage(err)))
                  .finally(() => setDownloadingEn(false));
              }}
            >
              {downloadingEn ? "Descargando..." : "Descargar PDF en inglés"}
            </button>
          </div>
        ) : data && !data.preview ? (
          <p className="mt-2 text-sm text-amber-100">El equipo todavía no sube el PDF en inglés.</p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {CHECKS_EN.map((item) => (
            <li key={item.id}>
              <label className="flex items-start gap-2 text-sm text-slate-100">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(checkedEn[item.id])}
                  disabled={!puedeIngles}
                  onChange={(event) => setCheckedEn((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={!(puedeIngles && (readyEn || puedeReemplazarIngles)) || englishMutation.isPending}
          className="mt-3 block w-full text-sm text-slate-200 disabled:opacity-50"
          onChange={(event) => {
            const input = event.target;
            const file = input.files?.[0];
            if (!file) return;
            void copiarPdf(file, GLOSARIO_PDF_MAX_BYTES)
              .then((pdf) => {
                input.value = "";
                englishMutation.mutate(pdf);
              })
              .catch((error: unknown) => {
                input.value = "";
                setErrorEn(error instanceof Error ? error.message : "No se pudo leer el PDF. Vuelve a elegirlo.");
              });
          }}
        />
        {puedeIngles && !readyEn && !puedeReemplazarIngles ? (
          <p className="mt-2 text-sm text-slate-400">Marca las casillas para elegir el archivo en inglés.</p>
        ) : null}
        {puedeReemplazarIngles ? (
          <p className="mt-2 text-sm text-slate-300">Pueden elegir otro PDF para reemplazar el de inglés.</p>
        ) : null}
        {data?.preview ? <p className="mt-2 text-sm text-cyan-100">La cuenta de prueba no sube este PDF.</p> : null}
        {englishMutation.isPending ? <p className="mt-2 text-sm text-slate-300">Subiendo...</p> : null}
        {errorEn ? <p className="mt-2 text-sm text-rose-200">{errorEn}</p> : null}
      </div>
    </section>
  );
}
