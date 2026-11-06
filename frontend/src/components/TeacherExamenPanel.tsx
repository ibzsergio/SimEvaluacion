import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { downloadExamPdf, fetchGroupStudents, fetchTeacherExamDeliveries, getApiErrorMessage } from "../lib/api";
import {
  EXAMEN_CIERRE_TEXTO,
  EXAMEN_GRUPO,
  EXAMEN_PROGRAMA,
  EXAMEN_REGLAS,
  EXAMEN_TITULO,
  examenAbierto,
  examenEsGrupo,
  formatExamenSize,
} from "../lib/examScrum";
import type { ClassGroup } from "../lib/types";

export default function TeacherExamenPanel({
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
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const es302 = examenEsGrupo(selectedGroup?.code);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const abierto = examenAbierto(now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const studentsQuery = useQuery({
    queryKey: ["group-students", selectedGroupId],
    queryFn: () => fetchGroupStudents(selectedGroupId),
    enabled: !!selectedGroupId && es302,
  });
  const deliveriesQuery = useQuery({
    queryKey: ["examen-deliveries", selectedGroupId],
    queryFn: () => fetchTeacherExamDeliveries(selectedGroupId),
    enabled: !!selectedGroupId && es302,
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
                  ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">{EXAMEN_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{EXAMEN_TITULO}</h2>
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${abierto ? "bg-amber-500/15 text-amber-50" : "bg-rose-500/15 text-rose-100"}`}>
          Grupo {EXAMEN_GRUPO}. {EXAMEN_CIERRE_TEXTO}
          {abierto ? "" : " Esa hora ya pasó."}
        </p>
        {es302 ? (
          <p className="mt-3 text-sm text-slate-300">
            {delivered} de {students.length} alumnos ya subieron su PDF.
          </p>
        ) : (
          <p className="mt-3 text-sm text-amber-100">Esta actividad es solo del grupo 302. El grupo {selectedGroup?.code ?? "seleccionado"} no la sube.</p>
        )}
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        {deliveriesQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(deliveriesQuery.error)}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-amber-300/40 bg-amber-400/10 p-5">
        <h3 className="font-bold text-white">Lo que debe traer el PDF</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-50">
          {EXAMEN_REGLAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {es302
        ? students.map((student) => {
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
                      {file.fileName} · {formatExamenSize(file.sizeBytes)}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-100">Todavía no sube el PDF.</p>
                  )}
                </div>
                {file ? (
                  <button
                    type="button"
                    onClick={() => {
                      downloadExamPdf(selectedGroupId, student.id, file.fileName).catch((err) =>
                        setError(getApiErrorMessage(err)),
                      );
                    }}
                    className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950"
                  >
                    Descargar PDF
                  </button>
                ) : null}
              </section>
            );
          })
        : null}
    </div>
  );
}
