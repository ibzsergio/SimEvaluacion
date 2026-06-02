import { useQuery } from "@tanstack/react-query";
import BadgeDisplay from "../components/BadgeDisplay";
import Layout from "../components/Layout";
import { fetchStudentProgress } from "../lib/api";
import type { ActivityStatus, StudentActivity } from "../lib/types";

export default function StudentPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-progress"],
    queryFn: fetchStudentProgress,
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <Layout title="Tu aventura académica" subtitle="Cargando tu progreso...">
        <div className="glass animate-pulse p-10 text-center text-slate-400">Preparando el tablero...</div>
      </Layout>
    );
  }

  const { summary } = data;
  const progress = data.courseProgress;
  const progressPct = progress.percent;

  const pendingActivities = data.activities.filter((a) => a.status === "pending");
  const gradedActivities = data.activities.filter((a) => a.status === "graded");

  return (
    <Layout
      title="Tu aventura académica"
      subtitle={
        data.group
          ? `Grupo ${data.group.code} · ${data.group.shift} · Lista #${data.my.listNumber ?? "—"}`
          : "Sigue tus prácticas y entregas"
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Publicadas" value={summary.total} color="text-white" />
        <StatCard label="Pendientes" value={summary.pending} color="text-amber-300" />
        <StatCard label="Vencidas" value={summary.overdue} color="text-rose-300" />
        <StatCard label="Calificadas" value={summary.graded} color="text-emerald-300" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass relative overflow-hidden p-6 lg:col-span-1">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Tu posición</p>
          <p className="mt-2 text-6xl font-extrabold text-white">
            #{data.my.place}
            <span className="text-lg font-medium text-slate-400"> / {data.my.totalStudents}</span>
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Puntos totales: <span className="font-bold text-cyan-300">{data.my.score}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">{data.rankingRule}</p>
          <div className="mt-4">
            <BadgeDisplay badge={data.my.badge} />
          </div>
          <div className="mt-6">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{progress.closed ? "Resultado final" : "Avance del periodo"}</span>
              <span>
                {progress.current}/{progress.total} · {progressPct}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </section>

        <section className="glass p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <span>🏁</span> Top 10 del grupo
          </h2>
          <ol className="space-y-2">
            {data.top10.map((entry) => {
              const place = entry.place;
              const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : `${place}.`;
              return (
                <li
                  key={entry.studentId}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{medal}</span>
                    <span className="font-medium text-white">
                      {entry.listNumber != null ? `${entry.listNumber}. ` : ""}
                      {entry.displayName}
                    </span>
                  </div>
                  <span className="font-bold text-cyan-300">{entry.score} pts</span>
                </li>
              );
            })}
            {!data.top10.length ? (
              <p className="text-sm text-slate-500">Aún no hay puntajes en el grupo.</p>
            ) : null}
          </ol>
        </section>
      </div>

      {pendingActivities.length > 0 ? (
        <ActivitySection
          title="Pendientes"
          subtitle="Estas actividades no tienen calificación registrada todavía."
          activities={pendingActivities}
        />
      ) : null}

      {gradedActivities.length > 0 ? (
        <ActivitySection
          title="Calificadas"
          subtitle="Ya tienes puntaje en estas actividades."
          activities={gradedActivities}
        />
      ) : null}

      {!data.activities.length ? (
        <section className="glass mt-6 p-8 text-center text-slate-400">
          Todavía no hay actividades publicadas para tu grupo.
        </section>
      ) : null}
    </Layout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-xl px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ActivitySection({
  title,
  subtitle,
  activities,
}: {
  title: string;
  subtitle: string;
  activities: StudentActivity[];
}) {
  return (
    <section className="glass mt-6 p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mb-4 text-sm text-slate-400">{subtitle}</p>
      <div className="space-y-3">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
          />
        ))}
      </div>
    </section>
  );
}

function ActivityCard({
  activity,
}: {
  activity: StudentActivity;
}) {
  const graded = activity.status === "graded";
  const pct = graded
    ? Math.round((activity.grade!.points / activity.maxPoints) * 100)
    : 0;

  return (
    <article
      className={`rounded-2xl border p-4 ${
        graded
          ? "border-emerald-400/30 bg-emerald-500/5"
          : activity.isOverdue
            ? "border-rose-400/30 bg-rose-500/5"
            : "border-amber-400/25 bg-amber-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{activity.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            Publicada: <span className="text-slate-300">{formatDateTime(activity.publishedAt)}</span>
          </p>
          <p className="text-xs text-slate-500">
            Fecha de la actividad: {formatDate(activity.date)} · Valor: {activity.maxPoints} pts
          </p>
          {!graded && activity.isOverdue ? (
            <p className="mt-1 text-xs text-rose-300">Vencida (puede requerir justificante)</p>
          ) : null}
          {graded && activity.grade ? (
            <p className="mt-2 text-sm text-slate-300">
              Obtuviste{" "}
              <span className="font-bold text-white">
                {activity.grade.points} de {activity.maxPoints}
              </span>{" "}
              puntos
              <span className="text-slate-500">
                {" "}
                · Calificado: {formatDateTime(activity.grade.gradedAt)}
              </span>
            </p>
          ) : null}
        </div>
        <StatusBadge status={activity.status} />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            graded ? "bg-emerald-400" : activity.isOverdue ? "bg-rose-400/70" : "bg-amber-400/70"
          }`}
          style={{ width: `${Math.max(pct, 8)}%` }}
        />
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  const styles = {
    pending: "bg-amber-500/20 text-amber-200",
    graded: "bg-emerald-500/20 text-emerald-200",
  };
  const labels = {
    pending: "Por entregar",
    graded: "Calificada",
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
