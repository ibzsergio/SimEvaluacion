import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  downloadStudentReporteArchivo,
  fetchStudentReporte,
  getApiErrorMessage,
  saveReporteDia,
  uploadReporteArchivo,
  type ReporteDia,
} from "../lib/api";
import {
  REPORTE_CIERRE_TEXTO,
  REPORTE_DIAS,
  REPORTE_FILE_MAX_BYTES,
  REPORTE_TITULO,
  reporteAbierto,
  reporteDiaInicial,
} from "../lib/reporteProyecto";

type Draft = { doing: Record<string, string>; observation: Record<string, string>; commitsNote: string };

function draftFrom(report: ReporteDia | undefined, members: Array<{ id: string }>): Draft {
  return {
    doing: Object.fromEntries(members.map((member) => [member.id, report?.members.find((item) => item.id === member.id)?.doing ?? ""])),
    observation: Object.fromEntries(
      members.map((member) => [member.id, report?.members.find((item) => item.id === member.id)?.observation ?? ""]),
    ),
    commitsNote: report?.commitsNote ?? "",
  };
}

export default function StudentReporteProyectoCard({ groupCode }: { groupCode?: string | null }) {
  const code = groupCode?.trim();
  const visible = code === "301" || code === "302";
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => reporteDiaInicial());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState("");
  const query = useQuery({
    queryKey: ["student-reporte-proyecto"],
    queryFn: fetchStudentReporte,
    enabled: visible,
    retry: false,
    refetchInterval: visible ? 20_000 : false,
  });
  const saveMutation = useMutation({
    mutationFn: saveReporteDia,
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["student-reporte-proyecto"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (!visible) return null;
  const data = query.data;
  const open = reporteAbierto() && Boolean(data?.open ?? true);
  const report = data?.reports?.[day];
  const members = data?.members ?? [];
  const draft = drafts[day] ?? draftFrom(report, members);
  const puedeEditar = open && Boolean(data?.isLeader) && !data?.preview;

  function updateDraft(next: Draft) {
    setDrafts((prev) => ({ ...prev, [day]: next }));
  }

  async function subir(who: string, file: File | undefined) {
    if (!file || !puedeEditar) return;
    if (file.size > REPORTE_FILE_MAX_BYTES) {
      setError("El archivo pesa más de 4 MB. Redúcelo y vuelve a subirlo.");
      return;
    }
    setUploading(who);
    setError("");
    try {
      await uploadReporteArchivo(day, who, file);
      await queryClient.invalidateQueries({ queryKey: ["student-reporte-proyecto"] });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading("");
    }
  }

  return (
    <section className="glass mb-6 border border-sky-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Actividad Scrum · equipo de proyecto</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{REPORTE_TITULO}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-100">
        <p>
          El líder del proyecto reporta el avance del día. De cada integrante escribe qué está haciendo y sube una
          evidencia. Aparte sube la evidencia de los commits del repositorio. También puede dejar una observación de
          cada integrante: esa observación le llega al docente.
        </p>
        <p>Por ahora esta actividad es solo el reporte diario. La calificación la pone el docente después.</p>
      </div>
      <div className="mt-3 rounded-xl border border-sky-300/40 bg-sky-500/15 p-3 text-sm text-sky-50">
        <p className="font-bold">Grupo {code}. Días hábiles: viernes 20, lunes 23, martes 24 y miércoles 25.</p>
        <p className="mt-2">{REPORTE_CIERRE_TEXTO}</p>
        <p className="mt-2">{open ? "Hoy se puede llenar y corregir cualquier día de ese periodo." : "En este momento el reporte ya no se puede modificar."}</p>
      </div>
      {data?.preview ? (
        <p className="mt-3 text-sm text-cyan-100">
          Vista de prueba. Así leen las instrucciones los alumnos. Esta cuenta no llena el reporte.
        </p>
      ) : null}
      {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      {query.isLoading ? <p className="mt-3 text-sm text-slate-400">Cargando el equipo...</p> : null}
      {data && !data.preview ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {REPORTE_DIAS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDay(item.id)}
                className={`min-h-10 rounded-full px-3 py-1 text-sm font-semibold ${
                  day === item.id ? "bg-sky-400 text-slate-950" : "border border-white/15 text-slate-200"
                }`}
              >
                {item.label}
                {data.today === item.id ? " · hoy" : ""}
              </button>
            ))}
          </div>
          {!data.hasLeader ? (
            <p className="mt-3 text-sm text-amber-100">Este equipo no tiene líder. Pide al docente que lo nombre en Roles / Equipos.</p>
          ) : data.isLeader ? (
            <p className="mt-3 text-sm text-slate-300">Tú eres el líder. Este reporte es del día seleccionado.</p>
          ) : (
            <p className="mt-3 text-sm text-slate-300">Solo el líder llena el reporte. Aquí puedes leer lo que ya guardó.</p>
          )}
          <ul className="mt-4 space-y-3">
            {members.map((member) => {
              const file = report?.members.find((item) => item.id === member.id)?.file ?? null;
              return (
                <li key={member.id} className="rounded-2xl border border-white/10 p-3">
                  <p className="text-sm font-semibold text-white">
                    {member.displayName}
                    {member.isLeader ? " · líder" : ""}
                  </p>
                  <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Qué está haciendo
                    <textarea
                      value={draft.doing[member.id] ?? ""}
                      maxLength={500}
                      disabled={!puedeEditar}
                      onChange={(event) =>
                        updateDraft({ ...draft, doing: { ...draft.doing, [member.id]: event.target.value } })
                      }
                      className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white disabled:opacity-60"
                      rows={2}
                    />
                  </label>
                  <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-amber-100">
                    Observación para el docente
                    <textarea
                      value={draft.observation[member.id] ?? ""}
                      maxLength={400}
                      disabled={!puedeEditar}
                      onChange={(event) =>
                        updateDraft({ ...draft, observation: { ...draft.observation, [member.id]: event.target.value } })
                      }
                      className="mt-1 w-full rounded-lg border border-amber-300/30 bg-slate-950/70 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white disabled:opacity-60"
                      rows={2}
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-300">
                    {file ? `Evidencia: ${file.fileName}` : "Todavía no hay evidencia de este integrante."}
                  </p>
                  {file ? (
                    <button
                      type="button"
                      className="mt-1 text-sm font-semibold text-sky-200"
                      onClick={() =>
                        downloadStudentReporteArchivo(day, member.id, file.fileName).catch((err) => setError(getApiErrorMessage(err)))
                      }
                    >
                      Descargar evidencia
                    </button>
                  ) : null}
                  {puedeEditar ? (
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                      disabled={uploading === member.id}
                      className="mt-2 block w-full text-sm text-slate-200"
                      onChange={(event) => {
                        const fileElegido = event.target.files?.[0];
                        event.target.value = "";
                        void subir(member.id, fileElegido);
                      }}
                    />
                  ) : null}
                  {uploading === member.id ? <p className="mt-1 text-sm text-slate-300">Subiendo evidencia...</p> : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-2xl border border-white/10 p-3">
            <p className="text-sm font-semibold text-white">Commits del repositorio</p>
            <textarea
              value={draft.commitsNote}
              maxLength={300}
              disabled={!puedeEditar}
              placeholder="Qué commits se hicieron este día"
              onChange={(event) => updateDraft({ ...draft, commitsNote: event.target.value })}
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white disabled:opacity-60"
              rows={2}
            />
            <p className="mt-2 text-xs text-slate-300">
              {report?.commitsFile ? `Evidencia: ${report.commitsFile.fileName}` : "Todavía no hay evidencia de los commits."}
            </p>
            {report?.commitsFile ? (
              <button
                type="button"
                className="mt-1 text-sm font-semibold text-sky-200"
                onClick={() =>
                  downloadStudentReporteArchivo(day, "commits", report.commitsFile?.fileName ?? "commits").catch((err) =>
                    setError(getApiErrorMessage(err)),
                  )
                }
              >
                Descargar evidencia de commits
              </button>
            ) : null}
            {puedeEditar ? (
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                disabled={uploading === "commits"}
                className="mt-2 block w-full text-sm text-slate-200"
                onChange={(event) => {
                  const fileElegido = event.target.files?.[0];
                  event.target.value = "";
                  void subir("commits", fileElegido);
                }}
              />
            ) : null}
            {uploading === "commits" ? <p className="mt-1 text-sm text-slate-300">Subiendo evidencia...</p> : null}
          </div>
          {puedeEditar ? (
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({
                  day,
                  commitsNote: draft.commitsNote,
                  members: members.map((member) => ({
                    studentId: member.id,
                    doing: draft.doing[member.id] ?? "",
                    observation: draft.observation[member.id] ?? "",
                  })),
                })
              }
              className="mt-4 min-h-11 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Guardando..." : "Guardar reporte de este día"}
            </button>
          ) : null}
          {error ? <p className="mt-2 text-sm text-rose-200">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
