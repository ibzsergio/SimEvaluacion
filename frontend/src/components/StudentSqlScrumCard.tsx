import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudentComms, fetchStudentSqlDelivery, getApiErrorMessage, uploadSqlPdf } from "../lib/api";
import {
  SQL_SCRUM_PDF_MAX_BYTES,
  SQL_SCRUM_PUNTOS,
  sqlScrumActivity,
  sqlScrumCierre,
  sqlScrumGithubChecks,
  sqlScrumPuntosDe,
  type SqlScrumKey,
} from "../lib/sqlScrum";
import { sqlScrumStateFromAnnouncements } from "../lib/sqlScrumLive";
import SqlScrumGithubSteps from "./SqlScrumGithubSteps";

export default function StudentSqlScrumCard({
  activityKey,
  groupCode,
  studentId,
}: {
  activityKey: SqlScrumKey;
  groupCode?: string | null;
  studentId?: string | null;
}) {
  const activity = sqlScrumActivity(activityKey);
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const cierre = sqlScrumCierre(groupCode, now);
  const abierto = cierre.open;
  const comms = useQuery({
    queryKey: ["student-comms"],
    queryFn: fetchStudentComms,
    staleTime: 4_000,
    refetchInterval: 8_000,
  });
  const deliveryQuery = useQuery({
    queryKey: ["student-sql-delivery", activityKey],
    queryFn: () => fetchStudentSqlDelivery(activityKey),
    retry: false,
    refetchInterval: 15_000,
  });
  const uploadMutation = useMutation({
    mutationFn: (next: File) => uploadSqlPdf(activityKey, next),
    onSuccess: async () => {
      setLocalError("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["student-sql-delivery", activityKey] });
    },
    onError: (error) => setLocalError(getApiErrorMessage(error)),
  });
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const code = groupCode?.trim();
  if (code !== "301" && code !== "302") return null;

  const checks = code === "302" ? [...activity.checks, ...sqlScrumGithubChecks(activityKey)] : activity.checks;
  const ready = checks.every((item) => checked[item.id]);
  const delivery = deliveryQuery.data?.delivery ?? null;
  const teamNotes =
    sqlScrumStateFromAnnouncements(comms.data?.announcements ?? [], activityKey).notes[deliveryQuery.data?.teamKey ?? ""] ??
    [];
  const myNotes = teamNotes.filter((note) => !note.studentId || note.studentId === studentId);

  function chooseFile(next: File | null) {
    setLocalError("");
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.name.toLowerCase().endsWith(".pdf") && next.type !== "application/pdf") {
      setFile(null);
      setLocalError("Solo se puede subir un PDF.");
      return;
    }
    if (next.size > SQL_SCRUM_PDF_MAX_BYTES) {
      setFile(null);
      setLocalError("El PDF pesa más de 8 MB. Redúcelo y vuelve a elegirlo.");
      return;
    }
    setFile(next);
  }

  return (
    <section className="glass mb-6 border border-emerald-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Actividad Scrum · equipo de proyecto</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{activity.title}</h2>
      <p className="mt-3 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950">
        Vale {SQL_SCRUM_PUNTOS.toLocaleString("es-MX")} puntos.
      </p>
      <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${abierto ? "bg-rose-500 text-white" : "bg-rose-950 text-rose-100"}`}>
        {cierre.texto}
        {cierre.until > 0 && !abierto ? " Esa hora ya pasó." : ""}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{activity.contexto}</p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-100">
        {activity.pasos.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
      {code === "302" ? <SqlScrumGithubSteps activityKey={activityKey} /> : null}
      <ul className="mt-4 space-y-2">
        {checks.map((item) => (
          <li key={item.id}>
            <label className="flex items-start gap-2 text-sm text-slate-100">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(checked[item.id])}
                onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
              />
              <span>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3">
        <p className="text-sm font-semibold text-white">
          {deliveryQuery.data?.teamName ? `Equipo ${deliveryQuery.data.teamName}. ` : ""}
          Un integrante sube un solo PDF, de máximo 8 MB. Si lo vuelven a subir, reemplaza el anterior.
        </p>
        {delivery ? (
          <p className="mt-2 text-sm text-emerald-100">
            Ya está el archivo {delivery.fileName}, lo subió {delivery.uploadedByName}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-300">El equipo todavía no sube el PDF.</p>
        )}
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={!ready || !abierto || uploadMutation.isPending}
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950 disabled:opacity-50"
        />
        {file ? <p className="mt-2 text-sm text-slate-200">{file.name}</p> : null}
        <button
          type="button"
          disabled={!ready || !file || !abierto || uploadMutation.isPending}
          onClick={() => file && uploadMutation.mutate(file)}
          className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          {uploadMutation.isPending ? "Subiendo…" : delivery ? "Reemplazar PDF" : "Subir PDF"}
        </button>
        {myNotes.length > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <p className="font-semibold">
              {studentId && delivery
                ? `${sqlScrumPuntosDe(teamNotes, studentId).toLocaleString("es-MX")} de ${SQL_SCRUM_PUNTOS.toLocaleString("es-MX")} puntos`
                : "El docente anotó una resta"}
            </p>
            <ul className="mt-1 space-y-1">
              {myNotes.map((note) => (
                <li key={note.id}>
                  −{note.points} {note.label}
                  {note.studentName ? "" : " · equipo"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!abierto ? (
          <p className="mt-2 text-sm font-semibold text-rose-200">Ya no se acepta el archivo. El equipo pierde los 2000 puntos.</p>
        ) : !ready ? (
          <p className="mt-2 text-sm text-slate-400">Marca todas las casillas para poder elegir el archivo.</p>
        ) : null}
        {localError ? <p className="mt-2 text-sm text-rose-200">{localError}</p> : null}
        {deliveryQuery.isError ? <p className="mt-2 text-sm text-rose-200">{getApiErrorMessage(deliveryQuery.error)}</p> : null}
      </div>
    </section>
  );
}
