import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage, setInterfacePeerPublished, type InterfacePeerBoard, type InterfaceSession } from "../lib/api";
import { INTERFACE_COTEJO, INTERFACE_COTEJO_TOTAL, INTERFACE_MAX_POINTS } from "../lib/interfaceDesign";

function firmas(value: number) {
  return value.toLocaleString("es-MX");
}

function previewBoard(teams: InterfaceSession["teams"]): InterfacePeerBoard {
  return {
    published: false,
    pointsMax: INTERFACE_COTEJO_TOTAL,
    teams: teams.map((team) => {
      const cut = team.notes
        .filter((note) => !note.studentId)
        .reduce((acc, note) => acc + note.points, 0);
      const evaluators = teams
        .filter((other) => other.key !== team.key)
        .flatMap((other) =>
          other.members.map((member) => ({
            studentId: member.studentId,
            displayName: member.displayName,
            teamKey: other.key,
            teamName: other.name,
            isLeader: other.leaderId === member.studentId,
            done: false,
            points: null,
            missed: [] as string[],
          })),
        )
        .sort((a, b) => {
          if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
          return a.teamName.localeCompare(b.teamName, "es") || a.displayName.localeCompare(b.displayName, "es");
        });
      return {
        key: team.key,
        name: team.name,
        hex: team.hex,
        teacherPoints: Math.max(0, INTERFACE_MAX_POINTS - cut),
        peerAverage: null,
        received: 0,
        expected: evaluators.length,
        evaluators,
      };
    }),
  };
}

function missedLabel(code: string) {
  return INTERFACE_COTEJO.find((item) => item.code === code)?.label ?? code;
}

export default function TeacherInterfacePeer({
  groupId,
  released,
  teams,
  peer,
}: {
  groupId: string;
  released: boolean;
  teams: InterfaceSession["teams"];
  peer?: InterfacePeerBoard;
}) {
  const qc = useQueryClient();
  const board = peer ?? previewBoard(teams);
  const live = Boolean(peer);

  const publishMutation = useMutation({
    mutationFn: (published: boolean) => setInterfacePeerPublished(groupId, published),
    onSuccess: (data) => {
      qc.setQueryData(["interface-session", groupId], data);
    },
  });

  function togglePublish() {
    const next = !board.published;
    const ok = window.confirm(
      next
        ? "¿Publicar la coevaluación? Cada alumno evaluará a los demás equipos y verá quién lo está evaluando. Tu calificación no cambia."
        : "¿Ocultar la coevaluación? Los alumnos dejan de verla. Lo que ya enviaron se conserva.",
    );
    if (!ok) return;
    publishMutation.mutate(next);
  }

  return (
    <section className="glass mt-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Coevaluación</p>
          <h2 className="mt-1 text-xl font-bold text-white">Todos evalúan a todos</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Cada alumno coteja el diseño de los demás equipos, con la misma lista de{" "}
            {firmas(INTERFACE_COTEJO_TOTAL)} firmas. El líder aparece marcado. Tu calificación queda
            aparte y no se mezcla con el promedio de ellos.
          </p>
        </div>
        <button
          type="button"
          onClick={togglePublish}
          disabled={publishMutation.isPending || teams.length === 0}
          className={`min-h-11 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto ${
            board.published
              ? "border border-amber-400/40 bg-amber-500/20"
              : "bg-cyan-600 hover:bg-cyan-500"
          }`}
        >
          {publishMutation.isPending
            ? "Guardando..."
            : board.published
              ? "Ocultar coevaluación"
              : "Publicar a los alumnos"}
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-3 text-sm text-cyan-50">
        <p className="font-semibold text-white">Así lo van a ver en su teléfono</p>
        <ul className="mt-2 space-y-1 text-cyan-100/90">
          <li>Su calificación del docente, aparte del promedio de los compañeros.</li>
          <li>El nombre de cada persona que evalúa a su equipo, si es líder y si ya envió o sigue pendiente.</li>
          <li>La lista de cotejo para evaluar a cada equipo que no es el suyo. Nadie evalúa al propio.</li>
        </ul>
        <p className="mt-2 text-xs text-cyan-100/70">
          {board.published
            ? "Ya está publicada. Los alumnos la ven si la actividad también está liberada."
            : "Todavía no está publicada. Este tablero es solo para ti."}
          {!released ? " Libera la actividad para que les aparezca en el teléfono." : ""}
        </p>
      </div>

      {publishMutation.isError ? (
        <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
          {getApiErrorMessage(publishMutation.error)}
        </p>
      ) : null}
      {!live ? (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Vista previa con los equipos de ahora. Publicar se activa cuando el servidor termine de
          actualizarse.
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {board.teams.map((team) => (
          <li
            key={team.key}
            className="rounded-2xl border p-4"
            style={{ borderColor: `${team.hex}88`, backgroundColor: `${team.hex}18` }}
          >
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: team.hex }}>
              {team.name}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-950/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Tu calificación</p>
                <p className="text-lg font-bold text-white">
                  {firmas(team.teacherPoints)}
                  <span className="text-sm font-medium text-slate-400"> / {firmas(INTERFACE_MAX_POINTS)}</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-950/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Promedio de ellos</p>
                <p className="text-lg font-bold text-white">
                  {team.peerAverage == null ? "—" : firmas(team.peerAverage)}
                  <span className="text-sm font-medium text-slate-400">
                    {" "}
                    · {team.received} de {team.expected}
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Quién los evalúa
            </p>
            {team.evaluators.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No hay otros equipos para coevaluar.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {team.evaluators.map((person) => (
                  <li key={person.studentId} className="rounded-xl bg-slate-950/35 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 text-sm font-semibold text-white">{person.displayName}</span>
                      {person.isLeader ? (
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-100">
                          Líder
                        </span>
                      ) : null}
                      <span className="text-xs text-slate-400">{person.teamName}</span>
                      <span
                        className={`ml-auto text-xs font-semibold ${
                          person.done ? "text-emerald-200" : "text-slate-400"
                        }`}
                      >
                        {person.done
                          ? `Ya evaluó · ${firmas(person.points ?? 0)}`
                          : "Pendiente"}
                      </span>
                    </div>
                    {person.done && person.missed.length > 0 ? (
                      <p className="mt-1 text-xs leading-relaxed text-rose-100/80">
                        No cumple: {person.missed.map(missedLabel).join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
