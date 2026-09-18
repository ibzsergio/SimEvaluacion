import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGroupStudents, getApiErrorMessage, type GroupStudent } from "../lib/api";
import {
  activityKind,
  buildRouletteDeck,
  energyLabel,
  filterActivities,
  formationLabel,
  kindLabel,
  sliceColor,
  wheelLabel,
  type IcebreakerActivity,
  type IcebreakerEnergy,
  type IcebreakerFormation,
  type IcebreakerKind,
} from "../lib/icebreakers";
import type { ClassGroup } from "../lib/types";

function FormationDiagram({ formation }: { formation: IcebreakerFormation }) {
  const common = "stroke-cyan-300/80 fill-cyan-400/25";
  if (formation === "circulo") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        <circle cx="60" cy="60" r="38" className="fill-none stroke-white/20" strokeWidth="2" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          return (
            <circle
              key={i}
              cx={60 + Math.cos(a) * 38}
              cy={60 + Math.sin(a) * 38}
              r="5"
              className={common}
            />
          );
        })}
        <circle cx="60" cy="60" r="8" className="fill-amber-300/40 stroke-amber-200/70" strokeWidth="1.5" />
      </svg>
    );
  }
  if (formation === "parejas") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        {[0, 1, 2, 3].map((row) =>
          [0, 1].map((col) => {
            const x = 28 + col * 52;
            const y = 22 + row * 24;
            return (
              <g key={`${row}-${col}`}>
                <circle cx={x} cy={y} r="6" className={common} />
                <circle cx={x + 16} cy={y} r="6" className={common} />
                <line x1={x + 6} y1={y} x2={x + 10} y2={y} className="stroke-emerald-300/70" strokeWidth="2" />
              </g>
            );
          }),
        )}
      </svg>
    );
  }
  if (formation === "trios") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        {[0, 1].map((row) =>
          [0, 1].map((col) => {
            const bx = 28 + col * 55;
            const by = 30 + row * 50;
            return (
              <g key={`${row}-${col}`}>
                <circle cx={bx} cy={by} r="6" className={common} />
                <circle cx={bx + 18} cy={by} r="6" className={common} />
                <circle cx={bx + 9} cy={by + 16} r="6" className={common} />
              </g>
            );
          }),
        )}
      </svg>
    );
  }
  if (formation === "equipos") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        {[0, 1].map((r) =>
          [0, 1].map((c) => (
            <g key={`${r}-${c}`}>
              <rect
                x={12 + c * 55}
                y={14 + r * 52}
                width="42"
                height="40"
                rx="8"
                className="fill-indigo-400/10 stroke-indigo-300/40"
                strokeWidth="1.5"
              />
              {[0, 1, 2, 3].map((i) => (
                <circle
                  key={i}
                  cx={22 + c * 55 + (i % 2) * 16}
                  cy={26 + r * 52 + Math.floor(i / 2) * 16}
                  r="5"
                  className={common}
                />
              ))}
            </g>
          )),
        )}
      </svg>
    );
  }
  if (formation === "filas") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        {[0, 1, 2].map((row) =>
          Array.from({ length: 8 }).map((_, i) => (
            <circle
              key={`${row}-${i}`}
              cx={18 + i * 12}
              cy={30 + row * 28}
              r="4.5"
              className={common}
            />
          )),
        )}
        <path d="M16 95 H104" className="stroke-amber-300/50" strokeWidth="2" strokeDasharray="4 3" />
      </svg>
    );
  }
  if (formation === "mezcla") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        {[
          [30, 35],
          [55, 28],
          [80, 40],
          [40, 58],
          [70, 62],
          [25, 78],
          [52, 85],
          [88, 75],
          [95, 55],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5.5" className={common} />
        ))}
        <path
          d="M28 38 C45 20, 75 20, 82 42"
          className="fill-none stroke-fuchsia-300/50"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  if (formation === "spotlight") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        <rect x="20" y="78" width="80" height="18" rx="4" className="fill-white/10" />
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={i} cx={28 + i * 11} cy="87" r="3.5" className="fill-slate-400/50" />
        ))}
        <circle cx="60" cy="42" r="14" className="fill-amber-300/30 stroke-amber-200/80" strokeWidth="2" />
        <path d="M40 70 L60 52 L80 70" className="fill-amber-200/10 stroke-amber-200/40" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <circle key={`${r}-${c}`} cx={28 + c * 22} cy={28 + r * 22} r="5" className={common} />
        )),
      )}
    </svg>
  );
}

