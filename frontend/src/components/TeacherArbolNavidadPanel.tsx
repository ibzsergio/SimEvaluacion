import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { downloadTeacherArbolPdf, fetchTeacherArbol, getApiErrorMessage, setArbolReleased } from "../lib/api";
import { ARBOL_TITULO, formatoHoraArbol } from "../lib/arbolNavidad";
import type { ClassGroup } from "../lib/types";

export default function TeacherArbolNavidadPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
  hideGroupPicker = false,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  hideGroupPicker?: boolean;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const es301 = selectedGroup?.code === "301";
  const query = useQuery({
    queryKey: ["arbol-navidad", selectedGroupId],
    queryFn: () => fetchTeacherArbol(selectedGroupId),
    enabled: !!selectedGroupId && es301,
    refetchInterval: es301 ? 15_000 : false,
  });
  const releaseMutation = useMutation({
    mutationFn: (released: boolean) => setArbolReleased(selectedGroupId, released),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["arbol-navidad", selectedGroupId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const released = query.data?.released ?? false;
  const students = query.data?.students ?? [];
  const conTexto = students.filter((student) => student.text.trim()).length;
  const conPdf = students.filter((student) => student.file).length;

  return (
    <div>
      {hideGroupPicker ? null : (
        <div className="mb-4 flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId ? "border-rose-400/50 bg-rose-500/15 text-rose-100" : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}
      <section className="glass mb-6 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-200">Actividad Scrum · grupo 301</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{ARBOL_TITULO}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Cada alumno del 301 escribe su propuesta del árbol de Navidad que les toca adornar y puede subir las imágenes
          en un solo PDF de máximo 5 MB. No hay calificación. Los alumnos no la ven hasta que pulses Liberar.
        </p>
        {!es301 ? <p className="mt-3 text-sm font-semibold text-amber-100">Esta actividad es solo del grupo 301.</p> : null}
        {es301 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={releaseMutation.isPending || query.isLoading}
              className={`rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${
                released ? "bg-slate-700 text-white" : "bg-rose-400 text-slate-950"
              }`}
              onClick={() => {
                const next = !released;
                const ok = window.confirm(
                  next
                    ? `¿Liberar ${ARBOL_TITULO} para el grupo 301?\n\nCada alumno podrá escribir su propuesta y subir un PDF de imágenes de hasta 5 MB.`
                    : `¿Ocultar ${ARBOL_TITULO}?\n\nLos alumnos dejarán de verla. Lo que ya escribieron se conserva.`,
                );
                if (!ok) return;
                releaseMutation.mutate(next);
              }}
            >
              {releaseMutation.isPending ? "Guardando..." : released ? "Ocultar a los alumnos" : "Liberar actividad"}
            </button>
            <p className="text-sm text-slate-300">
              {released ? "Liberada. Los alumnos del 301 ya la ven." : "Sin liberar. Los alumnos todavía no la ven."}
            </p>
          </div>
        ) : null}
        {es301 && !query.isLoading ? (
          <p className="mt-3 text-sm text-slate-300">
            {conTexto} de {students.length} ya escribieron. {conPdf} subieron PDF.
          </p>
        ) : null}
        {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
      </section>
      {es301 && query.isLoading ? <p className="text-sm text-slate-400">Cargando alumnos...</p> : null}
      {es301 ? (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {students.map((student) => (
            <li key={student.id} className="glass p-4">
              <p className="font-semibold text-white">{student.displayName}</p>
              {student.text.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{student.text}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Sin propuesta.</p>
              )}
              {student.updatedAt ? (
                <p className="mt-1 text-xs text-slate-400">Texto guardado a las {formatoHoraArbol(student.updatedAt)}.</p>
              ) : null}
              {student.file ? (
                <div className="mt-3">
                  <p className="text-sm text-sky-100">
                    PDF de las {formatoHoraArbol(student.file.uploadedAt)} · {student.file.fileName}
                  </p>
                  <button
                    type="button"
                    className="mt-2 rounded-lg bg-sky-400 px-3 py-1 text-xs font-bold text-slate-950"
                    onClick={() =>
                      downloadTeacherArbolPdf(selectedGroupId, student.id, student.file?.fileName ?? "propuesta-arbol.pdf").catch((err) =>
                        setError(getApiErrorMessage(err)),
                      )
                    }
                  >
                    Descargar PDF
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Sin PDF.</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
