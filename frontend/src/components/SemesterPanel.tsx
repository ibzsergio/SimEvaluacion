import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createTeacherGroup,
  deleteTeacherGroup,
  fetchGroups,
  fetchTeacherComms,
  getApiErrorMessage,
  resetSemester,
} from "../lib/api";

const CONFIRM_PHRASE = "NUEVO SEMESTRE";

export default function SemesterPanel() {
  const qc = useQueryClient();
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [clearComms, setClearComms] = useState(false);
  const [newGroupCode, setNewGroupCode] = useState("");
  const [newGroupShift, setNewGroupShift] = useState("matutino");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  const commsQuery = useQuery({
    queryKey: ["teacher-comms"],
    queryFn: fetchTeacherComms,
  });

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: ["groups"] });
    await qc.invalidateQueries({ queryKey: ["teacher-comms"] });
    await qc.invalidateQueries({ queryKey: ["activities"] });
    await qc.invalidateQueries({ queryKey: ["office-exam-teacher"] });
  };

  const resetMutation = useMutation({
    mutationFn: () => resetSemester(confirmPhrase, clearComms),
    onSuccess: async (result) => {
      setConfirmPhrase("");
      setSuccess(
        `Semestre reiniciado: ${result.studentsRemoved} alumnos eliminados, ${result.groupsReset} grupos vaciados, ${result.examAttemptsRemoved} intentos de examen borrados.`,
      );
      setError("");
      await invalidateAll();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const createGroupMutation = useMutation({
    mutationFn: () => createTeacherGroup(newGroupCode.trim(), newGroupShift.trim()),
    onSuccess: async () => {
      setNewGroupCode("");
      setSuccess("Grupo creado.");
      setError("");
      await invalidateAll();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const groups = groupsQuery.data ?? commsQuery.data?.groups ?? [];

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}

      <section className="glass border border-amber-400/20 p-6">
        <h2 className="text-lg font-semibold text-white">Iniciar nuevo semestre</h2>
        <p className="mt-2 text-sm text-slate-300">
          Borra el historial académico de todos tus grupos actuales: alumnos, actividades, calificaciones,
          semanas, intentos del examen Office y cierres de parcial. Los grupos se mantienen (vacíos) para que
          importes la nueva lista de alumnos.
        </p>
        <p className="mt-2 text-sm text-amber-200/90">
          Esta acción no se puede deshacer. Escribe <strong>{CONFIRM_PHRASE}</strong> para confirmar.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            if (confirmPhrase.trim().toUpperCase() !== CONFIRM_PHRASE) {
              setError(`Escribe exactamente ${CONFIRM_PHRASE}.`);
              return;
            }
            const ok = window.confirm(
              "¿Confirmas reiniciar el semestre? Se eliminarán alumnos y todo su historial académico.",
            );
            if (!ok) return;
            resetMutation.mutate();
          }}
        >
          <label className="block text-xs text-slate-400">
            Confirmación
            <input
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white uppercase"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={clearComms}
              onChange={(e) => setClearComms(e.target.checked)}
              className="rounded border-white/20"
            />
            También borrar avisos, tareas y calendario escolar
          </label>
          <button
            type="submit"
            disabled={resetMutation.isPending}
            className="rounded-xl border border-amber-400/40 bg-amber-500/20 px-5 py-2.5 text-sm font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-60"
          >
            {resetMutation.isPending ? "Reiniciando..." : "Reiniciar semestre"}
          </button>
        </form>
      </section>

      <section className="glass p-6">
        <h2 className="text-lg font-semibold text-white">Grupos</h2>
        <p className="mt-1 text-sm text-slate-400">
          Crea grupos para el nuevo semestre (ej. 301, 302) o elimina grupos que ya no uses.
        </p>

        <ul className="mt-4 space-y-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-white">Grupo {g.code}</p>
                <p className="text-xs text-slate-400">{g.shift}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(
                    `¿Eliminar el grupo ${g.code}? Se borrarán también sus alumnos y actividades.`,
                  );
                  if (!ok) return;
                  deleteTeacherGroup(g.id)
                    .then(async () => {
                      setSuccess(`Grupo ${g.code} eliminado.`);
                      await invalidateAll();
                    })
                    .catch((err) => setError(getApiErrorMessage(err)));
                }}
                className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/15"
              >
                Eliminar grupo
              </button>
            </li>
          ))}
          {!groups.length && !groupsQuery.isLoading ? (
            <p className="text-sm text-slate-500">No hay grupos. Crea uno abajo.</p>
          ) : null}
        </ul>

        <form
          className="mt-6 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            if (!newGroupCode.trim()) {
              setError("Indica el código del grupo (ej. 301).");
              return;
            }
            createGroupMutation.mutate();
          }}
        >
          <label className="block text-xs text-slate-400">
            Código
            <input
              value={newGroupCode}
              onChange={(e) => setNewGroupCode(e.target.value)}
              placeholder="301"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Turno
            <input
              value={newGroupShift}
              onChange={(e) => setNewGroupShift(e.target.value)}
              placeholder="matutino"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createGroupMutation.isPending}
              className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {createGroupMutation.isPending ? "Creando..." : "Agregar grupo"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
