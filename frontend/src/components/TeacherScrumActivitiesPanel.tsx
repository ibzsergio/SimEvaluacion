import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAvionSession, fetchExtraSession } from "../lib/api";
import type { ClassGroup } from "../lib/types";
import TeacherAvionPanel from "./TeacherAvionPanel";
import TeacherExtraPanel from "./TeacherExtraPanel";
import TeacherTorrePanel from "./TeacherTorrePanel";

export default function TeacherScrumActivitiesPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const [current, setCurrent] = useState<"list" | "torre" | "avion" | "extra">("list");
  const avionQuery = useQuery({
    queryKey: ["avion-session", selectedGroupId],
    queryFn: () => fetchAvionSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const extraQuery = useQuery({
    queryKey: ["extra-session", selectedGroupId],
    queryFn: () => fetchExtraSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const avionReleased = avionQuery.data?.released ?? false;
  const extraReleased = extraQuery.data?.released ?? false;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectGroup(g.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              g.id === selectedGroupId
                ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-300"
            }`}
          >
            Grupo {g.code}
          </button>
        ))}
      </div>

      {current !== "list" ? (
        <button
          type="button"
          onClick={() => setCurrent("list")}
          className="mb-4 text-sm font-semibold text-sky-200 hover:text-white"
        >
          ← Todas las actividades Scrum
        </button>
      ) : null}

      {current === "extra" ? (
        <TeacherExtraPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "torre" ? (
        <TeacherTorrePanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          concluded
          hideGroupPicker
        />
      ) : current === "avion" ? (
        <TeacherAvionPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : (
        <div className="space-y-4">
          <section className="glass p-5">
            <h2 className="text-lg font-bold text-white">Actividades — Scrum</h2>
            <p className="mt-1 text-sm text-slate-400">
              Plan de Acción Proyecto: interfaces en papel (paso 3). 301 y 302 por equipos de Roles /
              Equipos. Vale 3000 Firmas según tus notas. Torre Tkinter y Sprint aéreo quedan como
              registro.
            </p>
          </section>

          <button
            type="button"
            onClick={() => setCurrent("extra")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-rose-300">Actividad Scrum</p>
              <h3 className="mt-1 text-xl font-bold text-white">Plan de Acción Proyecto</h3>
              <p className="mt-1 text-sm text-slate-400">
                Paso 3: interfaces de su app Tkinter. Equipos de Roles / Equipos en 301 y 302. 3000
                Firmas (bajan con tus notas). Cartulina, hojas, pegamento, diurex, periódico/revistas.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                extraReleased
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                  : "border-rose-400/40 bg-rose-500/15 text-rose-100"
              }`}
            >
              {extraReleased ? "Liberada en 301 y 302" : "Lista para liberar"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("torre")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Reto colaborativo</p>
              <h3 className="mt-1 text-xl font-bold text-white">Torre Tkinter</h3>
              <p className="mt-1 text-sm text-slate-400">
                Torre de popotes con banderillas Tkinter. Ya se realizó; queda como registro.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-100">
              Concluido
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("avion")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Actividad Scrum</p>
              <h3 className="mt-1 text-xl font-bold text-white">Sprint aéreo</h3>
              <p className="mt-1 text-sm text-slate-400">
                Avión de cascarón, palillos y palos de paleta que vuele lejos y no se desarme. Nombre del
                equipo, diseño y 45 minutos. Todos construyen.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                avionReleased
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                  : "border-sky-400/40 bg-sky-500/15 text-sky-100"
              }`}
            >
              {avionReleased ? "Liberada" : "Solo prueba"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
