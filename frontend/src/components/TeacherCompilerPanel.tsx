import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage, updateGroupCompilerSettings } from "../lib/api";
import type { ClassGroup } from "../lib/types";
import PythonCompilerPanel from "./PythonCompilerPanel";

export default function TeacherCompilerPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const qc = useQueryClient();
  const selected = groups.find((g) => g.id === selectedGroupId);

  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      for (const group of groups) {
        await updateGroupCompilerSettings(group.id, { released: next });
      }
      return next;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const releasedCount = groups.filter((g) => g.compilerReleased).length;
  const allOn = groups.length > 0 && releasedCount === groups.length;
  const codes = groups.map((g) => g.code).join(" y ");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectGroup(g.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              g.id === selectedGroupId
                ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100"
                : "border-white/10 bg-white/5 text-slate-300"
            }`}
          >
            Grupo {g.code}
            {g.compilerReleased ? " · activo" : ""}
          </button>
        ))}
      </div>

      <section className="glass mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Alumnos</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Compilador en su pantalla</h2>
            <p className="mt-1 text-sm text-slate-400">
              Tú siempre lo ves aquí. Los alumnos de {codes || "tus grupos"} solo lo ven cuando lo
              activas (prácticas en el aula).
            </p>
          </div>
          <button
            type="button"
            disabled={toggleMutation.isPending || groups.length === 0}
            onClick={() => {
              const next = !allOn;
              if (next) {
                const ok = window.confirm(
                  `¿Activar el compilador Python para los alumnos de ${codes}?`,
                );
                if (!ok) return;
              }
              toggleMutation.mutate(next);
            }}
            className={`min-h-11 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60 ${
              allOn
                ? "border border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                : "bg-emerald-600 text-[#ffffff] hover:bg-emerald-500"
            }`}
          >
            {toggleMutation.isPending
              ? "Guardando…"
              : allOn
                ? "Desactivar para alumnos"
                : "Activar para alumnos"}
          </button>
        </div>
        {toggleMutation.isError ? (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {getApiErrorMessage(toggleMutation.error)}
          </p>
        ) : allOn ? (
          <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Activo — los alumnos ya pueden usar el compilador en su cuenta.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {releasedCount > 0
              ? `Parcialmente activo (${releasedCount} de ${groups.length} grupos). Pulsa Activar para abrirlo en todos.`
              : `Oculto para los alumnos. Grupo ${selected?.code ?? "—"} y el resto no lo ven.`}
          </p>
        )}
      </section>

      <PythonCompilerPanel />
    </div>
  );
}
