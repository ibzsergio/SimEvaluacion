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
  INTERFACE_DAYS,
  INTERFACE_MAX_POINTS,
  INTERFACE_NOTES,
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
  const pointsMax = session?.pointsMax ?? INTERFACE_MAX_POINTS;

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
    onSuccess: (data) => {
      setNoteError("");
      qc.setQueryData(["interface-session", selectedGroupId], data);
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
              Cada equipo parte de {pointsMax.toLocaleString("es-MX")} firmas. Anota el día que estás
              viendo. Registrar este día guarda esas notas: si no hubo ninguna, las firmas se mantienen;
              si las hubo, se restan. En cuanto la liberes, el alumno ve si bajan o siguen igual. El
              jueves 22 se publica como actividad.
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
              const dayRegistered = team.awardedDays.includes(day);
              const dayCut = dayNotes.reduce((acc, note) => acc + note.points, 0);
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
                          {member.points.toLocaleString("es-MX")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Firmas con las notas anotadas
                    {dayCut > 0 ? ` · este día resta ${dayCut.toLocaleString("es-MX")} al guardarlo` : ""}
                  </p>

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-rose-100">Notas al equipo</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {teamNotes.map((note) => {
                        const used = dayNotes.some((item) => item.code === note.code);
                        return (
                          <button
                            key={note.code}
                            type="button"
                            disabled={noteMutation.isPending || used}
                            onClick={() => noteMutation.mutate({ teamKey: team.key, code: note.code, day })}
                            className="rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
                          >
                            {note.label} −{note.points}
                          </button>
                        );
                      })}
                    </div>

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

                    {dayNotes.length ? (
                      <ul className="mt-2 space-y-1">
                        {dayNotes.map((note) => (
                          <li
                            key={note.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/40 px-2 py-1 text-[11px] text-slate-200"
                          >
                            <span>
                              {note.label}
                              {note.studentName ? ` · ${note.studentName}` : ""}{" "}
                              <span className="text-amber-200">−{note.points}</span>
                            </span>
                            <button
                              type="button"
                              disabled={removeMutation.isPending}
                              onClick={() => removeMutation.mutate({ teamKey: team.key, noteId: note.id })}
                              className="text-rose-200 hover:text-white"
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Sin notas este día.
                      </p>
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
