import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLecturaSession,
  getApiErrorMessage,
  updateGroupLecturaSettings,
} from "../lib/api";
import {
  LECTURA_CONCLUSION_MODELO,
  LECTURA_MINUTOS,
  LECTURA_ORGANIZADOR,
  LECTURA_PROGRAMA,
  LECTURA_ROLES,
  LECTURA_TEMA,
  bloquePorIndice,
  rutaLectura,
} from "../lib/lecturaTkinter";
import type { ClassGroup } from "../lib/types";

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
  const qc = useQueryClient();
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const [seconds, setSeconds] = useState(LECTURA_MINUTOS * 60);
  const [running, setRunning] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | "todos">("todos");

  const sessionQuery = useQuery({
    queryKey: ["lectura-session", selectedGroupId],
    queryFn: () => fetchLecturaSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const teamCount = session?.teamCount ?? 0;
  const released = session?.released ?? selectedGroup?.lecturaReleased ?? false;

  useEffect(() => {
    setFocusIndex("todos");
  }, [selectedGroupId, teamCount]);

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

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => updateGroupLecturaSettings(selectedGroupId, { released: next }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lectura-session", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["student-progress"] });
    },
  });

  const visibleTeams = useMemo(() => {
    if (focusIndex === "todos") return teams;
    return teams.filter((t) => t.readingIndex === focusIndex);
  }, [teams, focusIndex]);

  const ruta = rutaLectura(teamCount || 1);
  const elapsed = LECTURA_MINUTOS * 60 - seconds;
  const phase = currentPhase(elapsed);

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        `¿Liberar la lectura para el grupo ${selectedGroup?.code}?\n\nLos alumnos verán solo el texto de su equipo (${teamCount} lectura${teamCount === 1 ? "" : "s"} distinta${teamCount === 1 ? "" : "s"}). Julieta, Getsemaní, Maya y Natalia no entran en 301.`,
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

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
          Grupo {selectedGroup?.code} · {selectedGroup?.shift}. Los alumnos no ven nada hasta que liberes la
          actividad.           Hay <strong className="text-white">{teamCount}</strong> equipo
          {teamCount === 1 ? "" : "s"} y por eso se entregan{" "}
          <strong className="text-white">{teamCount}</strong> lectura
          {teamCount === 1 ? "" : "s"} distinta{teamCount === 1 ? "" : "s"}.
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
            onClick={toggleRelease}
            disabled={releaseMutation.isPending || teamCount === 0}
            className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              released
                ? "border border-amber-400/40 bg-amber-500/15 text-amber-100"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            }`}
          >
            {releaseMutation.isPending
              ? "Guardando..."
              : released
                ? "Ocultar a los alumnos"
                : "Liberar para los alumnos"}
          </button>
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
        {released ? (
          <p className="mt-3 text-sm text-emerald-200">
            Liberada. Cada alumno ve solo el texto de su equipo. Puedes ocultarla cuando termine la clase.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Aún es solo para ti. Asigna butacas (equipos por columna) y luego libera.
          </p>
        )}
        {teamCount === 0 ? (
          <p className="mt-2 text-sm text-amber-200">
            No hay equipos con alumnos activos. En Butacas forma columnas y vuelve a esta pestaña.
          </p>
        ) : null}
      </section>

      {(session?.skipped.length ?? 0) > 0 ? (
        <section className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-100">No entran en esta lectura (301)</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
            {session!.skipped.map((s) => (
              <li key={`${s.displayName}-${s.reason}`}>
                {s.displayName} · {s.reason === "baja" ? "baja" : "incapacidad"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 no-print">
        {ruta.map((step) => (
          <div key={step.min} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold text-cyan-300">{step.min} min</p>
            <p className="mt-1 font-semibold text-white">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p>
          </div>
        ))}
      </section>

      <section className="glass mb-6 p-6">
        <h3 className="text-lg font-semibold text-white">Roles por orden en el equipo</h3>
        <p className="mt-1 text-sm text-slate-400">
          El de más adelante es Lector; el siguiente Cazador, y así. Si el equipo es de 3 o 4, el de más
          atrás también es vocero.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LECTURA_ROLES.map((rol) => (
            <div key={rol.fila} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-sm font-bold text-white">
                {rol.fila}° · {rol.name}
              </p>
              <p className="text-xs text-slate-400">{rol.task}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 no-print">
        <div className="mb-3 flex flex-wrap gap-2">
          <FilterChip active={focusIndex === "todos"} onClick={() => setFocusIndex("todos")}>
            Proyectar {teamCount} lectura{teamCount === 1 ? "" : "s"}
          </FilterChip>
          {teams.map((team) => {
            return (
              <FilterChip
                key={team.readingIndex}
                active={focusIndex === team.readingIndex}
                onClick={() => setFocusIndex(team.readingIndex)}
                color={team.hex}
              >
                {team.colorName}
              </FilterChip>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const bloque = bloquePorIndice(team.readingIndex);
            return (
              <div
                key={team.readingIndex}
                className="rounded-xl border p-3"
                style={{ borderColor: `${team.hex}66`, backgroundColor: `${team.hex}14` }}
              >
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: team.hex }}>
                  {team.colorName} · Col. {team.columna} · lectura {team.readingIndex + 1} de {teamCount}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{bloque.titulo}</p>
                <ul className="mt-2 space-y-1">
                  {team.members.map((m) => (
                    <li key={m.studentId} className="text-sm text-slate-200">
                      <span className="font-semibold text-white">{m.displayName}</span>
                      <span className="text-slate-500"> · {m.roleName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="space-y-4 print:space-y-6">
        {visibleTeams.map((team) => {
          const bloque = bloquePorIndice(team.readingIndex);
          return (
            <article
              key={team.readingIndex}
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: `${team.hex}88` }}
            >
              <header className="px-5 py-3" style={{ backgroundColor: `${team.hex}33` }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                  {team.colorName} · Columna {team.columna} · lectura {team.readingIndex + 1}/{teamCount}
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
          );
        })}
      </div>

      <section className="glass mt-6 p-6">
        <h3 className="text-lg font-semibold text-white">Organizador que deben copiar (y completar)</h3>
        <p className="mt-1 text-sm text-slate-400">
          No es un resumen: es un mapa. El cartógrafo lo dibuja; el vocero lo señala al explicar.
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
      </section>
    </div>
  );
}

function currentPhase(elapsed: number) {
  if (elapsed < 2 * 60) return "Ahora: armado de equipos";
  if (elapsed < 14 * 60) return "Ahora: lectura en voz alta por equipo";
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
