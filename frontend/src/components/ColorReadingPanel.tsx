import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLecturaSession,
  generateLecturaSession,
  getApiErrorMessage,
  updateGroupLecturaSettings,
} from "../lib/api";
import { LECTURA_MINUTOS, LECTURA_PROGRAMA, rutaLectura } from "../lib/lecturaTkinter";
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
  const [topic, setTopic] = useState("");
  const [actionError, setActionError] = useState("");
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});
  const [openParas, setOpenParas] = useState<Record<string, boolean>>({});

  const sessionQuery = useQuery({
    queryKey: ["lectura-session", selectedGroupId],
    queryFn: () => fetchLecturaSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const teamCount = session?.teamCount ?? 0;
  const released = session?.released ?? selectedGroup?.lecturaReleased ?? false;
  const hasContent = session?.hasContent ?? false;

  useEffect(() => {
    setFocusIndex("todos");
    setActionError("");
    setOpenTeams({});
    setOpenParas({});
    if (session?.topic) setTopic(session.topic);
  }, [selectedGroupId, session?.topic, teamCount]);

  useEffect(() => {
    if (focusIndex === "todos") return;
    setOpenTeams((prev) => ({ ...prev, [focusIndex]: true }));
  }, [focusIndex]);

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

  const generateMutation = useMutation({
    mutationFn: () => generateLecturaSession(selectedGroupId, { topic: topic.trim() }),
    onSuccess: async () => {
      setActionError("");
      await qc.invalidateQueries({ queryKey: ["lectura-session", selectedGroupId] });
      await qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

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
        `¿Liberar la lectura para el grupo ${selectedGroup?.code}?\n\nCada alumno verá SOLO la lectura de su equipo, partida en párrafos. Cada integrante lee el suyo en voz alta. Nadie ve el texto de otro color.`,
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
        <h2 className="mt-1 text-2xl font-bold text-white">
          {session?.topic ? session.topic : "Lectura de la semana"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Grupo {selectedGroup?.code} · {selectedGroup?.shift}
          {session?.sessionNumber ? ` · Sesión ${session.sessionNumber}` : ""}. Cada 8 días (o cada semana)
          escribes el tema, generas textos nuevos —aunque el tema se repita— y luego liberas. Cada equipo
          recibe una lectura distinta, partida en un párrafo por integrante. Después arman un solo mapa en
          Canva y lo exponen. Un alumno no ve la lectura de otro color.
        </p>

        <label className="mt-4 block text-xs text-slate-400 no-print">
          Tema principal de esta semana
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej. Frames y Radiobuttons en Tkinter"
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white"
          />
        </label>
        <p className="mt-1 text-[11px] text-slate-500 no-print">
          Si la próxima semana siguen con el mismo tema, vuelve a generar: salen lecturas distintas (sesión{" "}
          {(session?.sessionNumber ?? 0) + 1}).
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
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || topic.trim().length < 4 || teamCount === 0}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            {generateMutation.isPending ? "Generando..." : "Generar lecturas de esta semana"}
          </button>
          <button
            type="button"
            onClick={toggleRelease}
            disabled={releaseMutation.isPending || teamCount === 0 || !hasContent}
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
        {actionError ? <p className="mt-2 text-sm text-rose-300">{actionError}</p> : null}
        {released ? (
          <p className="mt-3 text-sm text-emerald-200">
            Liberada. Cada alumno ve la lectura de su equipo, su párrafo destacado y los párrafos de sus
            compañeros. No ve otros colores.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Primero genera las lecturas; luego libéralas. Mientras no pulses Liberar, los alumnos no ven
            nada.
          </p>
        )}
        {!hasContent && teamCount > 0 ? (
          <p className="mt-2 text-sm text-amber-200">
            Hay equipos, pero aún no hay textos de esta semana. Escribe el tema y pulsa Generar.
          </p>
        ) : null}
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
        <h3 className="text-lg font-semibold text-white">Cómo se lee y qué se entrega</h3>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "1", t: "Una lectura por equipo", d: "Texto distinto al de las otras columnas." },
            { n: "2", t: "Un párrafo por persona", d: "Cada integrante lee EN VOZ ALTA el recuadro con su nombre." },
            { n: "3", t: "Un solo producto", d: "Todo el equipo arma UN organizador o mapa cognitivo en Canva." },
            { n: "4", t: "Exposición", d: "Proyectan esa lámina frente al grupo. No es un trabajo por persona." },
          ].map((step) => (
            <div key={step.n} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-sm font-bold text-white">
                {step.n}. {step.t}
              </p>
              <p className="text-xs text-slate-400">{step.d}</p>
            </div>
          ))}
        </ol>
      </section>

      <section className="mb-6 no-print">
        <div className="mb-3 flex flex-wrap gap-2">
          <FilterChip active={focusIndex === "todos"} onClick={() => setFocusIndex("todos")}>
            Proyectar {teamCount} lectura{teamCount === 1 ? "" : "s"}
          </FilterChip>
          <button
            type="button"
            onClick={() => {
              const next: Record<number, boolean> = {};
              teams.forEach((t) => {
                next[t.readingIndex] = true;
              });
              setOpenTeams(next);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            Expandir lecturas
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenTeams({});
              setOpenParas({});
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            Contraer lecturas
          </button>
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
            return (
              <div
                key={team.readingIndex}
                className="rounded-xl border p-3"
                style={{ borderColor: `${team.hex}66`, backgroundColor: `${team.hex}14` }}
              >
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: team.hex }}>
                  {team.colorName} · Col. {team.columna} · lectura {team.readingIndex + 1} de {teamCount}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {team.titulo || "Sin texto: genera esta semana"}
                </p>
                <ul className="mt-2 space-y-1">
                  {team.members.map((m) => (
                    <li key={m.studentId} className="text-sm text-slate-200">
                      <span className="font-semibold text-white">{m.displayName}</span>
                      <span className="text-slate-500"> · lee {m.roleName.toLowerCase()}</span>
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
          const teamOpen = Boolean(openTeams[team.readingIndex]);
          return (
            <article
              key={team.readingIndex}
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: `${team.hex}88` }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenTeams((prev) => ({ ...prev, [team.readingIndex]: !prev[team.readingIndex] }))
                }
                className="flex w-full items-start justify-between gap-3 px-5 py-3 text-left no-print"
                style={{ backgroundColor: `${team.hex}33` }}
                aria-expanded={teamOpen}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                    {team.colorName} · Columna {team.columna} · lectura {team.readingIndex + 1}/{teamCount} ·
                    solo este equipo
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">{team.titulo}</h3>
                  <p className="text-sm text-slate-300">
                    {team.members.length} integrante{team.members.length === 1 ? "" : "s"} ·{" "}
                    {team.members.map((m) => m.displayName.split(" ")[0]).join(", ")}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                  {teamOpen ? "Ocultar" : "Ver lectura"}
                </span>
              </button>
              <header className="hidden px-5 py-3 print:block" style={{ backgroundColor: `${team.hex}33` }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                  {team.colorName} · Columna {team.columna} · lectura {team.readingIndex + 1}/{teamCount}
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">{team.titulo}</h3>
                <p className="text-sm text-slate-300">Misión: {team.mision}</p>
              </header>
              <div className={`bg-slate-950/50 px-5 py-4 ${teamOpen ? "block" : "hidden print:block"}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">
                  Lectura del equipo · toca un nombre para ver u ocultar su párrafo
                </p>
                <p className="mt-2 text-sm text-slate-300 print:block">{team.mision}</p>
                <div className="mt-3 space-y-3">
                  {team.members.map((m) => {
                    const paraOpen = Boolean(openParas[m.studentId]);
                    return (
                      <div
                        key={m.studentId}
                        className="rounded-xl border"
                        style={{ borderColor: `${team.hex}55`, backgroundColor: `${team.hex}14` }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenParas((prev) => ({ ...prev, [m.studentId]: !prev[m.studentId] }))
                          }
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left no-print"
                          aria-expanded={paraOpen}
                        >
                          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: team.hex }}>
                            {m.roleName} · lee {m.displayName}
                          </p>
                          <span className="text-xs font-semibold text-slate-400">
                            {paraOpen ? "Ocultar" : "Ver"}
                          </span>
                        </button>
                        <p
                          className="hidden px-4 pt-3 text-xs font-bold uppercase tracking-wide print:block"
                          style={{ color: team.hex }}
                        >
                          {m.roleName} · lee {m.displayName}
                        </p>
                        <p
                          className={`max-w-prose px-4 pb-4 text-[15px] leading-7 text-white ${
                            paraOpen ? "block" : "hidden print:block"
                          }`}
                        >
                          {m.paragraph || "Aún no hay párrafo: genera la lectura de esta semana."}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-sm font-medium text-cyan-200">Pregunta guía: {team.preguntaGuia}</p>
                <p className="mt-2 text-xs text-slate-500">Claves: {team.clave.join(" · ")}</p>
                <div className="mt-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3">
                  <p className="text-sm font-semibold text-indigo-100">Producto de todo el equipo</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-200">
                    {team.producto ||
                      "Armen UN solo organizador gráfico o mapa cognitivo en Canva y expónganlo frente al grupo."}
                  </p>
                </div>
                {team.organizador.length > 0 ? (
                  <table className="mt-4 min-w-full text-sm">
                    <tbody>
                      {team.organizador.map((row) => (
                        <tr key={row.caja} className="border-t border-white/10">
                          <td className="px-1 py-1 font-medium text-white">{row.caja}</td>
                          <td className="px-1 py-1 text-slate-300">{row.hijos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function currentPhase(elapsed: number) {
  if (elapsed < 2 * 60) return "Ahora: armado de equipos";
  if (elapsed < 16 * 60) return "Ahora: cada integrante lee su párrafo";
  if (elapsed < 32 * 60) return "Ahora: un mapa en Canva (todo el equipo)";
  if (elapsed < 48 * 60) return "Ahora: exposición frente al grupo";
  if (elapsed < 50 * 60) return "Ahora: cierre";
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
