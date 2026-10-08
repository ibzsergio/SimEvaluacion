import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchStudentSkillSurvey,
  getApiErrorMessage,
  submitStudentSkillSurvey,
} from "../lib/api";

const SCALE = [
  { value: 1, label: "Nada" },
  { value: 2, label: "Poco" },
  { value: 3, label: "Regular" },
  { value: 4, label: "Bastante" },
  { value: 5, label: "Mucho" },
];

export default function StudentSkillSurveyPanel() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["student-skill-survey"],
    queryFn: fetchStudentSkillSurvey,
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.data?.profile?.answers) {
      setAnswers(query.data.profile.answers);
    } else if (query.data?.definition.questions) {
      const init: Record<string, number> = {};
      for (const q of query.data.definition.questions) init[q.id] = 0;
      setAnswers(init);
    }
  }, [query.data]);

  const unanswered = useMemo(() => {
    const qs = query.data?.definition.questions ?? [];
    return qs.filter((q) => !answers[q.id] || answers[q.id]! < 1).length;
  }, [answers, query.data]);

  const mutation = useMutation({
    mutationFn: () => submitStudentSkillSurvey(answers),
    onSuccess: async () => {
      setSuccess("¡Listo! Ya puedes ver tu perfil sugerido.");
      setError("");
      await qc.invalidateQueries({ queryKey: ["student-skill-survey"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (query.isLoading) {
    return (
      <section className="glass mb-6 px-4 py-3 text-sm text-slate-400">Cargando encuesta de roles...</section>
    );
  }

  if (query.isError) {
    return (
      <section className="glass mb-6 border border-rose-400/30 px-4 py-3 text-sm text-rose-200">
        No se pudo cargar la encuesta. Recarga la página.
      </section>
    );
  }

  const data = query.data!;
  const profile = data.profile;
  const statusLine = profile
    ? data.team
      ? `Perfil: ${profile.suggestedRoleLabel} · Equipo ${data.team.name}`
      : `Perfil: ${profile.suggestedRoleLabel}`
    : unanswered > 0
      ? `Faltan ${unanswered} pregunta(s)`
      : "Lista para enviar";

  return (
    <section className="glass mb-6 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white sm:text-lg">Encuesta de roles — Proyecto Scrum</h2>
          <p className={`mt-0.5 text-xs sm:text-sm ${unanswered > 0 && !profile ? "text-amber-300" : "text-slate-400"}`}>
            {statusLine}
          </p>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 sm:px-5">
          <p className="text-sm text-slate-400">
            Responde con sinceridad (no hay respuestas incorrectas). Nos ayuda a formar equipos
            equilibrados (máx. 5 personas) para el proyecto con Python, pantallas y base de datos.
          </p>

          {profile ? (
            <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/90">Tu perfil sugerido</p>
              <p className="mt-1 text-lg font-bold text-white">{profile.suggestedRoleLabel}</p>
              <div className="mt-2 space-y-2">
                {profile.dimensions.map((d) => (
                  <div key={d.key}>
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>{d.label}</span>
                      <span>
                        {d.score}/{d.max} ({d.percent}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-400"
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {data.team ? (
                <p className="mt-3 text-sm text-emerald-200">
                  Equipo asignado: <strong>{data.team.name}</strong> · Rol: {data.team.roleLabel}
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  El docente formará los equipos. Puedes volver a contestar si quieres actualizar tu perfil.
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {data.definition.questions.map((q, index) => (
              <div key={q.id} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5">
                <p className="text-sm font-medium text-white">
                  <span className="mr-2 text-cyan-300">{index + 1}.</span>
                  {q.text}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SCALE.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        answers[q.id] === opt.value
                          ? "bg-indigo-500 text-white"
                          : "border border-white/10 text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      {opt.value} · {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={mutation.isPending || unanswered > 0}
              onClick={() => mutation.mutate()}
              className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {mutation.isPending
                ? "Guardando..."
                : profile
                  ? "Actualizar mis respuestas"
                  : "Enviar encuesta"}
            </button>
            {unanswered > 0 ? (
              <span className="text-xs text-amber-300">Faltan {unanswered} pregunta(s)</span>
            ) : (
              <span className="text-xs text-slate-500">Todas contestadas</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
