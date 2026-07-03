import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { closeCurrentGroupWeek, fetchGroupWeeks, fetchPartialSummary, updateGroupPartialSettings } from "../lib/api";
import { ExemptionBadge } from "./ExemptionBadge";
import type { ClassGroup, GroupWeekRow, PartialSummaryRow } from "../lib/types";

export default function WeeklyWinnersPanel({
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

  const weeksQuery = useQuery({
    queryKey: ["group-weeks", selectedGroupId],
    queryFn: () => fetchGroupWeeks(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const partialQuery = useQuery({
    queryKey: ["partial-summary", selectedGroupId],
    queryFn: () => fetchPartialSummary(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const closeMutation = useMutation({
    mutationFn: () => closeCurrentGroupWeek(selectedGroupId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["group-weeks", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["partial-summary", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const partialMutation = useMutation({
    mutationFn: (partialClosed: boolean) => updateGroupPartialSettings(selectedGroupId, { partialClosed }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["group-weeks", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["partial-summary", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
  });

  const partialClosed = selectedGroup?.partialClosed ?? false;
  const weeks = weeksQuery.data?.weeks ?? [];

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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Semanas (lun–vie)</h2>
            <p className="mt-1 text-sm text-slate-400">
              Grupo {selectedGroup?.code} · {selectedGroup?.shift}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Cierra la semana para guardar el 1er lugar y su puntaje.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => closeMutation.mutate()}
              disabled={partialClosed || closeMutation.isPending || !selectedGroupId}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {closeMutation.isPending ? "Cerrando..." : "Cerrar semana actual"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!partialClosed) {
                  const ok = window.confirm(
                    "¿Cerrar el parcial?\n\nLos alumnos podrán descargar e imprimir su diploma personalizado (PDF).\nYa no podrás cerrar semanas hasta que reabras el parcial.",
                  );
                  if (!ok) return;
                }
                partialMutation.mutate(!partialClosed);
              }}
              disabled={partialMutation.isPending || !selectedGroupId}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                partialClosed
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                  : "border-rose-400/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {partialMutation.isPending
                ? "Guardando..."
                : partialClosed
                  ? "Reabrir parcial"
                  : "Finalizar parcial y habilitar diplomas"}
            </button>
          </div>
        </div>

        {partialClosed ? (
          <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Parcial finalizado: los alumnos ya pueden descargar su diploma (PDF). Los resultados del
            ranking quedan congelados.
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-indigo-400/25 bg-indigo-500/5 px-3 py-2 text-xs text-slate-400">
            Cuando termines de calificar todas las actividades, usa{" "}
            <strong className="text-indigo-200">Finalizar parcial y habilitar diplomas</strong> para que
            cada alumno imprima su reconocimiento con su lugar en el ranking.
          </p>
        )}

        {weeksQuery.isLoading ? (
          <p className="mt-6 text-sm text-slate-400">Cargando semanas...</p>
        ) : (
          <WeeksTable weeks={weeks} />
        )}
      </section>

      <section className="glass mt-6 p-6">
        <h2 className="text-lg font-semibold text-white">Resumen del parcial</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ranking final · Top 10: EXENTADO · 11–20: PUEDES EXENTAR · Resto: NO DECAIGAS
        </p>

        {partialQuery.isLoading ? (
          <p className="mt-6 text-sm text-slate-400">Cargando resumen...</p>
        ) : (
          <PartialTable rows={partialQuery.data?.rows ?? []} />
        )}
      </section>
    </div>
  );
}

function WeeksTable({ weeks }: { weeks: GroupWeekRow[] }) {
  if (!weeks.length) {
    return <p className="mt-6 text-sm text-slate-500">Aún no hay semanas registradas.</p>;
  }
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Semana</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">1er lugar</th>
            <th className="px-4 py-3 text-right">Puntaje</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.id} className="border-t border-white/5">
              <td className="px-4 py-3 text-slate-200">
                {formatDate(w.weekStart)} — {formatDate(w.weekEnd)}
              </td>
              <td className="px-4 py-3 text-xs">
                {w.closedAt ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-bold text-emerald-200">
                    Cerrada
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 font-bold text-amber-200">
                    Abierta
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-white">
                {w.winner ? (
                  <>
                    {w.winner.listNumber != null ? `${w.winner.listNumber}. ` : ""}
                    {w.winner.displayName}
                  </>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-bold text-cyan-300">
                {w.winner ? w.winner.score : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartialTable({ rows }: { rows: PartialSummaryRow[] }) {
  if (!rows.length) {
    return <p className="mt-6 text-sm text-slate-500">Sin alumnos.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 w-16">Lugar</th>
            <th className="px-4 py-3">No. control</th>
            <th className="px-4 py-3">Alumno</th>
            <th className="px-4 py-3">Estatus</th>
            <th className="px-4 py-3 text-right">Puntos (total)</th>
            <th className="px-4 py-3 text-right">Semanas #1</th>
            <th className="px-4 py-3 text-right">Suma puntaje #1</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const place = r.place;
            const inTop10 = place <= 10;
            return (
            <tr
              key={r.studentId}
              className={`border-t border-white/5 ${inTop10 ? "bg-emerald-500/5" : place <= 20 ? "bg-cyan-500/5" : ""}`}
            >
              <td className="px-4 py-3 font-bold text-white">
                {place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : `#${place}`}
              </td>
              <td className="px-4 py-3 font-mono text-cyan-300">{r.controlNumber ?? "—"}</td>
              <td className="px-4 py-3 text-white">
                {r.listNumber != null ? `${r.listNumber}. ` : ""}
                {r.displayName}
              </td>
              <td className="px-4 py-3">
                <ExemptionBadge exemption={r.exemption} />
              </td>
              <td className="px-4 py-3 text-right font-bold text-cyan-300">{r.totalPoints}</td>
              <td className="px-4 py-3 text-right font-bold text-amber-200">{r.weeksWon}</td>
              <td className="px-4 py-3 text-right font-bold text-amber-200">{r.weeklyWinnerScoreSum}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  // `weekStart`/`weekEnd` vienen de columnas DATE (sin hora). Para evitar corrimientos por zona horaria,
  // formateamos en UTC.
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

