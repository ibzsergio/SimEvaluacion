import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chooseStudentProjectLeader,
  fetchStudentSkillSurvey,
  getApiErrorMessage,
} from "../lib/api";

export default function StudentSkillSurveyPanel() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["student-skill-survey"],
    queryFn: fetchStudentSkillSurvey,
    refetchInterval: 8000,
  });
  const [nomineeId, setNomineeId] = useState("");
  const [error, setError] = useState("");

  const team = query.data?.team ?? null;
  const preferred = team?.preferredLeaderId ?? "";
  const members = team?.members ?? [];

  useEffect(() => {
    setNomineeId(team?.leaderId || preferred || members[0]?.studentId || "");
  }, [team?.id, team?.leaderId, preferred, members[0]?.studentId]);

  const leaderMutation = useMutation({
    mutationFn: (leaderId: string) => chooseStudentProjectLeader(leaderId),
    onSuccess: async (data) => {
      setError("");
      qc.setQueryData(["student-skill-survey"], data);
      await qc.invalidateQueries({ queryKey: ["student-skill-survey"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (query.isLoading) {
    return (
      <section className="glass mb-6 px-4 py-3 text-sm text-slate-400">Cargando tu rol de proyecto...</section>
    );
  }

  if (query.isError) {
    return (
      <section className="glass mb-6 border border-rose-400/30 px-4 py-3 text-sm text-rose-200">
        No se pudo cargar tu rol. Recarga la página.
      </section>
    );
  }

  const roleLabel = query.data?.assignedRoleLabel ?? query.data?.profile?.suggestedRoleLabel ?? null;

  function confirmLeader() {
    if (!nomineeId) {
      setError("Marquen quién será el líder. De preferencia el Scrum Master.");
      return;
    }
    leaderMutation.mutate(nomineeId);
  }

  return (
    <section className="glass mb-6 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Proyecto Scrum</p>
      <h2 className="mt-1 text-lg font-bold text-white">Tu rol y equipo</h2>

      {roleLabel ? (
        <p className="mt-3 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-3 text-base font-semibold text-white">
          Tu rol: {roleLabel}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-400">El docente te asignará un rol. Aquí verás cuál te toca.</p>
      )}

      {team ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Tu equipo</p>
          <h3 className="mt-1 text-lg font-bold text-white">{team.name}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {team.leaderName
              ? `Líder: ${team.leaderName}`
              : "Elijan un líder. De preferencia el Scrum Master."}
          </p>
          <ul className="mt-3 space-y-2">
            {members.map((m) => (
              <li key={m.studentId}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    name="project-leader"
                    value={m.studentId}
                    checked={nomineeId === m.studentId}
                    disabled={leaderMutation.isPending}
                    onChange={() => setNomineeId(m.studentId)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold text-white">{m.displayName}</span>
                    <span className="text-slate-400"> · {m.roleLabel}</span>
                    {m.role === "scrum_master" ? (
                      <span className="ml-1 text-xs font-semibold text-amber-200">(preferido como líder)</span>
                    ) : null}
                    {m.studentId === team.leaderId ? (
                      <span className="ml-1 text-xs text-emerald-300">· líder actual</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={confirmLeader}
            disabled={leaderMutation.isPending || !nomineeId}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500 disabled:opacity-60"
          >
            {leaderMutation.isPending ? "Guardando líder..." : "Confirmar líder del equipo"}
          </button>
          {error ? (
            <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      ) : roleLabel ? (
        <p className="mt-3 text-sm text-slate-400">
          Ya tienes rol. Cuando el docente forme los equipos, aquí verás a tus compañeros y el rol de cada
          uno.
        </p>
      ) : null}
    </section>
  );
}
