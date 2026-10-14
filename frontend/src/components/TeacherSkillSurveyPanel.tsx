import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  assignTeacherStudentRole,
  createTeacherProjectTeam,
  deleteTeacherProjectTeam,
  replaceTeacherProjectTeams,
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

  const assignedCount = query.data?.assignedCount ?? query.data?.rows.filter((r) => r.assignedRole).length ?? 0;

  const roleMutation = useMutation({
    mutationFn: ({ studentId, role }: { studentId: string; role: SkillRole }) =>
      assignTeacherStudentRole(selectedGroupId, studentId, role),
    onSuccess: async (data) => {
      setError("");
      setSuccess("Rol guardado.");
      qc.setQueryData(["teacher-skill-survey", selectedGroupId], data);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const suggestMutation = useMutation({
    mutationFn: () => suggestTeacherProjectTeams(selectedGroupId),
    onSuccess: (data) => {
      setSuggestion(data);
      setError("");
      setSuccess("Sugerencia lista. Quienes no contestaron encuesta van mezclados. En 301 guarda los 6 equipos de una vez.");
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      members: Array<{ studentId: string; role: string }>;
    }) => createTeacherProjectTeam(selectedGroupId, payload.name, payload.members),
    onSuccess: async () => {
      setSuccess("Equipo guardado. El Scrum Master queda como líder sugerido.");
      setError("");
      setDraftMembers([]);
      setSuggestion(null);
      await qc.invalidateQueries({ queryKey: ["teacher-skill-survey", selectedGroupId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const replaceMutation = useMutation({
    mutationFn: (teams: Array<{ name: string; members: Array<{ studentId: string; role: string }> }>) =>
      replaceTeacherProjectTeams(selectedGroupId, teams),
    onSuccess: async (data) => {
      setSuccess("Se guardaron los 6 equipos. Quienes no contestaron encuesta quedaron mezclados.");
      setError("");
      setSuggestion(null);
      qc.setQueryData(["teacher-skill-survey", selectedGroupId], data);
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
      const role = (row?.assignedRole ?? row?.profile?.suggestedRole ?? "developer") as SkillRole;
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
        <h2 className="text-lg font-semibold text-white">Roles y equipos del proyecto</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tú asignas el rol de cada alumno y formas los equipos. Quienes no contestaron encuesta también
          entran, mezclados, con el rol que les pongas: no van en un equipo aparte. En 301 son{" "}
          <strong className="text-slate-300">6 equipos de 5</strong>. El alumno solo ve su rol, su equipo
          y puede elegir líder (de preferencia el Scrum Master).
        </p>
        {query.data ? (
          <p className="mt-3 text-sm text-cyan-200">
            Roles asignados: {assignedCount} / {query.data.totalStudents}
          </p>
        ) : null}
        {query.data?.skipped?.length ? (
          <p className="mt-2 text-xs text-slate-500">
            No entran: {query.data.skipped.map((s) => s.displayName).join(", ")}.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={suggestMutation.isPending || query.isLoading}
            onClick={() => suggestMutation.mutate()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500 disabled:opacity-60"
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

      <section className="glass p-6">
        <h3 className="mb-3 text-base font-semibold text-white">Asignar roles</h3>
        {query.isLoading ? (
          <p className="text-slate-400">Cargando...</p>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {(query.data?.rows ?? []).map((row) => (
              <div
                key={row.student.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">{row.student.displayName}</p>
                  <p className="text-xs text-slate-500">
                    Lista #{row.student.listPosition}
                    {row.team ? ` · ${row.team.teamName}` : " · sin equipo"}
                  </p>
                </div>
                <select
                  value={row.assignedRole ?? ""}
                  disabled={roleMutation.isPending}
                  onChange={(e) => {
                    const role = e.target.value as SkillRole;
                    if (!role) return;
                    roleMutation.mutate({ studentId: row.student.id, role });
                  }}
                  className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">Sin rol</option>
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.short}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {suggestion ? (
        <section className="glass p-6">
          <h3 className="text-base font-semibold text-white">Sugerencia de equipos</h3>
          {suggestion.note ? (
            <p className="mt-2 text-xs text-amber-200">{suggestion.note}</p>
          ) : null}
          {suggestion.suggested.length > 0 &&
          suggestion.suggested.every((t) => t.members.length >= 4 && t.members.length <= 5) ? (
            <button
              type="button"
              disabled={replaceMutation.isPending}
              onClick={() =>
                replaceMutation.mutate(
                  suggestion.suggested.map((team) => ({
                    name: team.name,
                    members: team.members.map((m) => ({ studentId: m.studentId, role: m.role })),
                  })),
                )
              }
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500 disabled:opacity-60"
            >
              {replaceMutation.isPending
                ? "Guardando..."
                : query.data?.group.code.trim() === "301"
                  ? "Guardar los 6 equipos (reemplaza los anteriores)"
                  : "Guardar todos los equipos (reemplaza los anteriores)"}
            </button>
          ) : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {suggestion.suggested.map((team) => (
              <div key={team.name} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{team.name}</p>
                  {query.data?.group.code.trim() === "301" ? (
                    <span className="text-xs text-slate-500">{team.members.length} integrantes</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void saveSuggestedTeam(team)}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-[#ffffff] hover:bg-emerald-500"
                    >
                      Guardar equipo
                    </button>
                  )}
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
                  <div>
                    <p className="font-semibold text-white">{team.name}</p>
                    <p className="text-xs text-emerald-200">
                      {team.leaderName
                        ? `Líder: ${team.leaderName}`
                        : "Aún no eligen líder (preferible el Scrum Master)"}
                    </p>
                  </div>
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
        <p className="mt-1 text-xs text-slate-500">Elige alumnos sin equipo, ajusta roles y guarda.</p>
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
                {r.assignedRoleLabel ? ` · ${r.assignedRoleLabel}` : ""}
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
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500 disabled:opacity-50"
            >
              Guardar equipo ({draftMembers.length}/5)
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
