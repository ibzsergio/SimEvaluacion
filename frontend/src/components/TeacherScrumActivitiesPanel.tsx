import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAvionSession, fetchBasedatosSession, fetchCrudSession, fetchExtraSession, fetchImproSession, fetchMaquinaSession } from "../lib/api";
import { BASEDATOS_TITULO } from "../lib/basedatosScrum";
import { CRUD_TITULO } from "../lib/crudScrum";
import { EXAMEN_TITULO } from "../lib/examScrum";
import { IMPRO_TITULO } from "../lib/improScrum";
import { MAQUINA_TITULO } from "../lib/maquinaScrum";
import type { ClassGroup } from "../lib/types";
import TeacherAvionPanel from "./TeacherAvionPanel";
import TeacherBasedatosPanel from "./TeacherBasedatosPanel";
import TeacherCrudPanel from "./TeacherCrudPanel";
import TeacherSqlScrumPanel from "./TeacherSqlScrumPanel";
import TeacherTkinterGitPanel from "./TeacherTkinterGitPanel";
import TeacherExamenPanel from "./TeacherExamenPanel";
import TeacherExtraPanel from "./TeacherExtraPanel";
import TeacherImproPanel from "./TeacherImproPanel";
import TeacherInterfacePanel from "./TeacherInterfacePanel";
import TeacherMaquinaPanel from "./TeacherMaquinaPanel";
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
  const [current, setCurrent] = useState<
    "list" | "torre" | "avion" | "extra" | "interfaces" | "impro" | "maquina" | "basedatos" | "examen" | "crud" | "bd2" | "bd3" | "tkinter-git"
  >("list");
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
  const improQuery = useQuery({
    queryKey: ["impro-session", selectedGroupId],
    queryFn: () => fetchImproSession(selectedGroupId),
    enabled: !!selectedGroupId,
  });
  const improReleased = improQuery.data?.released ?? false;
  const maquinaQuery = useQuery({
    queryKey: ["maquina-session", selectedGroupId],
    queryFn: () => fetchMaquinaSession(selectedGroupId),
    enabled: !!selectedGroupId && current === "list",
  });
  const maquinaReleased = maquinaQuery.data?.released ?? false;
  const basedatosQuery = useQuery({
    queryKey: ["basedatos-session", selectedGroupId],
    queryFn: () => fetchBasedatosSession(selectedGroupId),
    enabled: !!selectedGroupId && current === "list",
  });
  const basedatosReleased = basedatosQuery.data?.released ?? false;
  const crudQuery = useQuery({
    queryKey: ["crud-session", selectedGroupId],
    queryFn: () => fetchCrudSession(selectedGroupId),
    enabled: !!selectedGroupId && current === "list",
  });
  const crudReleased = crudQuery.data?.released ?? false;

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

      {current === "tkinter-git" ? (
        <TeacherTkinterGitPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "bd2" || current === "bd3" ? (
        <TeacherSqlScrumPanel
          activityKey={current}
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "crud" ? (
        <TeacherCrudPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "examen" ? (
        <TeacherExamenPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "basedatos" ? (
        <TeacherBasedatosPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "maquina" ? (
        <TeacherMaquinaPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "impro" ? (
        <TeacherImproPanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "interfaces" ? (
        <TeacherInterfacePanel
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          hideGroupPicker
        />
      ) : current === "extra" ? (
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
              El grupo 301 y el grupo 302 hacen las dos: ACTIVIDAD BASE DE DATOS II y ACTIVIDAD BASE DE DATOS III. Los dos grupos suben cada una hasta las 5:00 p. m. de hoy, viernes 13 de noviembre. En el 302, el líder reparte una tabla por integrante y todo el equipo junta su script y su Tkinter en un solo proyecto de GitHub, además del PDF. 2000 puntos.
            </p>
          </section>

          <button
            type="button"
            onClick={() => setCurrent("tkinter-git")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Actividad Scrum · hoy</p>
              <h3 className="mt-1 text-xl font-bold text-white">ACTIVIDAD TKINTER EN GIT</h3>
              <p className="mt-1 text-sm text-slate-400">
                Cada equipo tiene un programa distinto, con base de datos y CRUD. La liberas cuando quieras. Un
                integrante sube el PDF.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-100">
              La liberas tú
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("bd2")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Actividad Scrum · hoy</p>
              <h3 className="mt-1 text-xl font-bold text-white">ACTIVIDAD BASE DE DATOS II</h3>
              <p className="mt-1 text-sm text-slate-400">
                Base UNIFORME. Portada y evidencias en Tkinter de cada tabla. Un solo PDF, máximo 8 MB. 2000 puntos.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-100">
              Publicada
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("bd3")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Actividad Scrum · hoy</p>
              <h3 className="mt-1 text-xl font-bold text-white">ACTIVIDAD BASE DE DATOS III</h3>
              <p className="mt-1 text-sm text-slate-400">
                Base TALLER. Portada y evidencias en Tkinter de cada tabla. Un solo PDF, máximo 8 MB. 2000 puntos.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-100">
              Publicada
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("crud")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Actividad Scrum</p>
              <h3 className="mt-1 text-xl font-bold text-white">{CRUD_TITULO}</h3>
              <p className="mt-1 text-sm text-slate-400">
                El líder asigna grupos, docentes, alumnos, asistencias e incidencias. Cada integrante crea la base y su
                tabla. Un compañero sube el PDF donde se ve a todos trabajando y los resultados.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                crudReleased
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                  : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
              }`}
            >
              {crudReleased ? "Liberada en este grupo" : "Lista para liberar"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("examen")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Cierre del parcial</p>
              <h3 className="mt-1 text-xl font-bold text-white">{EXAMEN_TITULO}</h3>
              <p className="mt-1 text-sm text-slate-400">
                Solo el grupo 302. Cada alumno sube un PDF de su examen, con carátula, nombre, fecha y
                margen amarillo. Máximo 3 MB. Hoy, hasta las 5:00 p. m.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-100">
              Solo 302
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("basedatos")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Actividad Scrum</p>
              <h3 className="mt-1 text-xl font-bold text-white">{BASEDATOS_TITULO}</h3>
              <p className="mt-1 text-sm text-slate-400">
                Hoy. Un PDF por equipo, máximo 5 MB, con carátula. Cada sección lleva título: diagrama,
                modelo relacional, el script completo y capturas de todas las pantallas. 3000 puntos.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                basedatosReleased
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                  : "border-sky-400/40 bg-sky-500/15 text-sky-100"
              }`}
            >
              {basedatosReleased ? "Liberada en este grupo" : "Lista para liberar"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("maquina")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-lime-300">Actividad Scrum</p>
              <h3 className="mt-1 text-xl font-bold text-white">{MAQUINA_TITULO}</h3>
              <p className="mt-1 text-sm text-slate-400">
                Equipos de Roles / Equipos. 60 minutos. Construyen una máquina de por lo menos 40 cm. La
                pieza entra por la boca verde, cruza las 12 etapas como obstáculos y sale por la boca roja. 1000 Firmas.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                maquinaReleased
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                  : "border-lime-400/40 bg-lime-500/15 text-lime-100"
              }`}
            >
              {maquinaReleased ? "Liberada en este grupo" : "Lista para liberar"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("impro")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Actividad Scrum</p>
              <h3 className="mt-1 text-xl font-bold text-white">{IMPRO_TITULO}</h3>
              <p className="mt-1 text-sm text-slate-400">
                Equipos de Roles / Equipos. 50 minutos. El pop-up muestra una parte de su programa. Al
                iniciar el reloj salen por más material. Mide mínimo 30 cm de ancho por 30 cm de alto.
                1000 Firmas.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                improReleased
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                  : "border-orange-400/40 bg-orange-500/15 text-orange-100"
              }`}
            >
              {improReleased ? "Liberada en este grupo" : "Lista para liberar"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrent("interfaces")}
            className="glass flex w-full items-start justify-between gap-3 p-5 text-left hover:bg-white/5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Actividad de equipo</p>
              <h3 className="mt-1 text-xl font-bold text-white">Diseño de Interfaces Proyecto</h3>
              <p className="mt-1 text-sm text-slate-400">
                Equipos de Roles / Equipos. Lista de cotejo de 3,000 firmas. El puntaje es el promedio de
                tu evaluación y la coevaluación de los líderes.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-100">
              Notas en vivo
            </span>
          </button>

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
