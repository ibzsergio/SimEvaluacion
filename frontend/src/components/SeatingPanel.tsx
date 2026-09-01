import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchSeatingPlan, getApiErrorMessage, shuffleSeatingPlan } from "../lib/api";
import { todayLocalIso } from "../lib/dates";
import type { ClassGroup, SeatingCell, SeatingMode, SeatingPlan, SeatingTheme } from "../lib/types";

const COLUMN_LABELS = ["A", "B", "C", "D", "E", "F"];

const MODE_OPTIONS: Array<{
  id: SeatingMode;
  label: string;
  hint: string;
  buttonLabel: string;
}> = [
  {
    id: "random",
    label: "Al azar total",
    hint: "Mezcla alumnos y butacas por completo — máxima sorpresa cada día.",
    buttonLabel: "Asignar al azar",
  },
  {
    id: "alphabetical",
    label: "Orden de lista",
    hint: "Lista alfabética (#1 frente-izquierda, #2 al lado, etc.).",
    buttonLabel: "Asignar por lista",
  },
  {
    id: "alphabetical_snake",
    label: "Lista en zigzag",
    hint: "Lista A→Z pero las filas alternan dirección (como un serpiente).",
    buttonLabel: "Asignar en zigzag",
  },
  {
    id: "by_ranking",
    label: "Por ranking",
    hint: "Quienes tienen más puntos van al frente; el resto sigue en orden de ranking.",
    buttonLabel: "Asignar por ranking",
  },
  {
    id: "shuffle_rows",
    label: "Mezcla por filas",
    hint: "Bloques de 6 alumnos (por lista) se mezclan entre sí; las filas quedan equilibradas.",
    buttonLabel: "Mezclar por filas",
  },
  {
    id: "column_teams",
    label: "Equipos por columna",
    hint: "Se forman 6 equipos al azar; cada columna es un equipo (mismo color).",
    buttonLabel: "Formar equipos",
  },
];

const THEME_OPTIONS: Array<{ id: SeatingTheme; label: string; hint: string }> = [
  {
    id: "column_colors",
    label: "Color por columna",
    hint: "Cada columna tiene un color fijo. Los alumnos buscan su lugar por fila y color.",
  },
  {
    id: "random_colors",
    label: "Colores sorpresa",
    hint: "Cada alumno recibe un color al azar — ideal para dinámicas distintas cada día.",
  },
  {
    id: "row_colors",
    label: "Color por fila",
    hint: "Toda una fila comparte el mismo color (frente, medio, atrás).",
  },
  {
    id: "team_pairs",
    label: "Parejas de columnas",
    hint: "Columnas A+B, C+D y E+F comparten color — útil para trabajar en parejas.",
  },
];

