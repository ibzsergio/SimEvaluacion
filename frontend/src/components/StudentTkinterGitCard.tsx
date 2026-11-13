import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  fetchStudentTkinterGit,
  fetchStudentTkinterGitDelivery,
  getApiErrorMessage,
  saveTkinterGitRepo,
  uploadTkinterGitPdf,
} from "../lib/api";
import {
  TKINTER_GIT_DOCENTE,
  TKINTER_GIT_INSTRUCTIVO,
  TKINTER_GIT_PDF_MAX_BYTES,
  TKINTER_GIT_REQUISITOS,
  TKINTER_GIT_TITULO,
  tkinterGitCierre,
  cambioDe,
  cambiosDelEquipo,
  nombreRepositorio,
  programaDelEquipo,
} from "../lib/tkinterGit";
import TkinterGitGuide from "./TkinterGitGuide";

export default function StudentTkinterGitCard({
  groupCode,
  studentId,
}: {
  groupCode?: string | null;
  studentId?: string | null;
}) {
  const code = groupCode?.trim();
  const visible = code === "301" || code === "302";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [liga, setLiga] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const es302 = code === "302";
  const cierre = tkinterGitCierre(code, now);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const query = useQuery({
    queryKey: ["student-tkinter-git"],
    queryFn: fetchStudentTkinterGit,
    enabled: visible,
    retry: false,
    refetchInterval: visible ? 15_000 : false,
  });
  const released = Boolean(query.data?.released);
  const deliveryQuery = useQuery({
    queryKey: ["student-tkinter-git-delivery"],
    queryFn: fetchStudentTkinterGitDelivery,
    enabled: visible && released,
    retry: false,
  });
  const linkMutation = useMutation({
    mutationFn: saveTkinterGitRepo,
    onSuccess: async () => {
      setUploadError("");
      setLiga("");
      await queryClient.invalidateQueries({ queryKey: ["student-tkinter-git-delivery"] });
    },
    onError: (err) => setUploadError(getApiErrorMessage(err)),
  });
  useEffect(() => {
    if (!es302) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [es302]);
  const uploadMutation = useMutation({
    mutationFn: uploadTkinterGitPdf,
    onSuccess: async () => {
      setUploadError("");
      if (fileRef.current) fileRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["student-tkinter-git-delivery"] });
    },
    onError: (err) => setUploadError(getApiErrorMessage(err)),
  });

  if (!visible || !released) return null;

  const team = query.data?.teams.find((item) => item.id === query.data?.myTeamId) ?? null;
  const yo = team?.members.find((member) => member.id === studentId) ?? null;
  const programa = team && query.data ? programaDelEquipo(query.data.teams, team.id, code) : null;
  const repo = team ? nombreRepositorio(code, team.name) : "tkinter-equipo";
  const mio = team && studentId ? cambioDe(team.members, studentId) : null;
  const lista = team ? cambiosDelEquipo(team.members) : [];
  const checks = [
    { id: "portada", label: "La portada dice de qué trata el programa y trae el enlace del repositorio." },
    { id: "base", label: "Se ve la base de datos que guarda lo que genera la aplicación." },
    { id: "py", label: "Se ve programa.py con la cadena de conexión, el Tkinter y el CRUD." },
    { id: "nombres", label: "Cada integrante dejó su comentario en el código y su nombre en el commit." },
  ];
  const ready = checks.every((item) => checked[item.id]);

  return (
    <section className="glass mb-6 border border-sky-400/30 p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-200">Actividad Scrum · equipo de proyecto</p>
      <h2 className="mt-1 text-2xl font-bold text-white">{TKINTER_GIT_TITULO}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">
        Cada equipo hace un programa distinto. Abajo dice de qué trata el de tu equipo. El instructivo completo está
        en un solo PDF: los pasos, cómo guardar, comprometer y subir cada cambio, los errores y cómo hacerlo en
        Android o en iPhone.
      </p>
      <a
        href={TKINTER_GIT_INSTRUCTIVO}
        download="Instructivo-Tkinter-en-Git.pdf"
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
      >
        Descargar instructivo (PDF)
      </a>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">
        {TKINTER_GIT_REQUISITOS.map((linea) => (
          <li key={linea}>{linea}</li>
        ))}
      </ul>
      {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      {query.isSuccess && !team ? (
        <p className="mt-3 text-sm text-amber-100">Todavía no estás en un equipo de proyecto. Pide al docente que te asigne.</p>
      ) : null}
      {programa && team ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">Programa de {team.name}</p>
          <h3 className="mt-1 text-xl font-bold text-white">{programa.titulo}</h3>
          <p className="mt-2 text-sm text-amber-100">El título de la ventana es: {programa.ventana}</p>
          <p className="mt-2 text-sm font-semibold text-white">El archivo se llama programa.py y el repositorio se llama:</p>
          <p className="mt-1 rounded-lg bg-slate-950 px-3 py-2 font-mono text-sm text-emerald-200">{repo}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">
            {programa.pedido.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {mio ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Tu cambio</p>
          <h3 className="mt-1 text-lg font-bold text-white">{mio.titulo}</h3>
          <p className="mt-2 text-sm text-slate-100">{mio.detalle}</p>
          <p className="mt-2 text-sm text-emerald-100">
            El mensaje de tu commit es: <span className="font-mono">{mio.commit} - {yo?.displayName ?? "Tu nombre"}</span>
          </p>
          <p className="mt-2 text-sm text-slate-100">
            En el código, arriba de tu cambio: <span className="font-mono"># {yo?.displayName ?? "Tu nombre"}: {mio.titulo}</span>
          </p>
        </div>
      ) : null}
      {lista.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          {lista.map(({ member, cambio }) => (
            <li key={member.id} className="rounded-xl border border-white/10 px-3 py-2">
              <span className="font-semibold text-white">{member.displayName}</span>
              {member.isLeader ? " · líder, sube el proyecto" : ""}
              {": "}
              {cambio.titulo}
            </li>
          ))}
        </ul>
      ) : null}
      {es302 ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-50">{cierre.texto}</p>
          <p className="mt-3 text-sm text-white">
            Agreguen al docente como colaborador. Su usuario de GitHub es{" "}
            <span className="font-mono font-bold text-amber-100">{TKINTER_GIT_DOCENTE}</span>.
          </p>
          <p className="mt-1 text-sm text-slate-100">
            En el repositorio: Settings, Collaborators, Add people, escriban {TKINTER_GIT_DOCENTE} y pulsen Add.
          </p>
          <a
            href={`https://github.com/${TKINTER_GIT_DOCENTE}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-semibold text-sky-200 underline"
          >
            github.com/{TKINTER_GIT_DOCENTE}
          </a>
          <p className="mt-4 text-sm font-semibold text-white">Liga del repositorio del equipo</p>
          {deliveryQuery.data?.repoUrl ? (
            <a href={deliveryQuery.data.repoUrl} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-emerald-200 underline">
              {deliveryQuery.data.repoUrl}
            </a>
          ) : (
            <p className="mt-1 text-sm text-amber-100">Todavía no guardan la liga. Sin ella no se puede subir el PDF.</p>
          )}
          <input
            value={liga}
            onChange={(event) => setLiga(event.target.value)}
            disabled={!cierre.open || linkMutation.isPending}
            placeholder="https://github.com/usuario/tkinter-302-equipo-1"
            className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!cierre.open || linkMutation.isPending || liga.trim().length < 18}
            onClick={() => linkMutation.mutate(liga.trim())}
            className="mt-2 min-h-11 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {linkMutation.isPending ? "Guardando..." : "Guardar liga"}
          </button>
        </div>
      ) : null}
      <div className="mt-4 rounded-2xl border border-white/10 p-4">
        <p className="text-sm font-semibold text-white">Evidencia del equipo</p>
        <p className="mt-1 text-sm text-amber-100">Este archivo es otro PDF. No subas el instructivo.</p>
        <p className="mt-1 text-sm text-slate-300">
          Un solo PDF, de 8 MB o menos. Marca todo antes de elegir el archivo. Si lo vuelven a subir, reemplaza el anterior.
        </p>
        <ul className="mt-3 space-y-2">
          {checks.map((item) => (
            <li key={item.id}>
              <label className="flex items-start gap-2 text-sm text-slate-100">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(checked[item.id])}
                  onChange={(event) => setChecked((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
        {deliveryQuery.data?.delivery ? (
          <p className="mt-2 text-sm text-emerald-100">
            Ya está: {deliveryQuery.data.delivery.fileName}. Lo subió {deliveryQuery.data.delivery.uploadedByName}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-100">El equipo todavía no sube el PDF.</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={!ready || uploadMutation.isPending || !cierre.open || (es302 && !deliveryQuery.data?.repoUrl)}
          className="mt-3 block w-full text-sm text-slate-200 disabled:opacity-50"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > TKINTER_GIT_PDF_MAX_BYTES) {
              setUploadError("El PDF pesa más de 8 MB. Redúcelo y vuelve a subirlo.");
              event.target.value = "";
              return;
            }
            uploadMutation.mutate(file);
          }}
        />
        {es302 && !cierre.open ? <p className="mt-2 text-sm text-rose-200">Ya pasó la hora. El archivo ya no se puede subir.</p> : null}
        {uploadMutation.isPending ? <p className="mt-2 text-sm text-slate-300">Subiendo...</p> : null}
        {uploadError ? <p className="mt-2 text-sm text-rose-200">{uploadError}</p> : null}
      </div>
      <TkinterGitGuide repo={repo} />
    </section>
  );
}
