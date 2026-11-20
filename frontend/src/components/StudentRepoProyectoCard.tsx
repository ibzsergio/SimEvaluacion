import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  addRepoLeaderNote,
  fetchStudentRepoProyecto,
  getApiErrorMessage,
  removeRepoLeaderNote,
  saveRepoProyectoLink,
  startRepoProyectoClock,
  uploadRepoProyectoPdf,
} from "../lib/api";
import {
  formatoHoraClase,
  formatoReloj,
  REPO_PROYECTO_DOCENTE,
  REPO_PROYECTO_INSTRUCTIVO,
  REPO_PROYECTO_NOTAS_LIDER,
  REPO_PROYECTO_PDF_MAX_BYTES,
  REPO_PROYECTO_TABLAS,
  REPO_PROYECTO_TITULO,
  repoAbierto,
  repoEntrega,
  repoCierre,
  repoRestante,
  repoTramos,
} from "../lib/repoProyecto";

const CHECKS = [
  { id: "caratula", label: "La primera hoja es la carátula de Canva, con los datos del equipo, el nombre del proyecto y el título Repositorio Proyecto en GitHub." },
  { id: "repo", label: "Se ve cómo crearon el repositorio y la liga." },
  { id: "integrantes", label: "Cada integrante tiene un separador con su nombre y sus evidencias: la clonación y sus cambios." },
  { id: "crud", label: "Se ven los CRUD funcionando y guardando en la base de XAMPP." },
  { id: "git", label: "Se ven los comandos básicos de Git al subir cambios y, al final, los commits de cada integrante." },
];

