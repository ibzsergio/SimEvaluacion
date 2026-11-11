import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  downloadCrudPdf,
  fetchCrudSession,
  fetchGroupStudents,
  fetchTeacherCrudDeliveries,
  getApiErrorMessage,
  hideCrudSession,
  releaseCrudSession,
} from "../lib/api";
import { CRUD_CODIGO, CRUD_CONTEXTO, CRUD_EVIDENCIAS, CRUD_PASOS, CRUD_PROGRAMA, CRUD_TITULO, formatCrudSize } from "../lib/crudScrum";
import type { ClassGroup } from "../lib/types";

export default function TeacherCrudPanel({
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
  const [downloadError, setDownloadError] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const sessionQuery = useQuery({
    queryKey: ["crud-session", selectedGroupId],
    queryFn: () => fetchCrudSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => (next ? releaseCrudSession(selectedGroupId) : hideCrudSession(selectedGroupId)),
    onSuccess: (data) => {
      qc.setQueryData(["crud-session", selectedGroupId], data);
    },
  });
  const released = sessionQuery.data?.released ?? false;
  const studentsQuery = useQuery({
    queryKey: ["group-students", selectedGroupId],
    queryFn: () => fetchGroupStudents(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const deliveriesQuery = useQuery({
    queryKey: ["crud-deliveries", selectedGroupId],
    queryFn: () => fetchTeacherCrudDeliveries(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 10_000,
  });
  const students = [...(studentsQuery.data?.students ?? [])].sort((a, b) => {
    const left = a.listNumber ?? 999;
    const right = b.listNumber ?? 999;
    if (left !== right) return left - right;
    return a.displayName.localeCompare(b.displayName, "es");
  });
  const byStudent = new Map((deliveriesQuery.data?.deliveries ?? []).map((item) => [item.studentId, item]));
  const delivered = students.filter((student) => byStudent.has(student.id)).length;

  return (
    <div className="space-y-4">
      {hideGroupPicker ? null : (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">{CRUD_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{CRUD_TITULO}</h2>
        <p className="mt-2 text-sm text-slate-300">{CRUD_CONTEXTO}</p>
        <p className="mt-3 text-sm font-semibold text-emerald-100">
          Grupo {selectedGroup?.code ?? "—"} · individual · base 302 · 3 tablas
        </p>
        <button
          type="button"
          disabled={!selectedGroupId || releaseMutation.isPending}
          onClick={() => {
            const next = !released;
            const question = next
              ? `¿Liberar TEST para el grupo ${selectedGroup?.code ?? ""}?\n\nEl ejemplo es la tabla test. Cada alumno sube un PDF con el CRUD de otras 3 tablas.`
              : "¿Ocultar TEST para este grupo?";
            if (!window.confirm(question)) return;
            releaseMutation.mutate(next);
          }}
          className={`mt-4 rounded-xl px-4 py-2 text-sm font-bold ${
            released ? "bg-slate-700 text-white" : "bg-emerald-500 text-slate-950"
          }`}
        >
          {released ? "Ocultar a los alumnos" : "Liberar a los alumnos"}
        </button>
        <p className="mt-3 text-sm text-slate-300">
          {delivered} de {students.length} alumnos ya subieron su PDF.
        </p>
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
        {downloadError ? <p className="mt-3 text-sm text-rose-200">{downloadError}</p> : null}
        {deliveriesQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(deliveriesQuery.error)}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5">
        <h3 className="text-lg font-bold text-white">Qué tienen que subir</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">
          {CRUD_EVIDENCIAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5">
        <h3 className="text-lg font-bold text-white">Lo que hace cada alumno</h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-100">
          {CRUD_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-3 text-xs leading-relaxed text-emerald-100">
          {CRUD_CODIGO}
        </pre>
      </section>

      {students.map((student) => {
        const file = byStudent.get(student.id);
        return (
          <section key={student.id} className="glass flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold text-white">
                {student.listNumber != null ? `${student.listNumber}. ` : ""}
                {student.displayName}
              </p>
              {file ? (
                <p className="text-sm text-emerald-100">
                  {file.fileName} · {formatCrudSize(file.sizeBytes)}
                </p>
              ) : (
                <p className="text-sm text-slate-400">Todavía no sube el PDF.</p>
              )}
            </div>
            {file ? (
              <button
                type="button"
                onClick={() => {
                  downloadCrudPdf(selectedGroupId, student.id, file.fileName).catch((err) =>
                    setDownloadError(getApiErrorMessage(err)),
                  );
                }}
                className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
              >
                Descargar PDF
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
