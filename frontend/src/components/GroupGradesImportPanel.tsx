import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  downloadGradesTemplate,
  getApiErrorMessage,
  importGradesExcel,
  importGradesWorkbook,
} from "../lib/api";
import type { ClassGroup } from "../lib/types";

type GradeImportSummary = {
  activitiesCreated: number;
  activitiesMatched: number;
  gradesUpserted: number;
  gradesSkipped: number;
  unknownControls: string[];
  unknownStudents: string[];
};

function formatSummary(summary: GradeImportSummary) {
  const parts = [
    `${summary.activitiesCreated} actividades nuevas`,
    `${summary.activitiesMatched} ya existían`,
    `${summary.gradesUpserted} calificaciones guardadas`,
  ];
  if (summary.unknownStudents.length) {
    parts.push(
      `${summary.unknownStudents.length} nombres no encontrados (${summary.unknownStudents.slice(0, 3).join("; ")}${summary.unknownStudents.length > 3 ? "…" : ""})`,
    );
  }
  if (summary.unknownControls.length) {
    parts.push(
      `${summary.unknownControls.length} controles no encontrados`,
    );
  }
  return parts.join(" · ");
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
  const fileRef = useRef<HTMLInputElement>(null);
  const workbookRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const selected = groups.find((g) => g.id === selectedGroupId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["activities", selectedGroupId] });
    qc.invalidateQueries({ queryKey: ["grades"] });
    qc.invalidateQueries({ queryKey: ["group-ranking", selectedGroupId] });
  };

  const workbookMutation = useMutation({
    mutationFn: (file: File) => importGradesWorkbook(file),
    onSuccess: (data) => {
      const lines = data.results.map(
        (r) => `Grupo ${r.groupCode} (hoja "${r.sheetName}"): ${formatSummary(r.summary)}`,
      );
      const skipped =
        data.skippedSheets.length > 0
          ? ` Hojas no usadas: ${data.skippedSheets.join(", ")}.`
          : "";
      setMessage({ type: "ok", text: lines.join(" · ") + skipped });
      invalidate();
      if (workbookRef.current) workbookRef.current.value = "";
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importGradesExcel(selectedGroupId, file),
    onSuccess: (data) => {
      setMessage({
        type: "ok",
        text: `Grupo ${data.group.code}: ${formatSummary(data.summary)}`,
      });
      invalidate();
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  return (
    <section className="glass mb-6 border-indigo-400/25 p-5">
      <h2 className="text-lg font-semibold text-white">Importar actividades y calificaciones (Excel)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Sube un Excel con actividades en columnas y calificaciones por alumno. Si la actividad ya existe
        (mismo nombre y fecha en el grupo), solo actualiza calificaciones. También puedes crear y calificar
        una por una abajo.
      </p>

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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-slate-300">Archivo con hojas 201 y 202</p>
          <input
            ref={workbookRef}
            type="file"
            accept=".xlsx,.xls"
            className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setMessage(null);
              workbookMutation.mutate(file);
            }}
          />
          {workbookMutation.isPending ? (
            <p className="mt-2 text-sm text-indigo-300">Importando hojas 201 y 202...</p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-300">
            Solo grupo {selected?.code} ({selected?.shift})
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="block max-w-md flex-1 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setMessage(null);
                importMutation.mutate(file);
              }}
            />
            <button
              type="button"
              onClick={() => downloadGradesTemplate(selectedGroupId)}
              className="rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
            >
              Plantilla CSV
            </button>
          </div>
          {importMutation.isPending ? (
            <p className="mt-2 text-sm text-indigo-300">Importando calificaciones...</p>
          ) : null}
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
        <p className="font-medium text-slate-300">Formato como tu Excel (hojas 201 y 202)</p>
        <pre className="mt-2 overflow-x-auto font-mono text-slate-300">{`No. | NOMBRE DEL ALUMNO | CARATULA | P1 SUMA | CODIGOS CLIENTE | ...
1   | Garcia Lopez Juan | 1000     | 1500    | 2000              | ...`}</pre>
        <p className="mt-2">
          Cada columna con nombre es una actividad (CARATULA, P1 SUMA, CODIGOS CLIENTE, etc.), excepto{" "}
          <strong>NOMBRE DEL ALUMNO</strong> y la columna <strong>No.</strong> Los alumnos se buscan por nombre.
          Puntos 500/1000/1500: el máximo de cada actividad se calcula del archivo.
        </p>
      </div>
    </section>
  );
}