function pickRandom<T>(items: T[], count: number, avoidIds?: Set<string>, idOf?: (item: T) => string): T[] {
  const pool = [...items];
  if (avoidIds && idOf) {
    const filtered = pool.filter((item) => !avoidIds.has(idOf(item)));
    if (filtered.length >= count) {
      pool.splice(0, pool.length, ...filtered);
    }
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function indexUnderPointer(rotationDeg: number, n: number) {
  if (n <= 0) return 0;
  const slice = 360 / n;
  const normalized = ((rotationDeg % 360) + 360) % 360;
  const pointerAngle = (360 - normalized) % 360;
  return Math.min(n - 1, Math.floor(pointerAngle / slice) % n);
}

function Wheel({
  activities,
  rotationDeg,
  spinning,
  pointerTitle,
  pointerColor,
}: {
  activities: IcebreakerActivity[];
  rotationDeg: number;
  spinning: boolean;
  pointerTitle: string;
  pointerColor: string;
}) {
  const n = activities.length;
  const slice = 360 / n;
  const gradient = activities
    .map((act, i) => {
      const color = sliceColor(act, i);
      const start = (i * slice).toFixed(3);
      const end = ((i + 1) * slice).toFixed(3);
      return `${color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="relative aspect-square w-full">
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1">
          <div className="h-0 w-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow" />
        </div>
        <div
          className={`ice-wheel relative h-full w-full rounded-full border-4 border-white/20 shadow-[0_0_40px_rgba(34,211,238,0.2)] ${
            spinning ? "" : "ice-wheel-idle"
          }`}
          style={{
            background: `conic-gradient(from -90deg, ${gradient})`,
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning
              ? "transform 4.2s cubic-bezier(0.12, 0.75, 0.12, 1)"
              : "transform 0.3s ease",
          }}
        >
          {n <= 18
            ? activities.map((act, i) => {
                const angle = -90 + i * slice + slice / 2;
                return (
                  <div
                    key={act.id}
                    className="pointer-events-none absolute left-1/2 top-1/2 origin-left"
                    style={{
                      width: "42%",
                      transform: `rotate(${angle}deg) translate(20px, -50%)`,
                    }}
                  >
                    <span className="block truncate text-[8px] font-bold uppercase tracking-wide text-slate-950/90">
                      {wheelLabel(act)}
                    </span>
                  </div>
                );
              })
            : null}
          <div className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/30 bg-slate-950 text-center text-[10px] font-semibold leading-tight text-cyan-100">
            Gira
          </div>
        </div>
      </div>

      <div
        className={`mt-3 rounded-2xl border px-4 py-3 text-center shadow-lg transition-colors ${
          spinning ? "border-white/15 bg-white/5" : "border-amber-300/40 bg-amber-400/10"
        }`}
        style={
          !spinning && pointerColor
            ? { boxShadow: `0 0 24px ${pointerColor}55`, borderColor: `${pointerColor}99` }
            : undefined
        }
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
          Bajo la flecha
        </p>
        <p className={`mt-1 text-lg font-bold leading-snug text-white ${spinning ? "animate-pulse" : "ice-reveal"}`}>
          {spinning ? "…" : pointerTitle || "¿Qué saldrá?"}
        </p>
      </div>
    </div>
  );
}

export default function IcebreakerRoulettePanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const [kindFilter, setKindFilter] = useState<IcebreakerKind | "mix" | "todas">("mix");
  const [energyFilter, setEnergyFilter] = useState<IcebreakerEnergy | "todas">("todas");
  const [deck, setDeck] = useState(() => buildRouletteDeck());
  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [current, setCurrent] = useState<IcebreakerActivity | null>(null);
  const [pickedStudents, setPickedStudents] = useState<GroupStudent[]>([]);
  const [history, setHistory] = useState<IcebreakerActivity[]>([]);
  const [spinStudentsOnly, setSpinStudentsOnly] = useState(false);
  const recentIds = useRef<string[]>([]);

  const studentsQuery = useQuery({
    queryKey: ["group-students", selectedGroupId],
    queryFn: () => fetchGroupStudents(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const students = studentsQuery.data?.students ?? [];
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const pool = useMemo(
    () => filterActivities(kindFilter, energyFilter, deck),
    [kindFilter, energyFilter, deck],
  );

  const pointerIndex = indexUnderPointer(rotationDeg, pool.length);
  const pointerActivity = pool[pointerIndex] ?? null;
  const pointerTitle = current && !spinning ? wheelLabel(current) : spinning ? "" : pointerActivity ? wheelLabel(pointerActivity) : "";
  const pointerColor = pointerActivity ? sliceColor(pointerActivity, pointerIndex) : "#facc15";

  const spinActivity = () => {
    if (spinning || pool.length === 0) return;
    setSpinning(true);
    setSpinStudentsOnly(false);

    const avoid = new Set(recentIds.current);
    const candidates = pickRandom(pool, 1, avoid, (a) => a.id);
    const chosen = candidates[0] ?? pool[Math.floor(Math.random() * pool.length)];
    const index = Math.max(0, pool.findIndex((a) => a.id === chosen.id));
    const slice = 360 / pool.length;
    const targetCenter = index * slice + slice / 2;
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    const currentMod = ((rotationDeg % 360) + 360) % 360;
    const desiredMod = (360 - targetCenter) % 360;
    let delta = desiredMod - currentMod;
    if (delta <= 0) delta += 360;
    setRotationDeg(rotationDeg + extraTurns * 360 + delta);

    window.setTimeout(() => {
      setCurrent(chosen);
      recentIds.current = [chosen.id, ...recentIds.current].slice(0, 8);
      setHistory((prev) => [chosen, ...prev.filter((h) => h.id !== chosen.id)].slice(0, 8));

      if (chosen.spotlightCount > 0 && students.length > 0) {
        setPickedStudents(pickRandom(students, chosen.spotlightCount));
      } else {
        setPickedStudents([]);
      }
      setSpinning(false);
    }, 4300);
  };

  const reshuffleStudents = () => {
    if (!current || current.spotlightCount <= 0 || students.length === 0 || spinning) return;
    setSpinStudentsOnly(true);
    window.setTimeout(() => {
      setPickedStudents(pickRandom(students, current.spotlightCount));
      setSpinStudentsOnly(false);
    }, 450);
  };

  const remeshDeck = () => {
    if (spinning) return;
    setDeck(buildRouletteDeck());
    setCurrent(null);
    setPickedStudents([]);
    setRotationDeg(0);
    recentIds.current = [];
  };

  if (!selectedGroupId) {
    return <p className="text-slate-400">Selecciona un grupo.</p>;
  }

  const kind = current ? activityKind(current) : null;
  const isSpinAgain = current?.id === "especial-vuelve-girar";
  const isParticipation = current?.id === "especial-participacion";
  const winner = pickedStudents[0];

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Ruleta rompehielo</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Dinámicas, castigos chuscos, respiración/movimiento y casillas especiales para ~
              {students.length || 32} alumnos del grupo {selectedGroup?.code}.
            </p>
          </div>
          <button
            type="button"
            disabled={spinning}
            onClick={remeshDeck}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
          >
            Remezclar bombo
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["mix", "Bombo mixto"],
              ["dinamica", "Dinámicas"],
              ["castigo", "Castigos"],
              ["respiracion", "Respiración"],
              ["especial", "Especiales"],
              ["todas", "Catálogo completo"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={spinning}
              onClick={() => {
                setKindFilter(id);
                setCurrent(null);
                setPickedStudents([]);
                setRotationDeg(0);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                kindFilter === id
                  ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(["todas", "baja", "media", "alta"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={spinning}
              onClick={() => setEnergyFilter(opt)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                energyFilter === opt
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/5 text-slate-500"
              }`}
            >
              {opt === "todas" ? "Cualquier energía" : energyLabel(opt)}
            </button>
          ))}
        </div>

        {studentsQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(studentsQuery.error)}</p>
        ) : null}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="space-y-4">
            <Wheel
              activities={pool}
              rotationDeg={rotationDeg}
              spinning={spinning}
              pointerTitle={pointerTitle}
              pointerColor={pointerColor}
            />
            <button
              type="button"
              onClick={spinActivity}
              disabled={spinning || pool.length === 0}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-base font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-60"
            >
              {spinning ? "Girando…" : isSpinAgain ? "Girar de nuevo" : "Girar ruleta"}
            </button>
            <p className="text-center text-xs text-slate-500">
              {pool.length} casillas · naranja = castigo · teal = respiración · dorado/rosa = especial
            </p>
          </div>

          <div className="min-w-0">
            {!current ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 text-center">
                <p className="text-lg font-semibold text-white">Listos para romper el hielo</p>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Gira: pueden salir dinámicas, castigos suaves (sentadillas, cantar…), respiración o
                  casillas como “vuelve a girar” y “ganaste una participación”.
                </p>
              </div>
            ) : isSpinAgain ? (
              <div className={`space-y-4 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-6 text-center ${spinning ? "opacity-60" : "ice-reveal"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">Casilla especial</p>
                <h3 className="text-3xl font-bold text-white">Vuelve a girar</h3>
                <p className="text-sm text-fuchsia-100/80">
                  La ruleta pide bis. Redoble de pupitres… y otra vez.
                </p>
                <button
                  type="button"
                  onClick={spinActivity}
                  disabled={spinning}
                  className="mx-auto rounded-2xl bg-fuchsia-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-fuchsia-300 disabled:opacity-60"
                >
                  Girar otra vez
                </button>
              </div>
            ) : isParticipation ? (
              <div className={`space-y-4 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-emerald-500/10 p-6 text-center ${spinning ? "opacity-60" : "ice-reveal"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Casilla especial</p>
                <h3 className="text-2xl font-bold text-white sm:text-3xl">
                  ¡Felicidades! Ganaste una participación
                </h3>
                {studentsQuery.isLoading ? (
                  <p className="text-sm text-amber-100/70">Sorteando alumno…</p>
                ) : winner ? (
                  <div className="mx-auto max-w-md rounded-2xl border border-amber-300/40 bg-slate-950/50 px-5 py-4">
                    <p className="text-xs uppercase tracking-wide text-amber-200/70">Alumno ganador</p>
                    <p className="mt-1 text-2xl font-bold text-amber-50">
                      {winner.listNumber != null ? `#${winner.listNumber} · ` : ""}
                      {winner.displayName}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-100/70">No hay alumnos en el grupo para sortear.</p>
                )}
                <button
                  type="button"
                  onClick={reshuffleStudents}
                  disabled={spinning || students.length === 0}
                  className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/20 disabled:opacity-50"
                >
                  {spinStudentsOnly ? "Sorteando…" : "Otro ganador"}
                </button>
                <p className="text-xs text-slate-400">Anótalo en tu lista de participaciones.</p>
              </div>
            ) : (
              <div
                className={`space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5 ${
                  spinning ? "opacity-60" : "ice-reveal"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">
                      {kind ? kindLabel(kind) : "Actividad sorteada"}
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-white">{current.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{current.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {current.minutes > 0 ? (
                      <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
                        ~{current.minutes} min
                      </span>
                    ) : null}
                    <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
                      {energyLabel(current.energy)}
                    </span>
                    <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
                      {formationLabel(current.formation)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  {current.illustrated ? (
                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-2">
                      <FormationDiagram formation={current.formation} />
                      <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wide text-cyan-200/70">
                        Formación
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs text-slate-400">
                      {kind === "castigo"
                        ? "Castigo express"
                        : "Indicaciones generales"}
                    </div>
                  )}
                  <div className="space-y-2 text-sm text-slate-300">
                    <p>
                      <span className="font-semibold text-slate-100">Para ~32:</span>{" "}
                      {current.setupFor32}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-100">Material:</span>{" "}
                      {current.materials}
                    </p>
                    <p className="text-amber-100/90">
                      <span className="font-semibold">Tip:</span> {current.tip}
                    </p>
                  </div>
                </div>

                <ol className="space-y-2">
                  {current.steps.map((step, idx) => (
                    <li
                      key={`${step.title}-${idx}`}
                      className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          kind === "castigo"
                            ? "bg-orange-400/20 text-orange-100"
                            : "bg-cyan-400/20 text-cyan-100"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{step.title}</p>
                        <p className="text-sm text-slate-400">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                {current.spotlightCount > 0 ? (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-amber-100">
                        {kind === "castigo" ? "Le toca a" : "Sorteo de alumnos"} (
                        {current.spotlightCount})
                      </p>
                      <button
                        type="button"
                        onClick={reshuffleStudents}
                        disabled={spinning || students.length === 0}
                        className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/20 disabled:opacity-50"
                      >
                        {spinStudentsOnly ? "Sorteando…" : "Volver a sortear"}
                      </button>
                    </div>
                    {studentsQuery.isLoading ? (
                      <p className="mt-2 text-sm text-amber-100/70">Cargando lista del grupo…</p>
                    ) : students.length === 0 ? (
                      <p className="mt-2 text-sm text-amber-100/70">
                        No hay alumnos en este grupo para sortear.
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {pickedStudents.map((s) => (
                          <li
                            key={s.id}
                            className={`rounded-xl border border-amber-300/30 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-amber-50 ${
                              spinStudentsOnly ? "animate-pulse" : ""
                            }`}
                          >
                            {s.listNumber != null ? `#${s.listNumber} · ` : ""}
                            {s.displayName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {history.length > 0 ? (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Historial de la sesión
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {history.map((h) => (
                <button
                  key={h.id + h.title}
                  type="button"
                  disabled={spinning}
                  onClick={() => {
                    setCurrent(h);
                    if (h.spotlightCount > 0 && students.length > 0) {
                      setPickedStudents(pickRandom(students, h.spotlightCount));
                    } else {
                      setPickedStudents([]);
                    }
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    current?.id === h.id
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {wheelLabel(h)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
