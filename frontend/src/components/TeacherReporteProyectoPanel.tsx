import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { downloadTeacherReporteArchivo, fetchTeacherReporte, getApiErrorMessage, saveTeacherReporteNote } from "../lib/api";
import { REPORTE_CIERRE_TEXTO, REPORTE_DIAS, REPORTE_TITULO, reporteDiaInicial } from "../lib/reporteProyecto";
import type { ClassGroup } from "../lib/types";

export default function TeacherReporteProyectoPanel({
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
  const [day, setDay] = useState(() => reporteDiaInicial());
  const [error, setError] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const query = useQuery({
    queryKey: ["reporte-proyecto", selectedGroupId],
    queryFn: () => fetchTeacherReporte(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 15_000,
  });

  return (
    <div>
      {hideGroupPicker ? null : (
        <div className="mb-4 flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                group.id === selectedGroupId
                  ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}
      <section className="glass mb-6 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Actividad Scrum · reporte diario</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{REPORTE_TITULO}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Grupo {selectedGroup?.code ?? "—"}. El líder reporta qué hace cada integrante, su evidencia y los commits del
          repositorio. Su observación queda aparte. Tú también puedes anotar a cada alumno. Por ahora no hay calificación.
          {` ${REPORTE_CIERRE_TEXTO}`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {REPORTE_DIAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDay(item.id)}
              className={`min-h-10 rounded-full px-3 py-1 text-sm font-semibold ${
                day === item.id ? "bg-sky-400 text-slate-950" : "border border-white/15 text-slate-200"
              }`}
            >
              {item.label}
              {query.data?.today === item.id ? " · hoy" : ""}
            </button>
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
      </section>
      {query.isLoading ? <p className="text-sm text-slate-400">Cargando equipos...</p> : null}
      <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {(query.data?.teams ?? []).map((team) => {
          const report = team.reports[day];
          const hayTexto = Boolean(report?.commitsNote) || Boolean(report?.members.some((member) => member.doing || member.observation));
          const hayArchivo = Boolean(report?.commitsFile) || Boolean(report?.members.some((member) => member.file));
          return (
            <li key={team.teamKey} className="glass p-4">
              <p className="text-lg font-bold text-white">{team.teamName}</p>
              <p className="text-sm text-slate-300">{team.leaderName ? `Líder: ${team.leaderName}` : "Sin líder"}</p>
              {!hayTexto && !hayArchivo ? <p className="mt-2 text-sm text-amber-100">El líder todavía no reporta este día.</p> : null}
              <ul className="mt-3 space-y-3">
                {(report?.members ?? []).map((member) => (
                  <li key={member.id} className="rounded-xl border border-white/10 p-3 text-sm">
                    <p className="font-semibold text-white">
                      {member.displayName}
                      {member.isLeader ? " · líder" : ""}
                    </p>
                    <p className="mt-1 text-slate-200">{member.doing || "Sin avance escrito."}</p>
                    <p className="mt-2 text-amber-100">
                      <span className="font-semibold">Observación del líder: </span>
                      {member.observation || "Sin observación."}
                    </p>
                    <NotaDocente
                      key={`${day}:${member.id}`}
                      saved={member.teacherNote ?? ""}
                      onSave={async (note) => {
                        try {
                          setError("");
                          await saveTeacherReporteNote(selectedGroupId, {
                            teamKey: team.teamKey,
                            day,
                            studentId: member.id,
                            note,
                          });
                          await qc.invalidateQueries({ queryKey: ["reporte-proyecto", selectedGroupId] });
                        } catch (err) {
                          setError(getApiErrorMessage(err));
                        }
                      }}
                    />
                    {member.file ? (
                      <button
                        type="button"
                        className="mt-2 rounded-lg bg-sky-400 px-3 py-1 text-xs font-bold text-slate-950"
                        onClick={() =>
                          downloadTeacherReporteArchivo(selectedGroupId, team.teamKey, day, member.id, member.file?.fileName ?? "evidencia").catch(
                            (err) => setError(getApiErrorMessage(err)),
                          )
                        }
                      >
                        Descargar evidencia
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">Sin evidencia de este integrante.</p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-xl border border-white/10 p-3 text-sm">
                <p className="font-semibold text-white">Commits</p>
                <p className="mt-1 text-slate-200">{report?.commitsNote || "Sin nota de commits."}</p>
                {report?.commitsFile ? (
                  <button
                    type="button"
                    className="mt-2 rounded-lg bg-sky-400 px-3 py-1 text-xs font-bold text-slate-950"
                    onClick={() =>
                      downloadTeacherReporteArchivo(
                        selectedGroupId,
                        team.teamKey,
                        day,
                        "commits",
                        report.commitsFile?.fileName ?? "commits",
                      ).catch((err) => setError(getApiErrorMessage(err)))
                    }
                  >
                    Descargar evidencia de commits
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Sin evidencia de commits.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NotaDocente({ saved, onSave }: { saved: string; onSave: (note: string) => Promise<void> }) {
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const shown = editing ? text : saved;
  return (
    <div className="mt-3">
      <label className="text-xs font-bold uppercase tracking-widest text-sky-200">Tu anotación</label>
      <textarea
        value={shown}
        maxLength={400}
        rows={2}
        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white"
        onFocus={() => {
          if (!editing) setText(saved);
          setEditing(true);
        }}
        onChange={(event) => {
          setEditing(true);
          setText(event.target.value);
        }}
      />
      <button
        type="button"
        disabled={saving || shown.trim() === saved.trim()}
        className="mt-2 rounded-lg bg-sky-400 px-3 py-1 text-xs font-bold text-slate-950 disabled:opacity-50"
        onClick={() => {
          setSaving(true);
          void onSave(shown.trim())
            .then(() => setEditing(false))
            .finally(() => setSaving(false));
        }}
      >
        {saving ? "Guardando..." : "Guardar anotación"}
      </button>
    </div>
  );
}
