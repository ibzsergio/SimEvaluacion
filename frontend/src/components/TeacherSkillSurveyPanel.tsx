import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createTeacherProjectTeam,
  deleteTeacherProjectTeam,
  fetchTeacherSkillSurvey,
  getApiErrorMessage,
  suggestTeacherProjectTeams,
} from "../lib/api";
import type { ClassGroup, SkillRole, TeamSuggestion } from "../lib/types";

const ROLE_OPTIONS: Array<{ id: SkillRole; short: string }> = [
  { id: "scrum_master", short: "Scrum Master" },
  { id: "product_owner", short: "Product Owner" },
  { id: "developer", short: "Desarrollador" },
  { id: "ui_designer", short: "Diseño / UI" },
  { id: "qa_docs", short: "QA / Docs" },
];

export default function TeacherSkillSurveyPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [suggestion, setSuggestion] = useState<TeamSuggestion | null>(null);
  const [draftName, setDraftName] = useState("Equipo nuevo");
  const [draftMembers, setDraftMembers] = useState<Array<{ studentId: string; role: SkillRole }>>(
    [],
  );

  const query = useQuery({
    queryKey: ["teacher-skill-survey", selectedGroupId],
    queryFn: () => fetchTeacherSkillSurvey(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const unassignedStudents = useMemo(() => {
    const rows = query.data?.rows ?? [];
    return rows.filter((r) => !r.team);
  }, [query.data]);

  const suggestMutation = useMutation({
    mutationFn: () => suggestTeacherProjectTeams(selectedGroupId),
    onSuccess: (data) => {
      setSuggestion(data);
      setError("");
      setSuccess("Sugerencia lista. Revisa y guarda cada equipo.");
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      members: Array<{ studentId: string; role: string }>;
    }) => createTeacherProjectTeam(selectedGroupId, payload.name, payload.members),
    onSuccess: async () => {
      setSuccess("Equipo guardado.");
      setError("");
      setDraftMembers([]);
      await qc.invalidateQueries({ queryKey: ["teacher-skill-survey", selectedGroupId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeacherProjectTeam(selectedGroupId, teamId),
    onSuccess: async () => {
      setSuccess("Equipo eliminado.");
      await qc.invalidateQueries({ queryKey: ["teacher-skill-survey", selectedGroupId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function toggleDraftMember(studentId: string) {
    setDraftMembers((prev) => {
      if (prev.some((m) => m.studentId === studentId)) {
        return prev.filter((m) => m.studentId !== studentId);
      }
      if (prev.length >= 5) return prev;
      const row = query.data?.rows.find((r) => r.student.id === studentId);
      const role = (row?.profile?.suggestedRole ?? "developer") as SkillRole;
      return [...prev, { studentId, role }];
    });
  }

  function setDraftRole(studentId: string, role: SkillRole) {
    setDraftMembers((prev) => prev.map((m) => (m.studentId === studentId ? { ...m, role } : m)));
  }

  async function saveSuggestedTeam(team: TeamSuggestion["suggested"][number]) {
    try {
      await createTeacherProjectTeam(
        selectedGroupId,
        team.name,
        team.members.map((m) => ({ studentId: m.studentId, role: m.role })),
      );
      setSuccess(`Guardado: ${team.name}`);
      setError("");
      await qc.invalidateQueries({ queryKey: ["teacher-skill-survey", selectedGroupId] });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

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
        <h2 className="text-lg font-semibold text-white">Roles Scrum y equipos de proyecto</h2>
        <p className="mt-1 text-sm text-slate-400">
          Los alumnos contestan una encuesta (sin jerga técnica). Tú ves su perfil sugerido y formas
          equipos de <strong className="text-slate-300">4 o 5</strong> personas, equilibrados.
        </p>

        {query.data ? (
          <p className="mt-3 text-sm text-cyan-200">
            Encuesta completada: {query.data.completedCount} / {query.data.totalStudents}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={suggestMutation.isPending || query.isLoading}
            onClick={() => suggestMutation.mutate()}
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
          >
            {suggestMutation.isPending ? "Calculando..." : "Sugerir equipos equilibrados"}
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}
      </section>

      {suggestion ? (
        <section className="glass p-6">
          <h3 className="text-base font-semibold text-white">Sugerencia de equipos</h3>
          {suggestion.note ? (
            <p className="mt-2 text-xs text-amber-200">{suggestion.note}</p>
          ) : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {suggestion.suggested.map((team) => (
              <div key={team.name} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{team.name}</p>
                  <button
                    type="button"
                    onClick={() => void saveSuggestedTeam(team)}
                    className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-bold text-white"
                  >
                    Guardar equipo
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {team.members.map((m) => (
                    <li key={m.studentId}>
                      {m.displayName}{" "}
                      <span className="text-xs text-cyan-300/90">· {m.roleLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {suggestion.unassigned.length > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Sin asignar en la sugerencia:{" "}
              {suggestion.unassigned.map((u) => u.displayName).join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {query.data?.teams.length ? (
        <section className="glass p-6">
          <h3 className="text-base font-semibold text-white">Equipos guardados</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {query.data.teams.map((team) => (
              <div key={team.id} className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{team.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar ${team.name}?`)) deleteMutation.mutate(team.id);
                    }}
                    className="rounded-lg border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-200"
                  >
                    Eliminar
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {team.members.map((m) => (
                    <li key={m.studentId}>
                      {m.student.displayName}{" "}
                      <span className="text-xs text-emerald-300/90">· {m.roleLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="glass p-6">
        <h3 className="text-base font-semibold text-white">Armar equipo manual (4 o 5)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Elige alumnos sin equipo, ajusta roles y guarda.
        </p>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="mt-3 w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white"
          placeholder="Nombre del equipo"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {unassignedStudents.map((r) => {
            const selected = draftMembers.some((m) => m.studentId === r.student.id);
            return (
              <button
                key={r.student.id}
                type="button"
                onClick={() => toggleDraftMember(r.student.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  selected
                    ? "border-indigo-400 bg-indigo-500/20 text-indigo-100"
                    : "border-white/10 text-slate-400"
                }`}
              >
                {r.student.displayName}
                {!r.completed ? " (sin encuesta)" : ""}
              </button>
            );
          })}
        </div>
        {draftMembers.length > 0 ? (
          <div className="mt-4 space-y-2">
            {draftMembers.map((m) => {
              const student = query.data?.rows.find((r) => r.student.id === m.studentId)?.student;
              return (
                <div
                  key={m.studentId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2"
                >
                  <span className="min-w-[160px] text-sm text-white">{student?.displayName}</span>
                  <select
                    value={m.role}
                    onChange={(e) => setDraftRole(m.studentId, e.target.value as SkillRole)}
                    className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.short}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            <button
              type="button"
              disabled={
                createMutation.isPending || draftMembers.length < 4 || draftMembers.length > 5
              }
              onClick={() =>
                createMutation.mutate({
                  name: draftName,
                  members: draftMembers,
                })
              }
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Guardar equipo ({draftMembers.length}/5)
            </button>
          </div>
        ) : null}
      </section>

      <section className="glass p-6">
        <h3 className="mb-3 text-base font-semibold text-white">Perfiles de alumnos</h3>
        {query.isLoading ? (
          <p className="text-slate-400">Cargando...</p>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {(query.data?.rows ?? []).map((row) => (
              <div
                key={row.student.id}
                className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{row.student.displayName}</p>
                    <p className="text-xs text-slate-500">
                      Lista #{row.student.listPosition}
                      {row.student.controlNumber ? ` · ${row.student.controlNumber}` : ""}
                    </p>
                  </div>
                  {row.completed && row.profile ? (
                    <span className="rounded-lg bg-cyan-500/15 px-2 py-1 text-xs font-semibold text-cyan-100">
                      {row.profile.suggestedRoleLabel}
                    </span>
                  ) : (
                    <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-xs text-amber-200">
                      Pendiente de encuesta
                    </span>
                  )}
                </div>
                {row.profile ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {row.profile.dimensions.slice(0, 3).map((d) => (
                      <span key={d.key}>
                        {d.label}: {d.percent}%
                      </span>
                    ))}
                  </div>
                ) : null}
                {row.team ? (
                  <p className="mt-2 text-xs text-emerald-300">
                    {row.team.teamName} · {row.team.roleLabel}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