export default function StudentRepoProyectoCard({ groupCode }: { groupCode?: string | null }) {
  const code = groupCode?.trim();
  const visible = code === "301" || code === "302";
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [liga, setLiga] = useState("");
  const [detalle, setDetalle] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["student-repo-proyecto"],
    queryFn: fetchStudentRepoProyecto,
    enabled: visible,
    retry: false,
    refetchInterval: visible ? 10_000 : false,
  });
  const startMutation = useMutation({
    mutationFn: startRepoProyectoClock,
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["student-repo-proyecto"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const leaderNoteMutation = useMutation({
    mutationFn: addRepoLeaderNote,
    onSuccess: async (_data, variables) => {
      setError("");
      setDetalle((prev) => ({ ...prev, [variables.studentId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["student-repo-proyecto"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const removeLeaderNoteMutation = useMutation({
    mutationFn: removeRepoLeaderNote,
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["student-repo-proyecto"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const linkMutation = useMutation({
    mutationFn: saveRepoProyectoLink,
    onSuccess: async () => {
      setError("");
      setLiga("");
      await queryClient.invalidateQueries({ queryKey: ["student-repo-proyecto"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const uploadMutation = useMutation({
    mutationFn: uploadRepoProyectoPdf,
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["student-repo-proyecto"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;
  const data = query.data;
  const startedAt = data?.startedAt ?? null;
  const abierto = repoAbierto(startedAt, now);
  const restante = repoRestante(startedAt, now);
  const ready = CHECKS.every((item) => checked[item.id]);
  const entrega = repoEntrega(code, now);
  const guardada = data?.delivery?.uploadedAt ? repoEntrega(code, data.delivery.uploadedAt) : null;
  const puedeSubir = Boolean(data?.link) && entrega.open;
  const notasAbiertas = Boolean(startedAt) || (code === "301" && now < new Date("2026-11-21T00:00:00-06:00").getTime());

  return (
    <section className="glass mb-6 border border-violet-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-violet-200">Actividad Scrum · equipo de proyecto</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{REPO_PROYECTO_TITULO}</h2>
      <p className="mt-3 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950">
        El cronómetro dura 2 horas 30 minutos. La calificación la publica el docente y la máxima depende de la hora del PDF.
      </p>
      <div className="mt-3 rounded-xl border border-rose-300/40 bg-rose-500/15 p-3 text-sm text-rose-50">
        <p className="font-bold">
          {code === "301" ? "Grupo 301. Hoy, viernes 20 de noviembre." : "Grupo 302. Esta entrega no está abierta."}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {repoTramos(code).map((tramo) => (
            <li key={tramo.until}>{tramo.texto}</li>
          ))}
        </ul>
        <p className="mt-2 font-semibold">{repoCierre(code)}</p>
        <p className="mt-2">
          {entrega.open
            ? `Si suben el PDF en este momento y cumplen con todo, la máxima es ${entrega.points.toLocaleString("es-MX")}.`
            : "En este momento ya no se acepta el PDF."}
        </p>
        {guardada ? (
          <p className="mt-2">
            El archivo guardado queda con máxima de {guardada.points.toLocaleString("es-MX")}. Si lo reemplazan, cuenta la
            hora del archivo nuevo.
          </p>
        ) : null}
      </div>
      <a
        href={REPO_PROYECTO_INSTRUCTIVO}
        download="Repositorio Proyecto en GitHub.pdf"
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
      >
        Descargar instructivo (PDF)
      </a>
      <p className="mt-2 text-sm text-slate-300">Este archivo son las instrucciones. No lo suban como evidencia.</p>
      {data?.preview ? (
        <p className="mt-3 text-sm text-cyan-100">
          Vista de prueba. No estás en un equipo. Abajo se leen las mismas instrucciones que ve un alumno.
        </p>
      ) : null}
      {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      {data ? (
        <>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {data.teamName} · {startedAt ? (abierto ? "Tiempo corriendo" : "Tiempo terminado") : "El cronómetro no ha iniciado"}
            </p>
            <p className="mt-2 font-mono text-4xl font-bold text-white">{formatoReloj(restante)}</p>
            {!startedAt ? (
              data.isLeader ? (
                <button
                  type="button"
                  disabled={startMutation.isPending || !data.hasLeader}
                  onClick={() => {
                    const ok = window.confirm(
                      "Al iniciar, corren 2 horas 30 minutos para todo el equipo.\n\nEl cronómetro no se reinicia. El PDF se sube en el horario de hoy, aunque el cronómetro ya haya llegado a cero.",
                    );
                    if (ok) startMutation.mutate();
                  }}
                  className="mt-3 min-h-11 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400 disabled:opacity-50"
                >
                  {startMutation.isPending ? "Iniciando..." : "Iniciar cronómetro"}
                </button>
              ) : (
                <p className="mt-3 text-sm text-amber-100">
                  {data.hasLeader
                    ? "Solo el líder puede iniciar el cronómetro. El PDF se sube en el horario de hoy."
                    : "Este equipo no tiene líder. Pide al docente que lo nombre en Roles / Equipos."}
                </p>
              )
            ) : null}
          </div>

          {notasAbiertas ? (
            <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4">
              <p className="text-sm font-semibold text-white">Notas del líder para el docente</p>
              <p className="mt-1 text-sm text-slate-200">
                El líder elige a un compañero y anota si no está trabajando, no asistió, no está en su lugar, está jugando
                o es otra situación. Puede anotarlo varias veces. Esas notas le llegan al docente, que decide la
                calificación: ese integrante no tiene por qué valer lo mismo que los demás.
              </p>
              {data.isLeader ? (
                <ul className="mt-3 space-y-3">
                  {data.members.filter((member) => !member.isLeader).map((member) => (
                    <li key={member.id} className="rounded-xl border border-white/10 p-3">
                      <p className="text-sm font-semibold text-white">{member.displayName}</p>
                      <input
                        value={detalle[member.id] ?? ""}
                        onChange={(event) => setDetalle((prev) => ({ ...prev, [member.id]: event.target.value }))}
                        maxLength={200}
                        placeholder="Detalle opcional"
                        className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white"
                      />
                      <div className="mt-2 flex flex-wrap gap-1">
                        {REPO_PROYECTO_NOTAS_LIDER.map((nota) => (
                          <button
                            key={nota.code}
                            type="button"
                            disabled={
                              leaderNoteMutation.isPending ||
                              (nota.code === "otra" && !(detalle[member.id] ?? "").trim())
                            }
                            onClick={() =>
                              leaderNoteMutation.mutate({
                                studentId: member.id,
                                code: nota.code,
                                comment: (detalle[member.id] ?? "").trim(),
                              })
                            }
                            className="min-h-10 rounded-lg border border-white/15 bg-slate-950/40 px-2 py-1 text-xs font-semibold text-slate-100 disabled:opacity-50"
                          >
                            {nota.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.members.filter((member) => !member.isLeader).length === 0 && data.isLeader ? (
                <p className="mt-2 text-sm text-amber-100">No hay más integrantes en el equipo.</p>
              ) : null}
              {(data.leaderNotes ?? []).length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-amber-100">
                  {data.leaderNotes.map((nota) => (
                    <li key={nota.id} className="flex items-start justify-between gap-2">
                      <span>
                        {formatoHoraClase(nota.at)} · {nota.studentName}: {nota.label}
                        {nota.comment ? `. ${nota.comment}` : ""}
                      </span>
                      {data.isLeader ? (
                        <button
                          type="button"
                          onClick={() => removeLeaderNoteMutation.mutate(nota.id)}
                          className="shrink-0 text-rose-200"
                        >
                          Quitar
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-300">Todavía no hay notas de integrantes.</p>
              )}
            </div>
          ) : null}

          <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-100">
            <p>Un solo integrante sube a GitHub el proyecto de lo que llevan hasta el momento. Los demás lo clonan y colaboran.</p>
            <p>
              El líder reparte tablas. Cada quien hace un fragmento de código o el CRUD de la tabla que le tocó. Pueden ser{" "}
              {REPO_PROYECTO_TABLAS.join(", ")} u otra tabla del proyecto.
            </p>
            <p>
              En el repositorio se tiene que ver qué subió cada integrante. El commit lleva el cambio y su nombre. Ejemplo:{" "}
              <span className="font-mono">Agrego el CRUD de alumno - Ana Lopez</span>.
            </p>
            <p>
              Agreguen al docente como colaborador. Su usuario es{" "}
              <span className="font-mono font-bold text-violet-100">{REPO_PROYECTO_DOCENTE}</span>. En GitHub: Settings,
              Collaborators, Add people, escriban {REPO_PROYECTO_DOCENTE}.
            </p>
            <p>
              El líder anota a cada compañero las veces que haga falta: si no trabaja, no asistió, no está en su lugar,
              está jugando u otra situación. El docente ve esas notas y publica la calificación.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-white">Liga del repositorio</p>
            {data.link ? (
              <a href={data.link} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-emerald-200 underline">
                {data.link}
              </a>
            ) : (
              <p className="mt-1 text-sm text-amber-100">Todavía no guardan la liga.</p>
            )}
            <input
              value={liga}
              onChange={(event) => setLiga(event.target.value)}
              disabled={!entrega.open || linkMutation.isPending}
              placeholder="https://github.com/usuario/nombre-del-proyecto"
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white disabled:opacity-50"
            />
            <button
              type="button"
              disabled={!entrega.open || linkMutation.isPending || liga.trim().length < 18}
              onClick={() => linkMutation.mutate(liga.trim())}
              className="mt-2 min-h-11 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {linkMutation.isPending ? "Guardando..." : "Guardar liga"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-white">PDF del equipo, máximo 8 MB</p>
            <p className="mt-1 text-sm text-slate-300">
              Lo sube el líder o un integrante. Primero la carátula de Canva. Después, un separador con el nombre de cada
              integrante y sus capturas: clonación, cambios o CRUD, el CRUD guardando en XAMPP y los comandos de Git. Al
              final, el líder muestra los commits de cada integrante. Subir el PDF no publica la calificación: la publica
              el docente.
            </p>
            {data.delivery ? (
              <p className="mt-2 text-sm text-emerald-100">
                Ya está: {data.delivery.fileName}. Lo subió {data.delivery.uploadedByName}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-100">El equipo todavía no sube el PDF.</p>
            )}
            <ul className="mt-3 space-y-2">
              {CHECKS.map((item) => (
                <li key={item.id}>
                  <label className="flex items-start gap-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(checked[item.id])}
                      disabled={!puedeSubir}
                      onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={!puedeSubir || !ready || uploadMutation.isPending}
              className="mt-3 block w-full text-sm text-slate-200 disabled:opacity-50"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (file.size > REPO_PROYECTO_PDF_MAX_BYTES) {
                  setError("El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo.");
                  return;
                }
                uploadMutation.mutate(file);
              }}
            />
            {!entrega.open ? (
              <p className="mt-2 text-sm font-semibold text-rose-200">{repoCierre(code)}</p>
            ) : !data.link ? (
              <p className="mt-2 text-sm text-amber-100">Guarda primero la liga del repositorio.</p>
            ) : null}
            {uploadMutation.isPending ? <p className="mt-2 text-sm text-slate-300">Subiendo...</p> : null}
          </div>
          {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        </>
      ) : query.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Cargando el equipo...</p>
      ) : null}
    </section>
  );
}
