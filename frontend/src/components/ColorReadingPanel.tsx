import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLecturaSession,
  generateLecturaSession,
  getApiErrorMessage,
  resetLecturaSession,
  updateGroupLecturaSettings,
} from "../lib/api";
import {
  formatClock,
  LECTURA_MINUTOS,
  LECTURA_PROGRAMA,
  LECTURA_TEMA_301,
  LECTURA_WIDGETS,
  colorDeEquipo,
  remainingSeconds,
  rutaLectura,
} from "../lib/lecturaTkinter";
import type { ClassGroup, LecturaSession } from "../lib/types";
import LecturaIndicacion from "./LecturaIndicacion";

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
  const is301 = selectedGroup?.code.trim() === "301";
  const [consultKey, setConsultKey] = useState("");
  const [topic, setTopic] = useState("");
  const [actionError, setActionError] = useState("");
  const [openParas, setOpenParas] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());

  const sessionQuery = useQuery({
    queryKey: ["lectura-session", selectedGroupId],
    queryFn: () => fetchLecturaSession(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const teamCount = session?.teamCount ?? 0;
  const released = session?.released ?? selectedGroup?.lecturaReleased ?? false;
  const hasContent = session?.hasContent ?? false;
  const minutes = session?.minutes ?? LECTURA_MINUTOS;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  void now;

  useEffect(() => {
    setConsultKey("");
    setActionError("");
    setOpenParas({});
    if (is301) setTopic(session?.topic || LECTURA_TEMA_301);
    else if (session?.topic) setTopic(session.topic);
  }, [selectedGroupId, session?.topic, teamCount, is301]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateLecturaSession(selectedGroupId, {
        topic: is301 ? topic.trim() || LECTURA_TEMA_301 : topic.trim(),
      }),
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

  const resetMutation = useMutation({
    mutationFn: () => resetLecturaSession(selectedGroupId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lectura-session", selectedGroupId] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const consultArchives = useMemo(() => {
    const history = session?.history ?? [];
    const current =
      hasContent && session
        ? [
            {
              sessionNumber: session.sessionNumber,
              topic: session.topic,
              generatedAt: session.generatedAt,
              teams,
            },
          ]
        : [];
    const rest = history.filter((h) => h.sessionNumber !== session?.sessionNumber);
    return [...current, ...rest];
  }, [hasContent, session, teams]);

  const consultOptions = useMemo(() => {
    return consultArchives.flatMap((archive) =>
      archive.teams.map((team) => ({
        key: `${archive.sessionNumber}:${team.readingIndex}`,
        archive,
        team,
      })),
    );
  }, [consultArchives]);

  const selectedConsult =
    consultOptions.find((o) => o.key === consultKey) ?? consultOptions[0] ?? null;

  const ruta = rutaLectura(teamCount || 1);
  const withLeader = teams.filter((t) => t.leaderId).length;
  const withTimer = teams.filter((t) => t.startedAt).length;
  const canGenerate = is301 ? teamCount > 0 : teamCount > 0 && topic.trim().length >= 4;

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        `¿Liberar la lectura para el grupo ${selectedGroup?.code}?\n\nLos alumnos verán las instrucciones, eligirán un líder y solo el líder podrá arrancar los ${minutes} minutos. Cada uno ve SOLO la lectura de su color, partida en párrafos largos.`,
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

  function handleReset() {
    const ok = window.confirm(
      "¿Reiniciar líderes y relojes de este grupo? Las lecturas se quedan; cada equipo vuelve a elegir líder.",
    );
    if (!ok) return;
    resetMutation.mutate();
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">En vivo</p>
            <h2 className="mt-1 text-xl font-bold text-white">Líder y temporizador por equipo</h2>
            <p className="mt-1 text-sm text-slate-400">
              Se actualiza solo. Ves quién ya eligió líder y el reloj de {minutes} minutos de cada color.
            </p>
          </div>
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
            Líderes {withLeader}/{teams.length || 6} · Relojes {withTimer}/{teams.length || 6}
          </p>
        </div>
        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando equipos...</p>
        ) : teams.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No hay equipos de butacas. Asigna lugares primero.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => {
              const remain = remainingSeconds(team.startedAt, minutes);
              const running = Boolean(team.startedAt) && remain > 0;
              const done = Boolean(team.startedAt) && remain === 0;
              const paint = colorDeEquipo(team.columna, team.hex);
              return (
                <li
                  key={team.key ?? `${team.columna}-${team.readingIndex}`}
                  className="rounded-2xl border-2 p-4"
                  style={{ borderColor: paint.hex, backgroundColor: `${paint.hex}55` }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: paint.hex }}>
                    {paint.name} · columna {team.columna}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{team.titulo}</p>
                  <p className="mt-2 text-sm text-slate-200">
                    {team.leaderName ? `Líder: ${team.leaderName}` : "Aún no eligen líder"}
                  </p>
                  <p
                    className={`mt-2 font-mono text-3xl font-bold ${
                      done ? "text-rose-200" : running ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {team.startedAt ? formatClock(remain) : `${minutes}:00`}
                  </p>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      done
                        ? "text-rose-200"
                        : running
                          ? "text-emerald-200"
                          : team.leaderName
                            ? "text-amber-200"
                            : "text-slate-400"
                    }`}
                  >
                    {done
                      ? "Tiempo agotado — manos arriba"
                      : running
                        ? "Reloj en curso"
                        : team.leaderName
                          ? "Líder listo · esperando activar"
                          : "Sin líder"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass mb-6 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{LECTURA_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">
          {session?.topic ? session.topic : is301 ? LECTURA_TEMA_301 : "Lectura de la semana"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Grupo {selectedGroup?.code} · {selectedGroup?.shift}
          {session?.sessionNumber ? ` · Sesión ${session.sessionNumber}` : ""}.{" "}
          {is301
            ? "Cada equipo lee un widget distinto (Frame, Label, Radiobutton, Checkbutton, Text, Entry): un párrafo largo por integrante. Eligen líder; el líder corre los 50 minutos."
            : "Escribes el tema, generas textos y liberas. Cada equipo recibe una lectura distinta, partida en un párrafo por integrante. Eligen líder; el líder corre los 50 minutos."}
        </p>

        {is301 ? (
          <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-cyan-100">Temas por columna (301)</p>
            <p className="mt-1 text-xs text-slate-300">
              Al generar, el orden de butacas A→F recibe: {LECTURA_WIDGETS.join(" · ")}. Getsemaní queda
              fuera (baja). Maya y Natali sí entran. Julieta sigue de baja.
            </p>
          </div>
        ) : null}

        <label className="mt-4 block text-xs text-slate-400 no-print">
          {is301 ? "Título de esta sesión (el contenido ya va por widget)" : "Tema principal de esta semana"}
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={is301 ? LECTURA_TEMA_301 : "Ej. Frames y Radiobuttons en Tkinter"}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-end gap-3 no-print">
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !canGenerate}
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
            onClick={handleReset}
            disabled={resetMutation.isPending || !hasContent}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            {resetMutation.isPending ? "Reiniciando..." : "Reiniciar líderes y relojes"}
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
            Liberada. Cada alumno ve las instrucciones, elige líder y, al arrancar el reloj, lee su párrafo.
            No ve otros colores.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Primero genera las lecturas; luego libéralas. Mientras no pulses Liberar, los alumnos no ven
            nada.
          </p>
        )}
        {!hasContent && teamCount > 0 ? (
          <p className="mt-2 text-sm text-amber-200">
            Hay equipos, pero aún no hay textos de esta semana. {is301 ? "Pulsa Generar." : "Escribe el tema y pulsa Generar."}
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

      <section className="glass mb-6 p-6 no-print">
        <LecturaIndicacion />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 no-print">
        {ruta.map((step) => (
          <div key={step.min} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold text-cyan-300">{step.min} min</p>
            <p className="mt-1 font-semibold text-white">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p>
          </div>
        ))}
      </section>

      {consultOptions.length > 0 ? (
        <section className="glass mb-6 p-6">
          <label className="block text-sm font-semibold text-white">
            Consultar una lectura
            <select
              value={selectedConsult?.key ?? ""}
              onChange={(e) => {
                setConsultKey(e.target.value);
                setOpenParas({});
              }}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-sm text-white"
            >
              {consultArchives.map((archive) => (
                <optgroup
                  key={archive.sessionNumber}
                  label={`Sesión ${archive.sessionNumber} · ${archive.topic}${
                    archive.generatedAt ? ` · ${formatConsultDate(archive.generatedAt)}` : ""
                  }`}
                >
                  {archive.teams.map((team) => (
                    <option
                      key={`${archive.sessionNumber}:${team.readingIndex}`}
                      value={`${archive.sessionNumber}:${team.readingIndex}`}
                    >
                      {colorDeEquipo(team.columna, team.hex).name} · {team.titulo}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-500">
            La lectura del día queda aquí compactada. Elige el color del equipo para volver a verla.
          </p>
        </section>
      ) : null}

      {selectedConsult ? (
        <ConsultedTeamCard
          archive={selectedConsult.archive}
          team={selectedConsult.team}
          openParas={openParas}
          onTogglePara={(id) => setOpenParas((prev) => ({ ...prev, [id]: !prev[id] }))}
        />
      ) : null}
    </div>
  );
}

function formatConsultDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function ConsultedTeamCard({
  archive,
  team,
  openParas,
  onTogglePara,
}: {
  archive: { sessionNumber: number; topic: string; generatedAt: string | null };
  team: LecturaSession["teams"][number];
  openParas: Record<string, boolean>;
  onTogglePara: (id: string) => void;
}) {
  const paint = colorDeEquipo(team.columna, team.hex);
  return (
    <article className="overflow-hidden rounded-2xl border-2" style={{ borderColor: paint.hex }}>
      <header className="px-5 py-3" style={{ backgroundColor: `${paint.hex}55` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: paint.hex }}>
          Sesión {archive.sessionNumber} · {paint.name} · Columna {team.columna}
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">{team.titulo}</h3>
        <p className="text-sm text-slate-300">{team.mision}</p>
        <p className="mt-1 text-xs text-slate-400">
          {team.members.length} integrante{team.members.length === 1 ? "" : "s"} ·{" "}
          {team.members.map((m) => m.displayName.split(" ")[0]).join(", ")}
        </p>
      </header>
      <div className="bg-slate-950/50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">
          Toca un nombre para ver u ocultar su párrafo
        </p>
        <div className="mt-3 space-y-3">
          {team.members.map((m) => {
            const paraOpen = Boolean(openParas[m.studentId]);
            return (
              <div
                key={m.studentId}
                className="rounded-xl border"
                style={{ borderColor: `${paint.hex}88`, backgroundColor: `${paint.hex}22` }}
              >
                <button
                  type="button"
                  onClick={() => onTogglePara(m.studentId)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left no-print"
                  aria-expanded={paraOpen}
                >
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: paint.hex }}>
                    {m.roleName} · lee {m.displayName}
                  </p>
                  <span className="text-xs font-semibold text-slate-400">{paraOpen ? "Ocultar" : "Ver"}</span>
                </button>
                <p
                  className="hidden px-4 pt-3 text-xs font-bold uppercase tracking-wide print:block"
                  style={{ color: paint.hex }}
                >
                  {m.roleName} · lee {m.displayName}
                </p>
                <p
                  className={`max-w-prose px-4 pb-4 text-[15px] leading-7 text-white ${
                    paraOpen ? "block" : "hidden print:block"
                  }`}
                >
                  {m.paragraph || "Aún no hay párrafo."}
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
      </div>
    </article>
  );
}
