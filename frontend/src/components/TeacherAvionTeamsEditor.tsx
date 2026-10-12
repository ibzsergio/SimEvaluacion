import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage, resetAvionTeamsToSeating, saveAvionTeams } from "../lib/api";
import type { AvionSession } from "../lib/types";

function draftFromSession(session: AvionSession) {
  const next: Record<string, string> = {};
  for (const row of session.assignments ?? []) next[row.studentId] = row.teamKey;
  return next;
}

function shuffleIntoSlots(studentIds: string[], slotKeys: string[]) {
  const ids = [...studentIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = ids[i]!;
    ids[i] = ids[j]!;
    ids[j] = tmp;
  }
  const next: Record<string, string> = {};
  const n = Math.max(1, slotKeys.length);
  const base = Math.floor(ids.length / n);
  const rem = ids.length % n;
  let offset = 0;
  slotKeys.forEach((key, i) => {
    const size = i < rem ? base + 1 : base;
    for (let k = 0; k < size; k++) {
      const id = ids[offset + k];
      if (id) next[id] = key;
    }
    offset += size;
  });
  return next;
}

export default function TeacherAvionTeamsEditor({
  groupId,
  session,
}: {
  groupId: string;
  session: AvionSession;
}) {
  const qc = useQueryClient();
  const slots = session.slots ?? [];
  const [draft, setDraft] = useState(() => draftFromSession(session));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (dirty) return;
    setDraft(draftFromSession(session));
  }, [session, dirty]);

  const people = session.assignments ?? [];
  const unassigned = people.filter((p) => !draft[p.studentId]);
  const custom = session.rosterMode === "custom";

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of slots) map.set(slot.key, 0);
    for (const p of people) {
      const key = draft[p.studentId];
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [draft, people, slots]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveAvionTeams(
        groupId,
        slots.map((slot) => ({
          key: slot.key,
          memberIds: people.filter((p) => draft[p.studentId] === slot.key).map((p) => p.studentId),
        })),
      ),
    onSuccess: async (data) => {
      setDirty(false);
      setError("");
      setMessage("Equipos del Sprint aéreo guardados. Las butacas y la lectura no se movieron.");
      setDraft(draftFromSession(data));
      qc.setQueryData(["avion-session", groupId], data);
      await qc.invalidateQueries({ queryKey: ["avion-session", groupId] });
    },
    onError: (err) => {
      setMessage("");
      setError(getApiErrorMessage(err));
    },
  });

  const seatingMutation = useMutation({
    mutationFn: () => resetAvionTeamsToSeating(groupId),
    onSuccess: async (data) => {
      setDirty(false);
      setError("");
      setMessage("Volviste a los equipos de butacas, solo para este reto.");
      setDraft(draftFromSession(data));
      qc.setQueryData(["avion-session", groupId], data);
      await qc.invalidateQueries({ queryKey: ["avion-session", groupId] });
    },
    onError: (err) => {
      setMessage("");
      setError(getApiErrorMessage(err));
    },
  });

  function move(studentId: string, teamKey: string) {
    setDraft((prev) => ({ ...prev, [studentId]: teamKey }));
    setDirty(true);
    setMessage("");
    setError("");
  }

  function shuffle() {
    setDraft(shuffleIntoSlots(people.map((p) => p.studentId), slots.map((s) => s.key)));
    setDirty(true);
    setMessage("Reparte al azar. Revisa y pulsa Guardar equipos.");
    setError("");
  }

  function handleSeating() {
    const ok = window.confirm(
      "¿Usar otra vez los equipos de butacas para el Sprint aéreo?\n\nNo se cambia el salón ni la lectura. Solo este reto.",
    );
    if (!ok) return;
    seatingMutation.mutate();
  }

  if (!slots.length || !people.length) {
    return (
      <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        No hay lista de alumnos para armar equipos. Revisa el grupo 301 en Alumnos.
      </p>
    );
  }

  return (
    <section className="glass mb-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Grupo {session.groupCode}</p>
          <h2 className="mt-1 text-xl font-bold text-white">Cambiar equipos del Sprint aéreo</h2>
          <p className="mt-1 text-sm text-slate-400">
            Mueve alumnos de color. Esto no cambia butacas ni la lectura.{" "}
            {custom ? "Ahora usas equipos propios de este reto." : "Ahora copian las butacas; al guardar quedan solo para el avión."}
          </p>
        </div>
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
          {people.length} alumnos · {unassigned.length} sin equipo
        </p>
      </div>

      {session.skipped?.length ? (
        <p className="mt-3 text-xs text-slate-400">
          No entran (baja): {session.skipped.map((s) => s.displayName).join(", ")}.
        </p>
      ) : null}

      {unassigned.length ? (
        <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          {unassigned.length === 1
            ? `${unassigned[0]!.displayName} no verá el reto hasta que lo pongas en un color.`
            : `${unassigned.length} alumnos no verán el reto hasta que los pongas en un equipo.`}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => {
          const members = people.filter((p) => draft[p.studentId] === slot.key);
          return (
            <div
              key={slot.key}
              className="rounded-2xl border p-4"
              style={{ borderColor: `${slot.hex}88`, backgroundColor: `${slot.hex}18` }}
            >
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: slot.hex }}>
                {slot.colorName} · {counts.get(slot.key) ?? 0}
              </p>
              <ul className="mt-3 space-y-2">
                {members.length === 0 ? (
                  <li className="text-xs text-slate-400">Vacío</li>
                ) : (
                  members.map((m) => (
                    <li key={m.studentId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm text-slate-100">{m.displayName}</span>
                      <select
                        value={draft[m.studentId] ?? ""}
                        onChange={(e) => move(m.studentId, e.target.value)}
                        className="max-w-[44%] rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="">Sin equipo</option>
                        {slots.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.colorName}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {unassigned.length ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sin equipo</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassigned.map((m) => (
              <li key={m.studentId} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-slate-200">{m.displayName}</span>
                <select
                  value=""
                  onChange={(e) => move(m.studentId, e.target.value)}
                  className="max-w-[44%] rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-xs text-slate-100"
                >
                  <option value="">Elegir color</option>
                  {slots.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.colorName}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !dirty}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-[#ffffff] hover:bg-emerald-500 disabled:opacity-60"
        >
          {saveMutation.isPending ? "Guardando..." : "Guardar equipos"}
        </button>
        <button
          type="button"
          onClick={shuffle}
          disabled={saveMutation.isPending}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
        >
          Repartir al azar
        </button>
        <button
          type="button"
          onClick={handleSeating}
          disabled={seatingMutation.isPending || saveMutation.isPending}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-60"
        >
          {seatingMutation.isPending ? "Restaurando..." : "Usar equipos de butacas"}
        </button>
        {dirty ? <p className="text-xs text-amber-200">Hay cambios sin guardar.</p> : null}
      </div>
      {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
