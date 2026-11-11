import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  downloadCrudPdf,
  fetchCrudSession,
  fetchTeacherCrudDeliveries,
  getApiErrorMessage,
  hideCrudSession,
  releaseCrudSession,
} from "../lib/api";
import {
  CRUD_CODIGO,
  CRUD_CONTEXTO,
  CRUD_EVIDENCIAS,
  CRUD_PASOS,
  CRUD_PROGRAMA,
  CRUD_TABLA_EJEMPLO,
  CRUD_TABLAS,
  CRUD_TITULO,
  formatCrudSize,
} from "../lib/crudScrum";
import type { ClassGroup } from "../lib/types";

export default function TeacherCrudPanel({
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
  const [downloadError, setDownloadError] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const sessionQuery = useQuery({
    queryKey: ["crud-session", selectedGroupId],
    queryFn: () => fetchCrudSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const releaseMutation = useMutation({
    mutationFn: (next: boolean) => (next ? releaseCrudSession(selectedGroupId) : hideCrudSession(selectedGroupId)),
    onSuccess: (data) => {
      qc.setQueryData(["crud-session", selectedGroupId], data);
    },
  });
  const released = sessionQuery.data?.released ?? false;
  const deliveriesQuery = useQuery({
    queryKey: ["crud-deliveries", selectedGroupId],
    queryFn: () => fetchTeacherCrudDeliveries(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 10_000,
  });
  const teams = [...(deliveriesQuery.data?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const byTeam = new Map((deliveriesQuery.data?.deliveries ?? []).map((item) => [item.teamKey, item]));
  const delivered = teams.filter((team) => byTeam.has(team.key)).length;

  return (
    <div className="space-y-4">
      {hideGroupPicker ? null : (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}

      <section className="glass p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">{CRUD_PROGRAMA}</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{CRUD_TITULO}</h2>
        <p className="mt-2 text-sm text-slate-300">{CRUD_CONTEXTO}</p>
        <p className="mt-3 text-sm font-semibold text-emerald-100">
          Grupo {selectedGroup?.code ?? "—"} · equipo de proyecto · base 302 · 5 tablas
        </p>
        <button
          type="button"
          disabled={!selectedGroupId || releaseMutation.isPending}
          onClick={() => {
            const next = !released;
            const question = next
              ? `¿Liberar TEST para el grupo ${selectedGroup?.code ?? ""}?\n\nEl líder reparte las 5 tablas. En el PDF se ve a cada integrante con su tabla, su script y el CRUD funcionando.`
              : "¿Ocultar TEST para este grupo?";
            if (!window.confirm(question)) return;
            releaseMutation.mutate(next);
          }}
          className={`mt-4 rounded-xl px-4 py-2 text-sm font-bold ${
            released ? "bg-slate-700 text-white" : "bg-emerald-500 text-slate-950"
          }`}
        >
          {released ? "Ocultar a los alumnos" : "Liberar a los alumnos"}
        </button>
        <p className="mt-3 text-sm text-slate-300">
          {delivered} de {teams.length} equipos ya subieron su PDF.
        </p>
        {sessionQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(sessionQuery.error)}</p>
        ) : null}
        {downloadError ? <p className="mt-3 text-sm text-rose-200">{downloadError}</p> : null}
        {deliveriesQuery.isError ? (
          <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(deliveriesQuery.error)}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5">
        <h3 className="text-lg font-bold text-white">Qué tienen que subir</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-100">
          {CRUD_EVIDENCIAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5">
        <h3 className="text-lg font-bold text-white">Lo que hace cada alumno</h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-100">
          {CRUD_PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        <p className="mt-4 text-sm font-semibold text-white">
          {CRUD_TABLA_EJEMPLO.nombre}: {CRUD_TABLA_EJEMPLO.uso}
        </p>
        <ul className="mt-1 space-y-1 text-sm text-slate-100">
          {CRUD_TABLA_EJEMPLO.atributos.map((atributo) => (
            <li key={atributo.campo}>
              {atributo.campo} {atributo.tipo}
              {atributo.nota ? ` · ${atributo.nota}` : ""}
            </li>
          ))}
        </ul>
        {CRUD_TABLAS.map((tabla) => (
          <div key={tabla.nombre} className="mt-3">
            <p className="text-sm font-semibold text-white">{tabla.nombre}</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-100">
              {tabla.atributos.map((atributo) => (
                <li key={atributo.campo}>
                  {atributo.campo} {atributo.tipo}
                  {atributo.nota ? ` · ${atributo.nota}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-3 text-xs leading-relaxed text-emerald-100">
          {CRUD_CODIGO}
        </pre>
      </section>

      {teams.map((team) => {
        const file = byTeam.get(team.key);
        return (
          <section key={team.key} className="glass flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold text-white">{team.name}</p>
              <p className="text-sm text-slate-400">{team.members.map((member) => member.displayName).join(", ")}</p>
              {file ? (
                <p className="text-sm text-emerald-100">
                  {file.fileName} · {formatCrudSize(file.sizeBytes)} · lo subió {file.uploadedByName}
                </p>
              ) : (
                <p className="text-sm text-slate-400">Todavía no suben el PDF.</p>
              )}
            </div>
            {file ? (
              <button
                type="button"
                onClick={() => {
                  downloadCrudPdf(selectedGroupId, team.key, file.fileName).catch((err) =>
                    setDownloadError(getApiErrorMessage(err)),
                  );
                }}
                className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
              >
                Descargar PDF
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
