import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchGroupRanking, updateGroupProgressSettings } from "../lib/api";
import type { ClassGroup } from "../lib/types";

export default function GroupRankingPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const qc = useQueryClient();
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const rankingQuery = useQuery({
    queryKey: ["group-ranking", selectedGroupId],
    queryFn: () => fetchGroupRanking(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const ranking = rankingQuery.data?.ranking ?? [];
  const [plannedText, setPlannedText] = useState(
    selectedGroup?.plannedActivities != null ? String(selectedGroup.plannedActivities) : "",
  );

  useEffect(() => {
    setPlannedText(selectedGroup?.plannedActivities != null ? String(selectedGroup.plannedActivities) : "");
  }, [selectedGroup?.plannedActivities, selectedGroupId]);

  const updateMutation = useMutation({
    mutationFn: (payload: { plannedActivities?: number | null; progressClosed?: boolean }) =>
      updateGroupProgressSettings(selectedGroupId, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
  });

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
          </button>
        ))}
      </div>

      <section className="glass p-6">
        <h2 className="text-lg font-semibold text-white">
          Ranking del grupo {selectedGroup?.code}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {selectedGroup?.shift} · {rankingQuery.data?.activityCount ?? 0} actividad(es) publicada(s)
        </p>
        <p className="mt-2 text-xs text-slate-500">{rankingQuery.data?.rankingRule}</p>

        <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
          <label className="block text-xs text-slate-400 sm:col-span-1">
            Meta de actividades del periodo
            <input
              type="number"
              min={1}
              max={365}
              value={plannedText}
              placeholder="Ej. 20"
              onChange={(e) => setPlannedText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Abierto: avance = calificadas/meta (no llega a 100% hasta cerrar).
            </p>
          </label>

          <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => {
                const trimmed = plannedText.trim();
                updateMutation.mutate({ plannedActivities: trimmed === "" ? null : Number(trimmed) });
              }}
              disabled={updateMutation.isPending}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              Guardar meta
            </button>

            <button
              type="button"
              onClick={() => updateMutation.mutate({ progressClosed: !(selectedGroup?.progressClosed ?? false) })}
              disabled={updateMutation.isPending}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                selectedGroup?.progressClosed
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                  : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {selectedGroup?.progressClosed ? "Reabrir periodo" : "Cerrar periodo"}
            </button>

            <p className="text-xs text-slate-500">
              {selectedGroup?.progressClosed
                ? "Cerrado: el alumno verá porcentaje final (puntos máximos del periodo)."
                : "Abierto: aunque todo esté calificado, no se muestra 100%."}
            </p>
          </div>
        </div>

        {rankingQuery.isLoading ? (
          <p className="mt-6 text-sm text-slate-400">Calculando ranking...</p>
        ) : ranking.length === 0 ? (
          <p className="mt-6 text-sm text-amber-200/90">
            No hay alumnos en este grupo. Importa la lista en la pestaña Alumnos (Excel).
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 w-16">Lugar</th>
                  <th className="px-4 py-3">No. control</th>
                  <th className="px-4 py-3">Alumno</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr key={row.studentId} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <PlaceBadge place={row.place} />
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-300">
                      {row.controlNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {row.listNumber != null ? `${row.listNumber}. ` : ""}
                        {row.displayName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-cyan-300">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PlaceBadge({ place }: { place: number }) {
  const medal =
    place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : null;
  return (
    <span className="inline-flex items-center gap-1 font-bold text-white">
      {medal ? <span className="text-lg">{medal}</span> : null}
      <span>#{place}</span>
    </span>
  );
}
