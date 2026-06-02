import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  downloadStudentsTemplate,
  fetchGroupStudents,
  getApiErrorMessage,
  dedupeStudents,
  importStudentsExcel,
  importStudentsWorkbook,
  resetStudentPassword,
} from "../lib/api";
import type { ClassGroup } from "../lib/types";

export default function GroupStudentsPanel({
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
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; control: string } | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");

  const selected = groups.find((g) => g.id === selectedGroupId);

  const studentsQuery = useQuery({
    queryKey: ["group-students", selectedGroupId],
    queryFn: () => fetchGroupStudents(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const workbookMutation = useMutation({
    mutationFn: (file: File) => importStudentsWorkbook(file),
    onSuccess: (data) => {
      const lines = data.results.map(
        (r) =>
          `Grupo ${r.groupCode} (hoja "${r.sheetName}"): ${r.summary.total} filas (${r.summary.created} nuevos, ${r.summary.updated} actualizados${r.summary.skipped ? `, ${r.summary.skipped} omitidos` : ""})`,
      );
      const skipped =
        data.skippedSheets.length > 0
          ? ` Hojas no usadas: ${data.skippedSheets.join(", ")}.`
          : "";
      setMessage({ type: "ok", text: lines.join(" · ") + skipped });
      qc.invalidateQueries({ queryKey: ["group-students"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      if (workbookRef.current) workbookRef.current.value = "";
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importStudentsExcel(selectedGroupId, file),
    onSuccess: (data) => {
      setMessage({
        type: "ok",
        text: `Importados ${data.summary.total} filas (${data.summary.created} nuevos, ${data.summary.updated} actualizados${data.summary.skipped ? `, ${data.summary.skipped} omitidos sin número de control` : ""}). Si subes el mismo archivo, solo actualiza.`,
      });
      qc.invalidateQueries({ queryKey: ["group-students", selectedGroupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  const dedupeMutation = useMutation({
    mutationFn: () => dedupeStudents(),
    onSuccess: (data) => {
      setMessage({
        type: "ok",
        text: data.message + (data.details.length ? ` ${data.details.join(" · ")}` : ""),
      });
      qc.invalidateQueries({ queryKey: ["group-students"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetStudentPassword(selectedGroupId, resetTarget!.id, newPassword),
    onSuccess: (data) => {
      setMessage({
        type: "ok",
        text: `Contraseña de ${data.displayName} (${data.controlNumber}): ${data.newPassword}`,
      });
      setResetTarget(null);
      setNewPassword("");
      qc.invalidateQueries({ queryKey: ["group-students", selectedGroupId] });
    },
    onError: (err) => setMessage({ type: "err", text: getApiErrorMessage(err) }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectGroup(g.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              g.id === selectedGroupId
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Grupo {g.code} · {g.shift}
            <span className="ml-2 text-xs opacity-70">({g.studentCount ?? 0} alumnos)</span>
          </button>
        ))}
      </div>

      <section className="glass border-amber-400/20 p-5">
        <h2 className="text-lg font-semibold text-white">Limpiar lista de alumnos</h2>
        <p className="mt-1 text-sm text-slate-400">
          Quita filas inválidas (ej. &quot;No.&quot; / &quot;NOMBRE DEL ALUMNO&quot;) y duplicados por nombre.
          Conserva contraseñas y calificaciones del alumno correcto.
        </p>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            dedupeMutation.mutate();
          }}
          disabled={dedupeMutation.isPending}
          className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-60"
        >
          {dedupeMutation.isPending ? "Limpiando..." : "Limpiar alumnos (encabezados y duplicados)"}
        </button>
      </section>

      <section className="glass border-rose-400/20 p-4">
        <p className="text-sm text-rose-200/95">
          <strong>No subas aquí</strong> el Excel de calificaciones (CARATULA, P1 SUMA, etc.). Ese archivo va en la
          pestaña <strong>Actividades y calificaciones</strong>.
        </p>
      </section>

      <section className="glass border-cyan-400/20 p-5">
        <h2 className="text-lg font-semibold text-white">Importar lista de alumnos (201 + 202)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Excel con <strong>número de control</strong> y <strong>nombre completo</strong> en hojas{" "}
          <strong>201</strong> y <strong>202</strong>. Si solo tienes nombres como en el Excel de calificaciones,
          importa primero alumnos y luego calificaciones en la otra pestaña.
        </p>
        <input
          ref={workbookRef}
          type="file"
          accept=".xlsx,.xls"
          className="mt-4 block w-full max-w-lg text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setMessage(null);
            workbookMutation.mutate(file);
          }}
        />
        {workbookMutation.isPending ? (
          <p className="mt-2 text-sm text-cyan-300">Leyendo hojas 201 y 202...</p>
        ) : null}
      </section>

      <section className="glass p-5">
        <h2 className="text-lg font-semibold text-white">
          O importar solo un grupo — {selected?.code} ({selected?.shift})
        </h2>
        <p className="mt-1 text-sm text-slate-500">Una hoja o archivo CSV para el grupo seleccionado.</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="block w-full max-w-md text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setMessage(null);
              importMutation.mutate(file);
            }}
          />
          <button
            type="button"
            onClick={() => downloadStudentsTemplate(selectedGroupId)}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            Descargar plantilla CSV
          </button>
        </div>

        {importMutation.isPending ? (
          <p className="mt-3 text-sm text-cyan-300">Importando alumnos...</p>
        ) : null}

        {message ? (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              message.type === "ok"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-400/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <div className="mt-4 rounded-xl bg-slate-900/50 p-3 text-xs text-slate-400">
          <p className="font-medium text-slate-300">Formato del Excel</p>
          <pre className="mt-2 font-mono text-slate-300">{`Numero de control | Nombre completo
20210001          | García López Juan
20210002          | Martínez Pérez Ana`}</pre>
        </div>
      </section>

      <section className="glass p-5">
        <h3 className="mb-3 font-semibold text-white">
          Alumnos del grupo ({studentsQuery.data?.students.length ?? 0})
        </h3>
        {studentsQuery.isLoading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-2">No. control</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Contraseña</th>
                  <th className="px-4 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {studentsQuery.data?.students.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-4 py-2 font-mono text-cyan-300">{s.controlNumber ?? "—"}</td>
                    <td className="px-4 py-2 text-white">{s.displayName}</td>
                    <td className="px-4 py-2 text-xs text-slate-300">{s.passwordLabel}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setResetTarget({
                            id: s.id,
                            name: s.displayName,
                            control: s.controlNumber ?? "",
                          })
                        }
                        className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 hover:bg-amber-500/20"
                      >
                        Restablecer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!studentsQuery.data?.students.length ? (
              <p className="p-4 text-sm text-slate-500">Importa tu Excel para ver la lista.</p>
            ) : null}
          </div>
        )}
      </section>

      {resetTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="glass w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white">Restablecer contraseña</h3>
            <p className="mt-1 text-sm text-slate-400">
              {resetTarget.name} · Control {resetTarget.control}
            </p>
            <p className="mt-2 text-xs text-amber-200/90">
              La nueva contraseña quedará visible aquí para que se la indiques al alumno.
            </p>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 4 caracteres)"
              className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white"
              minLength={4}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => resetMutation.mutate()}
                disabled={newPassword.length < 4 || resetMutation.isPending}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {resetMutation.isPending ? "Guardando..." : "Guardar nueva contraseña"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setNewPassword("");
                }}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
