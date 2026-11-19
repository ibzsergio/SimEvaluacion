import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { downloadGlosarioPdf, fetchTeacherGlosario, getApiErrorMessage } from "../lib/api";
import { formatoHoraGlosario, GLOSARIO_CIERRE, GLOSARIO_TITULO, glosarioTramos } from "../lib/glosario";
import type { ClassGroup } from "../lib/types";

export default function TeacherGlosarioPanel({
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
  const [error, setError] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const query = useQuery({
    queryKey: ["glosario", selectedGroupId],
    queryFn: () => fetchTeacherGlosario(selectedGroupId),
    enabled: !!selectedGroupId,
    refetchInterval: 15_000,
  });
  const deliveries = query.data?.deliveries ?? [];

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
                group.id === selectedGroupId ? "border-teal-400/50 bg-teal-500/15 text-teal-100" : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Grupo {group.code}
            </button>
          ))}
        </div>
      )}
      <section className="glass mb-6 p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-300">Actividad Scrum · publicada</p>
        <h2 className="mt-1 text-2xl font-bold text-white">{GLOSARIO_TITULO}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Grupo {selectedGroup?.code ?? "—"}. Un PDF de máximo 3 MB: carátula de Canva, glosario en español con cada
          palabra clave y su descripción, y el reporte general de la aplicación. Se indica qué hizo cada integrante. Los
          puntos se registran al subir el archivo. {GLOSARIO_CIERRE}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-200">
          {glosarioTramos(selectedGroup?.code).map((tramo) => (
            <li key={tramo.until}>{tramo.texto}</li>
          ))}
        </ul>
        {query.isError ? <p className="mt-3 text-sm text-rose-200">{getApiErrorMessage(query.error)}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
      </section>
      {query.isLoading ? <p className="text-sm text-slate-400">Cargando equipos...</p> : null}
      <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {(query.data?.teams ?? []).map((team) => {
          const file = deliveries.find((item) => item.teamKey === team.teamKey);
          return (
            <li key={team.teamKey} className="glass p-4">
              <p className="text-lg font-bold text-white">{team.teamName}</p>
              <p className="text-sm text-slate-300">{team.leaderName ? `Líder: ${team.leaderName}` : "Sin líder"}</p>
              {file ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-amber-100">
                    PDF de las {formatoHoraGlosario(file.uploadedAt)}. {file.points.toLocaleString("es-MX")} puntos. Lo subió{" "}
                    {file.uploadedByName}.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadGlosarioPdf(selectedGroupId, team.teamKey, file.fileName).catch((err) => setError(getApiErrorMessage(err)))}
                    className="mt-2 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950"
                  >
                    Descargar PDF
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Sin PDF</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