export default function SeatingPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayLocalIso());
  const [mode, setMode] = useState<SeatingMode>("random");
  const [theme, setTheme] = useState<SeatingTheme>("column_colors");
  const [error, setError] = useState("");

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const query = useQuery({
    queryKey: ["seating", selectedGroupId, date],
    queryFn: () => fetchSeatingPlan(selectedGroupId, date),
    enabled: !!selectedGroupId,
  });

  const plan = query.data;

  useEffect(() => {
    if (!plan) return;
    setMode(plan.mode);
    setTheme(plan.theme);
  }, [plan?.mode, plan?.theme, plan?.updatedAt]);

  const shuffleMutation = useMutation({
    mutationFn: () => shuffleSeatingPlan(selectedGroupId, date, { mode, theme }),
    onSuccess: async () => {
      setError("");
      await qc.invalidateQueries({ queryKey: ["seating", selectedGroupId, date] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const loadError =
    error || (query.isError ? getApiErrorMessage(query.error) : "");

  const selectedMode = MODE_OPTIONS.find((m) => m.id === mode) ?? MODE_OPTIONS[0]!;

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Acomodo de butacas 6×6</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Elige cómo colocar a los alumnos y qué colores verán en su app. Solo tú ves el aula
              completa; ellos solo ven su lugar del día.
            </p>
          </div>
          <label className="block text-xs text-slate-400">
            Fecha de clase
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
          </label>
        </div>

        <div className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Modo de acomodo
            </legend>
            <div className="flex flex-wrap gap-2">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${
                    mode === opt.id
                      ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{selectedMode.hint}</p>
          </fieldset>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dinámica visual
              </legend>
              <div className="flex flex-wrap gap-2">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${
                      theme === opt.id
                        ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <span className="font-semibold">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {THEME_OPTIONS.find((t) => t.id === theme)?.hint}
              </p>
            </fieldset>

            <button
              type="button"
              disabled={shuffleMutation.isPending || query.isLoading}
              onClick={() => shuffleMutation.mutate()}
              className="h-fit rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-60"
            >
              {shuffleMutation.isPending ? "Asignando..." : `🎲 ${selectedMode.buttonLabel}`}
            </button>
          </div>
        </div>

        {loadError ? (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {loadError}
          </p>
        ) : null}

        {plan?.overflow ? (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Hay {plan.studentCount} alumnos pero solo {plan.capacity} butacas. Los últimos en el
            sorteo quedarán sin lugar asignado.
          </p>
        ) : null}

        {query.isLoading ? (
          <p className="mt-6 text-slate-400">Cargando aula...</p>
        ) : plan ? (
          <SeatingGrid plan={plan} groupCode={selectedGroup?.code ?? ""} />
        ) : null}
      </section>
    </div>
  );
}

function SeatingGrid({ plan, groupCode }: { plan: SeatingPlan; groupCode: string }) {
  const byRow = new Map<number, SeatingCell[]>();
  for (const cell of plan.grid) {
    const row = byRow.get(cell.row) ?? [];
    row.push(cell);
    byRow.set(cell.row, row);
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          Grupo {groupCode} · {plan.assignedCount}/{plan.studentCount} con lugar ·{" "}
          <span className="text-slate-300">{plan.modeLabel}</span>
          {plan.updatedAt ? (
            <span className="text-slate-500">
              {" "}
              · Actualizado{" "}
              {new Date(plan.updatedAt).toLocaleString("es-MX", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5">Frente ↓</span>
      </div>

      <div className="mb-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 py-2 text-center text-xs font-bold uppercase tracking-widest text-cyan-200">
        Pizarron / Docente
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-1 grid grid-cols-6 gap-2 px-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {COLUMN_LABELS.map((label) => (
              <span key={label}>Col. {label}</span>
            ))}
          </div>

          {Array.from({ length: plan.rows }, (_, i) => i + 1).map((row) => (
            <div key={row} className="mb-2 grid grid-cols-6 gap-2">
              {(byRow.get(row) ?? [])
                .sort((a, b) => a.col - b.col)
                .map((cell) => (
                  <SeatCell key={`${cell.row}-${cell.col}`} cell={cell} />
                ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Cada celda es un asiento (#1 frente-izquierda hasta #36 atrás-derecha). Los alumnos ven su
        color y posición en su app al iniciar sesión.
      </p>
    </div>
  );
}

function SeatCell({ cell }: { cell: SeatingCell }) {
  const filled = !cell.empty && cell.student;
  const border = filled && cell.color ? cell.color : "rgba(255,255,255,0.12)";
  const bg = filled && cell.color ? `${cell.color}22` : "rgba(15,23,42,0.5)";

  return (
    <div
      className="flex min-h-[72px] flex-col justify-between rounded-xl border-2 p-2 text-xs transition"
      style={{ borderColor: border, backgroundColor: bg }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-[10px] text-slate-500">#{cell.seatNumber}</span>
        {filled && cell.colorName ? (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-900"
            style={{ backgroundColor: cell.color ?? "#94a3b8" }}
          >
            {cell.colorName.slice(0, 6)}
          </span>
        ) : null}
      </div>
      {filled ? (
        <div className="min-w-0">
          <p className="truncate font-semibold text-white" title={cell.student!.displayName}>
            {cell.student!.displayName}
          </p>
          <p className="text-[10px] text-slate-400">Lista #{cell.student!.listPosition}</p>
        </div>
      ) : (
        <p className="text-[10px] text-slate-600">Libre</p>
      )}
    </div>
  );
}
