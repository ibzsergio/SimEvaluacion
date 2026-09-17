import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGroupDeliveryStatus, getApiErrorMessage } from "../lib/api";
import { formatCalendarDate, getActivityKindLabel } from "../lib/dates";
import type { ClassGroup } from "../lib/types";

type FilterMode = "all" | "overdue" | "pending" | "incomplete";

export default function GroupDeliveryStatusPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const query = useQuery({
    queryKey: ["delivery-status", selectedGroupId],
    queryFn: () => fetchGroupDeliveryStatus(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const filteredRows = useMemo(() => {
    const rows = query.data?.rows ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "overdue" && row.summary.overdue === 0) return false;
      if (filter === "pending" && row.summary.pending === 0) return false;
      if (
        filter === "incomplete" &&
        row.summary.pending === 0 &&
        row.summary.overdue === 0
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.student.displayName.toLowerCase().includes(q) ||
        (row.student.controlNumber ?? "").includes(q) ||
        String(row.student.listNumber ?? "").includes(q)
      );
    });
  }, [query.data, search, filter]);

  if (!selectedGroupId) {
    return <p className="text-slate-400">Selecciona un grupo.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
        <h2 className="text-lg font-semibold text-white">Historial de entregas</h2>
        <p className="mt-1 text-sm text-slate-400">
          Vista general del grupo: qué actividades ya tienen calificación (entregadas) y cuáles
          faltan. Verde = calificada · Ámbar = pendiente · Rojo = vencida sin calificar.
        </p>

        {query.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p>
        ) : null}

        {query.data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Alumnos" value={query.data.totals.students} />
            <Stat label="Actividades" value={query.data.totals.activities} />
            <Stat label="Al día (todas)" value={query.data.totals.fullyComplete} tone="ok" />
            <Stat label="Con vencidas" value={query.data.totals.withOverdue} tone="bad" />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar alumno..."
            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-sm text-white placeholder:text-slate-500"
          />
          {(
            [
              ["all", "Todos"],
              ["incomplete", "Con pendientes"],
              ["overdue", "Con vencidas"],
              ["pending", "Con pendientes a tiempo"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                filter === id
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {query.isLoading ? (
        <p className="text-slate-400">Cargando historial...</p>
      ) : !query.data?.activities.length ? (
        <section className="glass p-6 text-sm text-slate-400">
          Aún no hay actividades publicadas en este grupo.
        </section>
      ) : (
        <section className="glass overflow-hidden p-0">
          <div className="max-h-[75vh] overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-slate-950/95 text-left text-[11px] uppercase tracking-wide text-slate-400 backdrop-blur">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-950/95 px-3 py-3 min-w-[200px]">
                    Alumno
                  </th>
                  <th className="px-2 py-3 text-center min-w-[72px]">Avance</th>
                  {query.data.activities.map((a) => (
                    <th key={a.id} className="px-2 py-3 text-center min-w-[88px] align-bottom">
                      <div className="font-semibold text-cyan-200/90">
                        {getActivityKindLabel(a.index, a.name)}
                      </div>
                      <div className="mt-0.5 normal-case tracking-normal text-[10px] text-slate-500">
                        {formatCalendarDate(a.date)}
                      </div>
                      <div
                        className="mt-1 max-w-[100px] truncate normal-case tracking-normal text-[10px] text-slate-400"
                        title={a.name}
                      >
                        {a.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.student.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="sticky left-0 z-10 bg-slate-950/90 px-3 py-2 backdrop-blur">
                      <p className="font-medium text-white">{row.student.displayName}</p>
                      <p className="text-[11px] text-slate-500">
                        Lista #{row.student.listPosition}
                        {row.summary.overdue > 0 ? (
                          <span className="ml-1 text-rose-300">
                            · {row.summary.overdue} vencida(s)
                          </span>
                        ) : row.summary.pending > 0 ? (
                          <span className="ml-1 text-amber-300">
                            · {row.summary.pending} pendiente(s)
                          </span>
                        ) : (
                          <span className="ml-1 text-emerald-300">· al día</span>
                        )}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`text-xs font-bold ${
                          row.summary.deliveryPercent === 100
                            ? "text-emerald-300"
                            : row.summary.overdue > 0
                              ? "text-rose-300"
                              : "text-amber-200"
                        }`}
                      >
                        {row.summary.graded}/{row.summary.total}
                      </span>
                      <div className="mx-auto mt-1 h-1.5 w-14 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${row.summary.deliveryPercent}%` }}
                        />
                      </div>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.activityId} className="px-1 py-2 text-center">
                        <StatusChip
                          status={cell.status}
                          points={cell.points}
                          maxPoints={cell.maxPoints}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? (
              <p className="p-4 text-sm text-slate-500">Sin alumnos con ese filtro.</p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "ok" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusChip({
  status,
  points,
  maxPoints,
}: {
  status: "graded" | "pending" | "overdue";
  points: number | null;
  maxPoints: number;
}) {
  if (status === "graded") {
    return (
      <span
        className="inline-flex min-w-[3.25rem] items-center justify-center rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-200"
        title={`Calificada: ${points} / ${maxPoints}`}
      >
        {points}/{maxPoints}
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span
        className="inline-flex min-w-[3.25rem] items-center justify-center rounded-lg bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-200"
        title="Vencida sin calificar"
      >
        Vencida
      </span>
    );
  }
  return (
    <span
      className="inline-flex min-w-[3.25rem] items-center justify-center rounded-lg bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200"
      title="Pendiente de calificar"
    >
      Pend.
    </span>
  );
}
