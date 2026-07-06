import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStudentOfficeExam,
  getApiErrorMessage,
  startOfficeExam,
  submitOfficeExam,
  syncOfficeExamAnswers,
} from "../lib/api";
import type { OfficeExamQuestion, OfficeExamState } from "../lib/types";

const DRAFT_KEY = "simevaluacion-office-exam-draft";

function loadLocalDraft(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveLocalDraft(answers: Record<string, string>) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
}

function clearLocalDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function programLabel(p: string) {
  if (p === "WORD") return "Microsoft Word";
  if (p === "POWERPOINT") return "Microsoft PowerPoint";
  if (p === "EXCEL") return "Microsoft Excel";
  return p;
}

export default function StudentOfficeExam() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["office-exam-student"],
    queryFn: fetchStudentOfficeExam,
    refetchOnWindowFocus: true,
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const syncTimer = useRef<number | null>(null);

  const data = query.data;

  useEffect(() => {
    if (!data) return;
    if (data.status === "IN_PROGRESS" && data.answers) {
      const merged = { ...data.answers, ...loadLocalDraft() };
      setAnswers(merged);
      setStarted(true);
    }
    if (data.status === "SUBMITTED") clearLocalDraft();
  }, [data]);

  const syncMutation = useMutation({
    mutationFn: syncOfficeExamAnswers,
  });

  const scheduleSync = useCallback(
    (next: Record<string, string>) => {
      saveLocalDraft(next);
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        if (navigator.onLine) {
          syncMutation.mutate(next);
        }
      }, 1500);
    },
    [syncMutation],
  );

  useEffect(() => {
    const onOnline = () => {
      if (!started || Object.keys(answers).length === 0) return;
      syncMutation.mutate(answers);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [answers, started, syncMutation]);

  const startMutation = useMutation({
    mutationFn: startOfficeExam,
    onSuccess: (state) => {
      setStarted(true);
      if (state.status === "IN_PROGRESS" && state.answers) {
        const merged = { ...state.answers, ...loadLocalDraft() };
        setAnswers(merged);
      }
      qc.setQueryData(["office-exam-student"], state);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitOfficeExam(answers),
    onSuccess: (state) => {
      clearLocalDraft();
      qc.setQueryData(["office-exam-student"], state);
    },
  });

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v).length,
    [answers],
  );

  if (query.isLoading) return null;
  if (!data || !data.available && data.reason === "disabled") return null;
  if (!data.available && data.reason !== "disabled") return null;

  if (data.status === "SUBMITTED") {
    return (
      <section className="glass mb-6 border border-emerald-400/30 p-6">
        <h2 className="text-lg font-semibold text-white">Examen Office 2019 — Resultado</h2>
        <p className="mt-2 text-sm text-slate-300">
          Respondiste correctamente{" "}
          <strong className="text-cyan-300">{data.correctCount ?? 0} de 75</strong> preguntas.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ResultCard label="Puntos examen (de 4)" value={(data.examScore4 ?? 0).toFixed(1)} />
          <ResultCard label="Puntos firmas (de 6)" value={(data.firmasScore6 ?? 0).toFixed(1)} />
          <ResultCard
            label="Calificación materia"
            value={`${(data.finalGrade ?? 0).toFixed(1)} / 10`}
            highlight
          />
        </div>
        {data.isExempt ? (
          <p className="mt-3 text-sm text-emerald-200">
            Eres EXENTADO: tu calificación final permanece en 10 aunque hayas realizado el examen.
          </p>
        ) : null}
      </section>
    );
  }

  if (!started && data.status === "NOT_STARTED") {
    return (
      <section className="glass mb-6 border border-indigo-400/30 p-6">
        <h2 className="text-lg font-semibold text-white">Examen Office 2019</h2>
        <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-900/60 p-4 text-xs leading-relaxed text-slate-300">
          {data.instructions}
        </pre>
        <div className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3 text-sm text-slate-300">
          <p>
            Tu lugar: <strong className="text-white">#{data.place}</strong> · Firmas:{" "}
            <strong className="text-white">{data.totalFirmas}</strong>
            {data.isExempt ? (
              <span className="ml-2 text-emerald-300">(EXENTADO — calificación 10)</span>
            ) : (
              <span>
                {" "}
                · Proyección sin examen: <strong>{data.projectedGradeWithoutExam?.toFixed(1)}</strong>
                /10
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={startMutation.isPending}
          onClick={() => startMutation.mutate()}
          className="mt-4 rounded-xl bg-indigo-500 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-60"
        >
          {startMutation.isPending ? "Iniciando..." : "Iniciar examen"}
        </button>
        {startMutation.isError ? (
          <p className="mt-2 text-sm text-rose-300">{getApiErrorMessage(startMutation.error)}</p>
        ) : null}
      </section>
    );
  }

  const questions = (data as OfficeExamState & { questions: OfficeExamQuestion[] }).questions ?? [];

  return (
    <section className="glass mb-6 p-6">
      <div className="sticky top-0 z-10 -mx-6 mb-4 border-b border-white/10 bg-slate-900/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-white">Examen en progreso</h2>
            <p className="text-xs text-slate-400">
              {answeredCount}/75 respondidas · autoguardado local
              {syncMutation.isPending ? " · sincronizando..." : navigator.onLine ? " · en línea" : " · sin conexión"}
            </p>
          </div>
          <button
            type="button"
            disabled={submitMutation.isPending || answeredCount === 0}
            onClick={() => {
              const ok = window.confirm(
                `¿Finalizar examen con ${answeredCount} respuestas?\n\nNo podrás modificarlas después.`,
              );
              if (!ok) return;
              submitMutation.mutate();
            }}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitMutation.isPending ? "Enviando..." : "Finalizar examen"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {(["WORD", "POWERPOINT", "EXCEL"] as const).map((program) => {
          const block = questions.filter((q) => q.program === program);
          if (!block.length) return null;
          return (
            <div key={program}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-400">
                {programLabel(program)}
              </h3>
              <div className="space-y-4">
                {block.map((q) => (
                  <QuestionCard
                    key={q.id}
                    index={q.sortOrder + 1}
                    question={q}
                    value={answers[q.id] ?? ""}
                    onChange={(opt) => {
                      const next = { ...answers, [q.id]: opt };
                      setAnswers(next);
                      scheduleSync(next);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {submitMutation.isError ? (
        <p className="mt-4 text-sm text-rose-300">{getApiErrorMessage(submitMutation.error)}</p>
      ) : null}
    </section>
  );
}

function QuestionCard({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: OfficeExamQuestion;
  value: string;
  onChange: (opt: string) => void;
}) {
  const opts = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ];
  return (
    <article className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm font-medium text-white">
        {index}. {question.questionText}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {opts.map((o) => (
          <label
            key={o.key}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              value === o.key
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={o.key}
              checked={value === o.key}
              onChange={() => onChange(o.key)}
              className="mt-1"
            />
            <span>
              <strong>{o.key})</strong> {o.text}
            </span>
          </label>
        ))}
      </div>
    </article>
  );
}

function ResultCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${highlight ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}
    >
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-cyan-300" : "text-white"}`}>{value}</p>
    </div>
  );
}
