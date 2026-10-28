import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApiErrorMessage,
  submitInterfacePeerReview,
  type StudentInterfacePeer as PeerState,
} from "../lib/api";
import { INTERFACE_COTEJO, INTERFACE_MAX_POINTS } from "../lib/interfaceDesign";

function firmas(value: number) {
  return value.toLocaleString("es-MX");
}

export default function StudentInterfacePeer({
  teacherPoints,
  peer,
}: {
  teacherPoints: number | null;
  peer: PeerState;
}) {
  const qc = useQueryClient();
  const [openKey, setOpenKey] = useState<string | null>(peer.toReview[0]?.key ?? null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: submitInterfacePeerReview,
    onSuccess: (data) => {
      setError("");
      setDraft({});
      qc.setQueryData(["student-interface"], data);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const pending = peer.toReview.filter((team) => !team.done).length;

  function missedOf(teamKey: string, saved: string[]) {
    return draft[teamKey] ?? saved;
  }

  function toggle(teamKey: string, saved: string[], code: string) {
    const current = missedOf(teamKey, saved);
    const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
    setDraft((prev) => ({ ...prev, [teamKey]: next }));
  }

  return (
    <section className="glass mb-4 overflow-hidden p-0">
      <div className="bg-gradient-to-r from-cyan-600/30 to-violet-500/10 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-200">Coevaluación</p>
        <h2 className="mt-1 text-xl font-bold text-white">Evalúa el diseño de los demás equipos</h2>
        <p className="mt-1 text-sm text-slate-200">
          Todos evalúan a todos. Tu nombre se ve en el equipo que calificas.
          {peer.isLeader ? " Eres líder: tu cotejo queda marcado como coevaluación del líder." : ""}
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Calificación del docente</p>
            <p className="text-lg font-bold text-white">
              {teacherPoints == null ? "—" : firmas(teacherPoints)}
              <span className="text-sm font-medium text-slate-400"> / {firmas(INTERFACE_MAX_POINTS)}</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Promedio de tus compañeros</p>
            <p className="text-lg font-bold text-white">
              {peer.peerAverage == null ? "Aún no hay envíos" : firmas(peer.peerAverage)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Quién evalúa a tu equipo</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Ven tu diseño. Tú no ves su lista: solo si ya enviaron o siguen pendientes.
          </p>
          {peer.evaluatingUs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Todavía no hay otros equipos asignados.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {peer.evaluatingUs.map((person) => (
                <li
                  key={person.studentId}
                  className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                >
                  <span className="text-sm font-semibold text-white">{person.displayName}</span>
                  {person.isLeader ? (
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-100">
                      Líder
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-400">{person.teamName}</span>
                  <span
                    className={`ml-auto text-xs font-semibold ${
                      person.done ? "text-emerald-200" : "text-amber-100"
                    }`}
                  >
                    {person.done ? "Ya evaluó" : "Pendiente"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Equipos que debes evaluar</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {pending === 0
              ? "Ya enviaste todas. Puedes actualizar una si cambias de opinión."
              : `Te faltan ${pending} de ${peer.toReview.length}. Lo marcado en verde se cumple y no resta.`}
          </p>
          {peer.toReview.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No hay otros equipos en tu grupo.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {peer.toReview.map((team) => {
                const open = openKey === team.key;
                const missed = missedOf(team.key, team.missed);
                const dirty = draft[team.key] != null;
                return (
                  <li
                    key={team.key}
                    className="rounded-2xl border border-white/10 bg-slate-950/30"
                    style={{ borderColor: `${team.hex}66` }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenKey(open ? null : team.key)}
                      className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"
                    >
                      <span className="min-w-0 flex-1 text-sm font-semibold text-white">{team.name}</span>
                      <span className={`text-xs font-semibold ${team.done ? "text-emerald-200" : "text-amber-100"}`}>
                        {team.done ? `Enviada · ${firmas(team.points ?? 0)}` : "Pendiente"}
                      </span>
                    </button>
                    {open ? (
                      <div className="space-y-2 px-3 pb-3">
                        {INTERFACE_COTEJO.map((item) => {
                          const ok = !missed.includes(item.code);
                          return (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => toggle(team.key, team.missed, item.code)}
                              className={`flex min-h-11 w-full items-start gap-3 rounded-xl border px-3 py-2 text-left ${
                                ok
                                  ? "border-emerald-400/30 bg-emerald-500/10"
                                  : "border-rose-400/30 bg-rose-500/10"
                              }`}
                            >
                              <span
                                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-xs font-bold ${
                                  ok ? "bg-emerald-400 text-slate-950" : "bg-rose-400/80 text-slate-950"
                                }`}
                              >
                                {ok ? "✓" : "–"}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold leading-snug text-white">
                                  {item.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-400">
                                  {ok ? "Cumple" : `No cumple · −${firmas(item.points)}`}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ targetTeamKey: team.key, missed })}
                          className="min-h-11 w-full rounded-xl bg-cyan-600 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
                        >
                          {mutation.isPending ? "Enviando..." : dirty || !team.done ? "Enviar coevaluación" : "Actualizar"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
