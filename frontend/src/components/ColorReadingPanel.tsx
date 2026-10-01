import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSeatingPlan } from "../lib/api";
import { todayLocalIso } from "../lib/dates";
import {
  LECTURA_BLOQUES,
  LECTURA_CONCLUSION_MODELO,
  LECTURA_MINUTOS,
  LECTURA_ORGANIZADOR,
  LECTURA_PROGRAMA,
  LECTURA_ROLES,
  LECTURA_RUTA,
  LECTURA_TEMA,
  rolPorFila,
  type LecturaBloque,
} from "../lib/lecturaTkinter";
import type { ClassGroup, SeatingCell } from "../lib/types";

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ColorReadingPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const date = todayLocalIso();
  const [seconds, setSeconds] = useState(LECTURA_MINUTOS * 60);
  const [running, setRunning] = useState(false);
  const [focusColor, setFocusColor] = useState<string | "todos">("todos");

  const seatingQuery = useQuery({
    queryKey: ["seating", selectedGroupId, date],
    queryFn: () => fetchSeatingPlan(selectedGroupId, date),
    enabled: !!selectedGroupId,
  });

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const teams = useMemo(() => {
    const grid = seatingQuery.data?.grid ?? [];
    return LECTURA_BLOQUES.map((bloque) => {
      const members = grid
        .filter((cell) => cell.student && teamMatchesBloque(cell, bloque))
        .sort((a, b) => a.row - b.row);
      return { bloque, members };
    });
  }, [seatingQuery.data?.grid]);

  const visibleBlocks =
    focusColor === "todos" ? LECTURA_BLOQUES : LECTURA_BLOQUES.filter((b) => b.colorName === focusColor);

  const elapsed = LECTURA_MINUTOS * 60 - seconds;
  const phase = currentPhase(elapsed);

  return (
    <div className="lectura-session">
      <div className="mb-4 flex flex-wrap gap-2 no-print">
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

      <section className="glass mb-6 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{LECTURA_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{LECTURA_TEMA}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Grupo {selectedGroup?.code} · {selectedGroup?.shift}. Equipos = columnas de color (3 a 6
          integrantes). Antes: Butacas → Equipos por columna + Color por columna.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3 no-print">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-500">Reloj de sesión</p>
            <p className={`text-4xl font-extrabold tabular-nums ${seconds <= 120 ? "text-amber-300" : "text-white"}`}>
              {formatClock(seconds)}
            </p>
            <p className="text-xs text-cyan-200">{phase}</p>
          </div>
          <button
            type="button"
            onClick={() => setRunning((v) => !v)}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            {running ? "Pausar" : "Iniciar 50 min"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setSeconds(LECTURA_MINUTOS * 60);
            }}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Reiniciar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-cyan-400/30 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10"
          >
            Imprimir / PDF
          </button>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 no-print">
        {LECTURA_RUTA.map((step) => (
          <div key={step.min} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold text-cyan-300">{step.min} min</p>
            <p className="mt-1 font-semibold text-white">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p>
          </div>
        ))}
      </section>

      <section className="glass mb-6 p-6">
        <h3 className="text-lg font-semibold text-white">Roles según la fila (no se discuten)</h3>
        <p className="mt-1 text-sm text-slate-400">
          Fila 1 = más al frente. Si la columna tiene 3 o 4, el de más atrás también habla al final.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LECTURA_ROLES.map((rol) => (
            <div key={rol.fila} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-sm font-bold text-white">
                Fila {rol.fila} · {rol.name}
              </p>
              <p className="text-xs text-slate-400">{rol.task}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 no-print">
        <div className="mb-3 flex flex-wrap gap-2">
          <FilterChip active={focusColor === "todos"} onClick={() => setFocusColor("todos")}>
            Proyectar todo
          </FilterChip>
          {LECTURA_BLOQUES.map((b) => (
            <FilterChip
              key={b.colorName}
              active={focusColor === b.colorName}
              onClick={() => setFocusColor(b.colorName)}
              color={b.hex}
            >
              {b.colorName}
            </FilterChip>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map(({ bloque, members }) => (
            <div
              key={bloque.colorName}
              className="rounded-xl border p-3"
              style={{ borderColor: `${bloque.hex}66`, backgroundColor: `${bloque.hex}14` }}
            >
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: bloque.hex }}>
                Columna {bloque.columna} · {bloque.colorName} · {members.length} alumno
                {members.length === 1 ? "" : "s"}
              </p>
              {members.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Sin butacas hoy: igual trabajan por color.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {members.map((cell) => {
                    const rol = rolPorFila(cell.row);
                    return (
                      <li key={cell.student!.id} className="text-sm text-slate-200">
                        <span className="font-semibold text-white">{cell.student!.displayName}</span>
                        <span className="text-slate-500"> · {rol.name}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-4 print:space-y-6">
        {visibleBlocks.map((bloque) => (
          <article
            key={bloque.colorName}
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: `${bloque.hex}88` }}
          >
            <header className="px-5 py-3" style={{ backgroundColor: `${bloque.hex}33` }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: bloque.hex }}>
                {bloque.colorName} · Columna {bloque.columna} · lee este equipo
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">{bloque.titulo}</h3>
              <p className="text-sm text-slate-300">Misión: {bloque.mision}</p>
            </header>
            <div className="bg-slate-950/50 px-5 py-4">
              <p className="text-[15px] leading-relaxed text-slate-200">{bloque.texto}</p>
              <p className="mt-3 text-sm font-medium text-cyan-200">Pregunta guía: {bloque.preguntaGuia}</p>
              <p className="mt-2 text-xs text-slate-500">Claves: {bloque.clave.join(" · ")}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="glass mt-6 p-6">
        <h3 className="text-lg font-semibold text-white">Organizador que deben copiar (y completar)</h3>
        <p className="mt-1 text-sm text-slate-400">
          No es un resumen: es un mapa. El cartógrafo lo dibuja; el vocero lo señala con el dedo al explicar.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Caja</th>
                <th className="px-3 py-2">Qué va adentro</th>
              </tr>
            </thead>
            <tbody>
              {LECTURA_ORGANIZADOR.map((row) => (
                <tr key={row.caja} className="border-t border-white/10">
                  <td className="px-3 py-2 font-medium text-white">{row.caja}</td>
                  <td className="px-3 py-2 text-slate-300">{row.hijos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-white">Conclusión modelo (no la dictes completa): </span>
          {LECTURA_CONCLUSION_MODELO}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Evidencia para el programa: hoja del equipo (análisis + mapa + 2 frases). Tiempo total {LECTURA_MINUTOS}{" "}
          minutos. Tema de la materia: {LECTURA_TEMA}.
        </p>
      </section>
    </div>
  );
}

function teamMatchesBloque(cell: SeatingCell, bloque: LecturaBloque) {
  const name = (cell.colorName ?? "").trim().toLowerCase();
  if (name) return name === bloque.colorName.toLowerCase();
  const colIndex = LECTURA_BLOQUES.findIndex((b) => b.colorName === bloque.colorName) + 1;
  return cell.col === colIndex;
}

function currentPhase(elapsed: number) {
  if (elapsed < 2 * 60) return "Ahora: armado de equipos por color";
  if (elapsed < 14 * 60) return "Ahora: lectura en voz alta (Rosa → Naranja)";
  if (elapsed < 22 * 60) return "Ahora: análisis en equipo";
  if (elapsed < 32 * 60) return "Ahora: mapa / organizador";
  if (elapsed < 44 * 60) return "Ahora: galería de voceros";
  if (elapsed < 50 * 60) return "Ahora: conclusión de 2 frases";
  return "Sesión cerrada";
}

function FilterChip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        active ? "border-white/40 bg-white/15 text-white" : "border-white/10 bg-white/5 text-slate-300"
      }`}
      style={color && active ? { borderColor: color, color } : color ? { borderColor: `${color}55` } : undefined}
    >
      {children}
    </button>
  );
}
