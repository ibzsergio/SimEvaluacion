import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addInterfaceNote,
  applyInterfacePoints,
  fetchInterfaceSession,
  getApiErrorMessage,
  removeInterfaceNote,
  setActivityStudentRelease,
} from "../lib/api";
import {
  INTERFACE_COTEJO,
  INTERFACE_COTEJO_TOTAL,
  INTERFACE_DAYS,
  INTERFACE_MAX_POINTS,
  INTERFACE_NOTES,
  interfaceDayLabel,
  type InterfaceDay,
} from "../lib/interfaceDesign";
import { extraRoleLabel } from "../lib/extraScrum";
import type { ClassGroup } from "../lib/types";

function mexicoTodayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function defaultInterfaceDay(): InterfaceDay {
  const iso = mexicoTodayIso();
  const match = INTERFACE_DAYS.find((item) => item.iso === iso);
  if (match) return match.iso;
  if (iso < INTERFACE_DAYS[0].iso) return INTERFACE_DAYS[0].iso;
  return INTERFACE_DAYS[INTERFACE_DAYS.length - 1]!.iso;
}

export default function TeacherInterfacePanel({
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
  const [day, setDay] = useState<InterfaceDay>(defaultInterfaceDay);
  const [noteError, setNoteError] = useState("");
  const [customByTeam, setCustomByTeam] = useState<
    Record<string, { label: string; points: string; studentId: string }>
  >({});

  const sessionQuery = useQuery({
    queryKey: ["interface-session", selectedGroupId],
    queryFn: () => fetchInterfaceSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const session = sessionQuery.data;
  const teams = session?.teams ?? [];
  const released = session?.released ?? false;
  const pointsMax = INTERFACE_MAX_POINTS;

  const noteMutation = useMutation({
    mutationFn: (payload: {
      teamKey: string;
      code: string;
      day: string;
      label?: string;
      points?: number;
      studentId?: string | null;
    }) => addInterfaceNote(selectedGroupId, payload),
    onSuccess: (data) => {
      setNoteError("");
      qc.setQueryData(["interface-session", selectedGroupId], data);
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (payload: { teamKey: string; noteId: string }) =>
      removeInterfaceNote(selectedGroupId, payload),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["interface-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["grades-matrix"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const awardMutation = useMutation({
    mutationFn: (payload: { teamKey?: string; day: InterfaceDay }) =>
      applyInterfacePoints(selectedGroupId, payload),
    onSuccess: async (data) => {
      setNoteError("");
      qc.setQueryData(["interface-session", selectedGroupId], data);
      await qc.invalidateQueries({ queryKey: ["grades-matrix"] });
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => {
      if (!session?.activityId) throw new Error("Todavía no está publicada la actividad.");
      return setActivityStudentRelease(session.activityId, next);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["interface-session"] });
      await qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err) => setNoteError(getApiErrorMessage(err)),
  });

  useEffect(() => {
    setNoteError("");
  }, [selectedGroupId]);

  function customOf(teamKey: string) {
    return customByTeam[teamKey] ?? { label: "", points: "50", studentId: "" };
  }

  function toggleRelease() {
    if (!released) {
      const ok = window.confirm(
        "¿Liberar Diseño de Interfaces Proyecto para que los alumnos la vean en su teléfono?",
      );
      if (!ok) return;
    }
    releaseMutation.mutate(!released);
  }

  return (
    <div className="mb-4">
      {hideGroupPicker ? null : (
        <div className="mb-4 flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId
                  ? "border-violet-400/50 bg-violet-500/15 text-violet-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
              Diseño de Interfaces Proyecto
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Equipos y notas</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Cada equipo parte de {pointsMax.toLocaleString("es-MX")} firmas. La lista de cotejo del
              diseño también suma {INTERFACE_COTEJO_TOTAL.toLocaleString("es-MX")}: lo que no cumplan se
              resta. Las notas de 50 que el equipo ya tenía siguen restando. El lunes 26 también se puede
              anotar y guardar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleRelease}
              disabled={releaseMutation.isPending || !session?.activityId}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                released ? "border border-amber-400/40 bg-amber-500/20" : "bg-violet-600 hover:bg-violet-500"
              }`}
            >
              {releaseMutation.isPending
                ? "Guardando..."
                : released
                  ? "Ocultar a los alumnos"
                  : "Liberar a los alumnos"}
            </button>
            <button
              type="button"
              onClick={() => awardMutation.mutate({ day })}
              disabled={awardMutation.isPending || teams.length === 0}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {awardMutation.isPending ? "Guardando..." : "Guardar firmas de este día en todos"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERFACE_DAYS.map((item) => (
            <button
              key={item.iso}
              type="button"
              onClick={() => setDay(item.iso)}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
                day === item.iso
                  ? "bg-violet-600 text-white"
                  : "border border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {released
            ? "Los alumnos ya la ven en su teléfono."
            : "Solo tú la ves. Libérala cuando quieras que aparezca en su teléfono."}
        </p>

        {noteError ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {noteError}
          </p>
        ) : null}
        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando equipos...</p>
        ) : sessionQuery.isError ? (
          <p className="mt-4 text-sm text-rose-300">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : teams.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No hay equipos de proyecto. Ármalos en Roles / Equipos y vuelve aquí.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {teams.map((team) => {
              const custom = customOf(team.key);
              const teamNotes = INTERFACE_NOTES.filter((note) => note.scope === "team");
              const memberNotes = INTERFACE_NOTES.filter((note) => note.scope === "member");
              const dayNotes = team.notes.filter((note) => note.day === day);
              const cotejoMark = (code: string, label: string) =>
                dayNotes.find((note) => note.code === code || note.label === label);
              const dayRegistered = team.awardedDays.includes(day);
              const dayCut = dayNotes.reduce((acc, note) => acc + note.points, 0);
              const firmasOf = (studentId: string) => {
                const cut = team.notes
                  .filter((note) => !note.studentId || note.studentId === studentId)
                  .reduce((acc, note) => acc + note.points, 0);
                return Math.max(0, pointsMax - cut);
              };
              return (
                <li
                  key={team.key}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: `${team.hex}88`, backgroundColor: `${team.hex}18` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
                        {team.name}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {team.leaderName ? `Líder: ${team.leaderName}` : `${team.members.length} integrantes`}
                      </p>
                    </div>
                    <p className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-xs font-bold text-amber-100">
                      {dayRegistered ? "Día registrado" : "Sin registrar"}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-0.5 text-xs text-slate-300">
                    {team.members.map((member) => (
                      <li key={member.studentId} className="flex justify-between gap-2">
                        <span>
                          {member.displayName}
                          {member.role ? ` · ${extraRoleLabel(member.role)}` : ""}
                          {member.studentId === team.leaderId ? " · líder" : ""}
                        </span>
                        <span className="shrink-0 font-semibold text-amber-100">
                          {firmasOf(member.studentId).toLocaleString("es-MX")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Firmas con las notas anotadas
                    {dayCut > 0 ? ` · este día resta ${dayCut.toLocaleString("es-MX")} al guardarlo` : ""}
                  </p>

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-100">
                      Lista de cotejo
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Marcado = cumple y no resta. Si lo quitas, ese criterio no se cumple y resta sus
                      puntos al guardar el día.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {INTERFACE_COTEJO.map((item) => {
                        const mark = cotejoMark(item.code, item.label);
                        const cumple = !mark;
                        return (
                          <li key={item.code}>
                            <button
                              type="button"
                              disabled={noteMutation.isPending || removeMutation.isPending}
                              onClick={() => {
                                if (mark) {
                                  removeMutation.mutate({ teamKey: team.key, noteId: mark.id });
                                  return;
                                }
                                noteMutation.mutate({
                                  teamKey: team.key,
                                  code: item.code,
                                  day,
                                  label: item.label,
                                  points: item.points,
                                });
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] ${
                                cumple
                                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
                                  : "border-rose-400/30 bg-rose-500/10 text-rose-50"
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                  cumple
                                    ? "border-emerald-300 bg-emerald-500 text-white"
                                    : "border-rose-300 bg-transparent"
                                }`}
                                aria-hidden
                              >
                                {cumple ? "✓" : ""}
                              </span>
                              <span className="min-w-0 flex-1 font-semibold">{item.label}</span>
                              <span className="shrink-0 font-bold">
                                {cumple ? item.points : `−${mark?.points ?? item.points}`}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-rose-100">
                      Notas que el equipo ya tenía
                    </p>
                    <ul className="mt-2 space-y-1">
                      {teamNotes.map((note) => {
                        const mark = cotejoMark(note.code, note.label);
                        const cumple = !mark;
                        return (
                          <li key={note.code}>
                            <button
                              type="button"
                              disabled={noteMutation.isPending || removeMutation.isPending}
                              onClick={() => {
                                if (mark) {
                                  removeMutation.mutate({ teamKey: team.key, noteId: mark.id });
                                  return;
                                }
                                noteMutation.mutate({
                                  teamKey: team.key,
                                  code: note.code,
                                  day,
                                  label: note.label,
                                  points: note.points,
                                });
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] ${
                                cumple
                                  ? "border-white/10 bg-slate-950/40 text-slate-100"
                                  : "border-rose-400/30 bg-rose-500/10 text-rose-50"
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                  cumple ? "border-emerald-300 bg-emerald-500 text-white" : "border-rose-300"
                                }`}
                                aria-hidden
                              >
                                {cumple ? "✓" : ""}
                              </span>
                              <span className="min-w-0 flex-1 font-semibold">{note.label}</span>
                              <span className="shrink-0 font-bold">{cumple ? note.points : `−${mark?.points ?? note.points}`}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-rose-100">
                      Nota a un integrante
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {memberNotes.map((note) => (
                        <span key={note.code} className="flex flex-wrap items-center gap-1">
                          <select
                            className="rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                            defaultValue=""
                            id={`${team.key}-${note.code}`}
                          >
                            <option value="">Quién…</option>
                            {team.members.map((member) => (
                              <option key={member.studentId} value={member.studentId}>
                                {member.displayName}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={noteMutation.isPending}
                            onClick={() => {
                              const select = document.getElementById(
                                `${team.key}-${note.code}`,
                              ) as HTMLSelectElement | null;
                              const studentId = select?.value ?? "";
                              if (!studentId) {
                                setNoteError("Elige a qué integrante aplica la llamada de atención.");
                                return;
                              }
                              noteMutation.mutate({ teamKey: team.key, code: note.code, studentId, day });
                            }}
                            className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                          >
                            {note.label} −{note.points}
                          </button>
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-rose-100">Otra nota</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <input
                        value={custom.label}
                        onChange={(e) =>
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { ...custom, label: e.target.value },
                          }))
                        }
                        placeholder="Motivo"
                        className="min-w-[8rem] flex-1 rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                      />
                      <input
                        value={custom.points}
                        onChange={(e) =>
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { ...custom, points: e.target.value },
                          }))
                        }
                        inputMode="numeric"
                        className="w-16 rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                      />
                      <select
                        value={custom.studentId}
                        onChange={(e) =>
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { ...custom, studentId: e.target.value },
                          }))
                        }
                        className="rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                      >
                        <option value="">Todo el equipo</option>
                        {team.members.map((member) => (
                          <option key={member.studentId} value={member.studentId}>
                            {member.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={noteMutation.isPending}
                        onClick={() => {
                          const points = Number(custom.points);
                          if (!custom.label.trim() || !Number.isFinite(points) || points < 1) {
                            setNoteError("Escribe el motivo y cuántos puntos se restan.");
                            return;
                          }
                          noteMutation.mutate({
                            teamKey: team.key,
                            code: "custom",
                            day,
                            label: custom.label.trim(),
                            points: Math.round(points),
                            studentId: custom.studentId || null,
                          });
                          setCustomByTeam((prev) => ({
                            ...prev,
                            [team.key]: { label: "", points: "50", studentId: "" },
                          }));
                        }}
                        className="rounded-lg bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                      >
                        Anotar
                      </button>
                    </div>

                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-emerald-100">
                      Reponer puntos
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Si alguien faltó y hoy trae justificante, reponle los puntos del día en que se los
                      restaste. También vale si ese día ya estaba guardado.
                    </p>
                    {team.notes.length ? (
                      <ul className="mt-2 space-y-1">
                        {[...team.notes]
                          .sort((a, b) => a.day.localeCompare(b.day))
                          .map((note) => (
                            <li
                              key={note.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/40 px-2 py-1 text-[11px] text-slate-200"
                            >
                              <span>
                                <span className="text-slate-400">{interfaceDayLabel(note.day)}</span>
                                {" · "}
                                {note.label}
                                {note.studentName ? ` · ${note.studentName}` : " · todo el equipo"}{" "}
                                <span className="text-amber-200">−{note.points}</span>
                              </span>
                              <button
                                type="button"
                                disabled={removeMutation.isPending}
                                onClick={() =>
                                  removeMutation.mutate({ teamKey: team.key, noteId: note.id })
                                }
                                className="shrink-0 rounded-md border border-emerald-400/40 px-2 py-0.5 font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                              >
                                Reponer
                              </button>
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-400">Sin notas que reponer.</p>
                    )}
                    <button
                      type="button"
                      disabled={awardMutation.isPending}
                      onClick={() => awardMutation.mutate({ day, teamKey: team.key })}
                      className="mt-2 w-full rounded-lg border border-emerald-400/30 bg-emerald-500/15 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
                    >
                      Guardar firmas de este día
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
