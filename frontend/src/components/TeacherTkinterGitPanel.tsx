import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTkinterGitNote,
  applyTkinterGitFirmas,
  downloadTkinterGitPdf,
  fetchTeacherTkinterGitDeliveries,
  fetchTkinterGitSession,
  getApiErrorMessage,
  removeTkinterGitNote,
  updateTkinterGitReleased,
} from "../lib/api";
import { maquinaRoleLabel } from "../lib/maquinaScrum";
import {
  TKINTER_GIT_DOCENTE,
  TKINTER_GIT_FIRMAS,
  TKINTER_GIT_INSTRUCTIVO,
  TKINTER_GIT_NOTA_REPO,
  TKINTER_GIT_NOTAS,
  TKINTER_GIT_TITULO,
  nombreRepositorio,
  programaDelEquipo,
  tkinterGitCierre,
} from "../lib/tkinterGit";
import type { ClassGroup } from "../lib/types";
import TkinterGitGuide from "./TkinterGitGuide";

export default function TeacherTkinterGitPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
  hideGroupPicker = false,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  hideGroupPicker?: boolean;
}) {
  const qc = useQueryClient();
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const [noteError, setNoteError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [customByTeam, setCustomByTeam] = useState<Record<string, { label: string; points: string }>>({});
  const sessionQuery = useQuery({
    queryKey: ["tkinter-git-session", selectedGroupId],
    queryFn: () => fetchTkinterGitSession(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 3000,
  });
  const deliveriesQuery = useQuery({
    queryKey: ["tkinter-git-deliveries", selectedGroupId],
    queryFn: () => fetchTeacherTkinterGitDeliveries(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 10_000,
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const released = Boolean(session?.released);
  const firmasMax = session?.firmasMax ?? TKINTER_GIT_FIRMAS;
  const code = selectedGroup?.code?.trim() ?? "";
  const ordered = [...teams].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es", { numeric: true }));

  function customOf(teamKey: string) {
    return customByTeam[teamKey] ?? { label: "", points: "100" };
  }
  function saveSession(data: NonNullable<typeof session>) {
    qc.setQueryData(["tkinter-git-session", selectedGroupId], data);
  }

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => updateTkinterGitReleased(selectedGroupId, next),
    onSuccess: (data) => {
      setNoteError("");
      saveSession(data);
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });
  const noteMutation = useMutation({
    mutationFn: (payload: { teamKey: string; code: string; label?: string; points?: number }) =>
      addTkinterGitNote(selectedGroupId, payload),
    onSuccess: (data) => {
      setNoteError("");
      saveSession(data);
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });
  const removeMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) => removeTkinterGitNote(selectedGroupId, payload),
    onSuccess: saveSession,
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });
  const awardMutation = useMutation({
    mutationFn: (teamKey?: string) => applyTkinterGitFirmas(selectedGroupId, teamKey),
    onSuccess: async (data) => {
      setNoteError("");
      saveSession(data);
      await qc.invalidateQueries({ queryKey: ["activities"] });
      await qc.invalidateQueries({ queryKey: ["grades-matrix"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  return (
    <div>
      {hideGroupPicker ? null : (
        <div className="mb-4 flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId
                  ? "border-lime-400/50 bg-lime-500/15 text-lime-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass mb-6 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-lime-300">Actividad Scrum · la liberas tú</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{TKINTER_GIT_TITULO}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Grupo {selectedGroup?.code ?? "—"}. Equipos de proyecto. Parte de {firmasMax.toLocaleString("es-MX")} Firmas.
          Un integrante sube el PDF del equipo. {released ? "Los alumnos ya la ven." : "Los alumnos todavía no la ven."}
        </p>
        {code === "302" ? (
          <p className="mt-2 max-w-3xl text-sm text-amber-100">
            {tkinterGitCierre("302").texto} Cada equipo guarda la liga de su repositorio y te agrega como colaborador:{" "}
            <span className="font-mono font-bold">{TKINTER_GIT_DOCENTE}</span>.
          </p>
        ) : null}
        <a
          href={TKINTER_GIT_INSTRUCTIVO}
          download="Instructivo-Tkinter-en-Git.pdf"
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-100"
        >
          Descargar instructivo (PDF)
        </a>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={releaseMutation.isPending || !selectedGroupId}
            onClick={() => {
              if (!released) {
                const ok = window.confirm(
                  `¿Liberar ${TKINTER_GIT_TITULO} para el grupo ${selectedGroup?.code ?? ""}?\n\nLos alumnos verán su programa, las instrucciones de Git y podrán subir el PDF.`,
                );
                if (!ok) return;
              }
              releaseMutation.mutate(!released);
            }}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
              released
                ? "border border-amber-400/40 bg-amber-500/20 text-amber-100"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {releaseMutation.isPending ? "Guardando..." : released ? "Ocultar a los alumnos" : "Liberar actividad"}
          </button>
          <button
            type="button"
            onClick={() => awardMutation.mutate(undefined)}
            disabled={awardMutation.isPending || teams.length === 0}
            className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {awardMutation.isPending ? "Guardando..." : "Registrar Firmas de todos"}
          </button>
        </div>
        {noteError ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{noteError}</p>
        ) : null}
        {downloadError ? <p className="mt-3 text-sm text-rose-200">{downloadError}</p> : null}
        {sessionQuery.isError ? <p className="mt-3 text-sm text-rose-300">{getApiErrorMessage(sessionQuery.error)}</p> : null}
      </section>

      <section className="glass mb-6 p-4 sm:p-6">
        <h2 className="text-xl font-bold text-white">Equipos y notas</h2>
        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando equipos...</p>
        ) : teams.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {session?.loadError ?? "No hay equipos de proyecto. Ármalos en Roles / Equipos."}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {ordered.map((team) => {
              const teamId = team.key.startsWith("project:") ? team.key.slice("project:".length) : team.key;
              const file = (deliveriesQuery.data?.deliveries ?? []).find((item) => item.teamKey === team.key);
              const liga = deliveriesQuery.data?.links?.[team.key];
              const programa = programaDelEquipo(
                ordered.map((item) => ({ id: item.key.startsWith("project:") ? item.key.slice("project:".length) : item.key })),
                teamId,
                code,
              );
              const repo = nombreRepositorio(code || "grupo", team.name ?? team.columna);
              return (
                <li
                  key={team.key}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: `${team.hex}88`, backgroundColor: `${team.hex}18` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                        {team.name ?? team.columna}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {team.leaderName ? `Líder: ${team.leaderName}` : "Sin líder"}
                      </p>
                    </div>
                    {file ? (
                      <button
                        type="button"
                        onClick={() => {
                          downloadTkinterGitPdf(selectedGroupId, team.key, file.fileName).catch((err) =>
                            setDownloadError(getApiErrorMessage(err)),
                          );
                        }}
                        className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
                      >
                        Descargar PDF
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400">Sin PDF</p>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {programa?.titulo ?? "Programa del equipo"}
                    {team.awarded ? " · Firmas guardadas" : ""}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-emerald-200">{repo}</p>
                  {code === "302" ? (
                    liga ? (
                      <a href={liga} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-sky-200 underline">
                        {liga}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-amber-100">Sin liga del repositorio</p>
                    )
                  ) : null}
                  <ul className="mt-3 space-y-0.5 text-xs text-slate-300">
                    {team.members.map((member) => (
                      <li key={member.studentId} className="flex justify-between gap-2">
                        <span>
                          {member.displayName}
                          {member.role ? ` · ${maquinaRoleLabel(member.role)}` : ""}
                          {member.studentId === team.leaderId ? " · líder" : ""}
                        </span>
                        <span className="text-lime-100">{member.firmas ?? firmasMax}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={noteMutation.isPending}
                    onClick={() => noteMutation.mutate({ teamKey: team.key, code: TKINTER_GIT_NOTA_REPO.code })}
                    className="mt-3 min-h-11 w-full rounded-lg border border-rose-400/60 bg-rose-500/20 px-2 py-2 text-left text-sm font-bold text-rose-50 hover:bg-rose-500/30 disabled:opacity-60"
                  >
                    {TKINTER_GIT_NOTA_REPO.label} −{TKINTER_GIT_NOTA_REPO.points}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {TKINTER_GIT_NOTAS.filter((nota) => nota.code !== TKINTER_GIT_NOTA_REPO.code).map((nota) => (
                      <button
                        key={nota.code}
                        type="button"
                        disabled={noteMutation.isPending}
                        onClick={() => noteMutation.mutate({ teamKey: team.key, code: nota.code })}
                        className="min-h-11 rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                      >
                        {nota.label} −{nota.points}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-300">Otra nota</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <input
                      value={customOf(team.key).label}
                      onChange={(event) =>
                        setCustomByTeam((prev) => ({
                          ...prev,
                          [team.key]: { ...customOf(team.key), label: event.target.value },
                        }))
                      }
                      placeholder="Escribe cualquier otra cosa"
                      className="min-w-[8rem] flex-1 rounded-lg border border-white/15 bg-slate-950/70 px-2 py-2 text-sm text-white"
                    />
                    <input
                      value={customOf(team.key).points}
                      onChange={(event) =>
                        setCustomByTeam((prev) => ({
                          ...prev,
                          [team.key]: { ...customOf(team.key), points: event.target.value },
                        }))
                      }
                      inputMode="numeric"
                      aria-label="Firmas que resta"
                      className="w-16 rounded-lg border border-white/15 bg-slate-950/70 px-2 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      disabled={noteMutation.isPending}
                      onClick={() => {
                        const custom = customOf(team.key);
                        const points = Number(custom.points);
                        if (!custom.label.trim() || !Number.isFinite(points) || points < 1 || points > firmasMax) {
                          setNoteError(`Escribe el motivo y las firmas a restar, de 1 a ${firmasMax}.`);
                          return;
                        }
                        noteMutation.mutate(
                          { teamKey: team.key, code: "custom", label: custom.label.trim(), points },
                          {
                            onSuccess: () =>
                              setCustomByTeam((prev) => ({ ...prev, [team.key]: { label: "", points: "100" } })),
                          },
                        );
                      }}
                      className="min-h-11 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Anotar
                    </button>
                  </div>
                  {(team.notes ?? []).length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {(team.notes ?? []).map((note) => (
                        <li key={note.id} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                          <span>
                            {note.label} <span className="text-amber-200">−{note.points}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate({ teamKey: team.key, noteId: note.id })}
                            className="font-semibold text-rose-200"
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Sin notas. El equipo iría con {firmasMax}.</p>
                  )}
                  <button
                    type="button"
                    disabled={awardMutation.isPending}
                    onClick={() => awardMutation.mutate(team.key)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-emerald-400/30 bg-emerald-500/15 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60"
                  >
                    Registrar Firmas de este equipo
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <TkinterGitGuide repo={nombreRepositorio(code || "302", "equipo-1")} />
    </div>
  );
}
