import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  downloadGradesTemplate,
  getApiErrorMessage,
  importGradesExcel,
  importGradesWorkbook,
  type GradeImportMode,
} from "../lib/api";
import type { ClassGroup } from "../lib/types";

type GradeImportSummary = {
  activitiesCreated: number;
  activitiesMatched: number;
  activitiesMissing: string[];
  gradesUpserted: number;
  gradesSkipped: number;
  unknownControls: string[];
  unknownStudents: string[];
};

function formatSummary(summary: GradeImportSummary, mode: GradeImportMode) {
  const parts: string[] = [];

  if (mode === "activitiesOnly" || mode === "full") {
    parts.push(`${summary.activitiesCreated} actividades nuevas`);
    if (summary.activitiesMatched) parts.push(`${summary.activitiesMatched} ya existían`);
  }

  if (mode === "gradesOnly" || mode === "full") {
    parts.push(`${summary.gradesUpserted} calificaciones guardadas`);
    if (summary.activitiesMissing.length) {
      parts.push(
        `${summary.activitiesMissing.length} actividades no encontradas (${summary.activitiesMissing.slice(0, 3).join(", ")}${summary.activitiesMissing.length > 3 ? "…" : ""})`,
      );
    }
    if (summary.unknownStudents.length) {
      parts.push(
        `${summary.unknownStudents.length} nombres no encontrados (${summary.unknownStudents.slice(0, 2).join("; ")}${summary.unknownStudents.length > 2 ? "…" : ""})`,
      );
    }
  }

  return parts.join(" · ");
}

function FileInput({
  label,
  hint,
  pending,
  pendingText,
  onFile,
}: {
  label: string;
  hint: string;
  pending: boolean;
  pendingText: string;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="mt-3 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onFile(file);
          if (ref.current) ref.current.value = "";
        }}
      />
      {pending ? <p className="mt-2 text-sm text-indigo-300">{pendingText}</p> : null}
    </div>
  );
}

export default function GroupGradesImportPanel({
  groups,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: ClassGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const selected = groups.find((g) => g.id === selectedGroupId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["grades"] });
    qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
  };

  const workbookMutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: GradeImportMode }) =>
      importGradesWorkbook(file, mode),
    onSuccess: (data) => {
      const lines = data.results.map(
        (r) => `Grupo ${r.groupCode}: ${formatSummary(r.summary, data.mode)}`,
      );
      const skipped =
        data.skippedSheets.length > 0
          ? ` Hojas omitidas: ${data.skippedSheets.join(", ")} (revisa que se llamen 201 y 202).`
          : "";
      const missing =
        data.results.length < 2
          ? " Si falta un grupo, verifica el nombre de la pestaña en Excel."
          : "";
      setMessage({ type: "ok", text: lines.join(" · ") + skipped + missing });
      invalidate();
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  const importMutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: GradeImportMode }) =>
      importGradesExcel(selectedGroupId, file, mode),
    onSuccess: (data) => {
      setMessage({
        type: "ok",
        text: `Grupo ${data.group.code}: ${formatSummary(data.summary, data.mode)}`,
      });
      invalidate();
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  const pending = workbookMutation.isPending || importMutation.isPending;

  return (
    <section className="glass mb-6 border-indigo-400/30 p-5">
      <h2 className="text-lg font-semibold text-white">Subir Excel de calificaciones (aquí, no en Alumnos)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Usa el mismo archivo con hojas <strong>201</strong> y <strong>202</strong>. Los alumnos deben estar ya
        importados en la pestaña Alumnos. Las calificaciones se asignan comparando el{" "}
        <strong>nombre del alumno</strong>.
      </p>

      <ol className="mt-4 space-y-2 text-sm text-slate-300">
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-bold text-indigo-100">
            1
          </span>
          <span>
            <strong>Paso 1 — Actividades:</strong> sube el Excel para crear las columnas como actividades
            (CARATULA, P1 SUMA, etc.).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/30 text-xs font-bold text-cyan-100">
            2
          </span>
          <span>
            <strong>Paso 2 — Calificaciones:</strong> sube el mismo archivo para guardar los puntos de cada
            alumno por nombre.
          </span>
        </li>
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectGroup(g.id)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              g.id === selectedGroupId
                ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100"
                : "border-white/10 bg-white/5 text-slate-400"
            }`}
          >
            Grupo {g.code}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4">
        <p className="text-sm font-semibold text-cyan-100">Recomendado: archivo completo (201 + 202)</p>
        <p className="mt-1 text-xs text-slate-400">Un solo archivo con ambas hojas.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <FileInput
            label="Paso 1 · Solo actividades"
            hint="Hojas 201 y 202"
            pending={workbookMutation.isPending}
            pendingText="Creando actividades..."
            onFile={(file) => {
              setMessage(null);
              workbookMutation.mutate({ file, mode: "activitiesOnly" });
            }}
          />
          <FileInput
            label="Paso 2 · Solo calificaciones"
            hint="Mismo archivo, busca por nombre"
            pending={workbookMutation.isPending}
            pendingText="Guardando calificaciones..."
            onFile={(file) => {
              setMessage(null);
              workbookMutation.mutate({ file, mode: "gradesOnly" });
            }}
          />
          <FileInput
            label="Todo en uno"
            hint="Actividades + calificaciones"
            pending={workbookMutation.isPending}
            pendingText="Importando..."
            onFile={(file) => {
              setMessage(null);
              workbookMutation.mutate({ file, mode: "full" });
            }}
          />
        </div>
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
        O un solo grupo ({selected?.code}) — usa la pestaña &quot;{selected?.code}&quot; del Excel
      </p>
      <p className="mt-1 text-xs text-amber-200/90">
        Si el archivo tiene hojas 201 y 202, usa los botones de arriba (archivo completo), no esta sección.
      </p>
      <div className="mt-2 grid gap-3 lg:grid-cols-3">
        <FileInput
          label="Paso 1 · Actividades"
          hint={`Hoja del grupo ${selected?.code}`}
          pending={importMutation.isPending}
          pendingText="Creando actividades..."
          onFile={(file) => {
            setMessage(null);
            importMutation.mutate({ file, mode: "activitiesOnly" });
          }}
        />
        <FileInput
          label="Paso 2 · Calificaciones"
          hint="Compara nombre del alumno"
          pending={importMutation.isPending}
          pendingText="Guardando calificaciones..."
          onFile={(file) => {
            setMessage(null);
            importMutation.mutate({ file, mode: "gradesOnly" });
          }}
        />
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <p className="text-sm font-semibold text-white">Plantilla de ejemplo</p>
          <p className="mt-1 text-xs text-slate-400">Descarga CSV con el formato esperado.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => downloadGradesTemplate(selectedGroupId)}
            className="mt-3 w-full rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            Descargar plantilla CSV
          </button>
        </div>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            message.type === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-400/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl bg-slate-900/50 p-3 text-xs text-slate-400">
        <p className="font-medium text-slate-300">Tu Excel (como en la captura)</p>
        <pre className="mt-2 overflow-x-auto font-mono text-slate-300">{`No. | NOMBRE DEL ALUMNO | CARATULA | P1 SUMA | CODIGOS CLIENTE | ...
1   | Bastida Huerta...  | 1000     | 1500    | 2000              | ...`}</pre>
        <p className="mt-2">
          Cada columna con título = una actividad. Solo se omite <strong>NOMBRE DEL ALUMNO</strong> y{" "}
          <strong>No.</strong>
        </p>
      </div>
    </section>
  );
}
