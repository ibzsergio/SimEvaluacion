import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCrudSession, getApiErrorMessage, hideCrudSession, releaseCrudSession } from "../lib/api";
import { CRUD_CODIGO, CRUD_CONTEXTO, CRUD_PASOS, CRUD_PROGRAMA, CRUD_TITULO } from "../lib/crudScrum";
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
              ? `¿Liberar TEST para el grupo ${selectedGroup?.code ?? ""}?\n\nCada alumno hace el formulario y el CRUD de 3 tablas en la base 302.`
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
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
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
    </div>
  );
}
