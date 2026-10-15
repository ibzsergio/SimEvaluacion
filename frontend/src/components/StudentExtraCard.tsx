import { useState } from "react";
import {
  EXTRA_FIRMAS_MAX,
  EXTRA_PROGRAMA,
  EXTRA_SECCIONES,
  EXTRA_TITULO,
  extraRoleLabel,
} from "../lib/extraScrum";
import type { StudentExtra } from "../lib/types";
import ExtraIllustration from "./ExtraIllustration";
import ExtraIndicacion from "./ExtraIndicacion";

const READ_KEY = "simeval-plan-accion-read-v1";

export default function StudentExtraCard({ extra }: { extra: StudentExtra }) {
  const hex = extra.hex;
  const [read, setRead] = useState(() => localStorage.getItem(READ_KEY) === "1");
  const [open, setOpen] = useState(() => localStorage.getItem(READ_KEY) !== "1");

  function markRead() {
    localStorage.setItem(READ_KEY, "1");
    setRead(true);
  }

  return (
    <section className="glass mb-6 overflow-hidden border-2 p-0" style={{ borderColor: `${hex}66` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
        style={{ backgroundColor: `${hex}22` }}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
            {EXTRA_PROGRAMA} · {extra.teamName ?? extra.columna ?? extra.colorName}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{EXTRA_TITULO}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {extra.noTeam
              ? "Aún no estás en un equipo de Roles / Equipos. Pide al docente que te asigne."
              : extra.firmas != null
                ? `${extra.firmas.toLocaleString("es-MX")} / ${(extra.firmasMax ?? EXTRA_FIRMAS_MAX).toLocaleString("es-MX")} Firmas.`
                : "Interfaces de su app Tkinter. Lean las instrucciones y trabajen en equipo."}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {open ? "Ocultar" : "Ver reto"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 px-5 pb-5 pt-2">
          <ExtraIllustration compact />
          <ExtraIndicacion />

          {extra.firmas != null || (extra.notes && extra.notes.length > 0) ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Tus Firmas</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {(extra.firmas ?? extra.firmasMax ?? EXTRA_FIRMAS_MAX).toLocaleString("es-MX")} /{" "}
                {(extra.firmasMax ?? EXTRA_FIRMAS_MAX).toLocaleString("es-MX")}
              </p>
              {extra.notes && extra.notes.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-amber-100">
                  {extra.notes.map((n) => (
                    <li key={n.id}>
                      {n.label}
                      {n.studentName ? ` · ${n.studentName}` : ""} −{n.points}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-amber-100">Sin notas. El docente aún puede anotar.</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Misión por rol (todos pegan)</h3>
            {EXTRA_SECCIONES.map((sec) => (
              <div key={sec.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: hex }}>
                  {sec.rol} · {sec.titulo}
                </p>
                <p className="mt-1 text-sm text-slate-200">{sec.detalle}</p>
              </div>
            ))}
          </div>

          {!read ? (
            <button
              type="button"
              onClick={markRead}
              className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
            >
              Ya leí las instrucciones
            </button>
          ) : extra.noTeam ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              No apareces en un equipo de Roles / Equipos. El docente te puede asignar ahí.
            </p>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold text-white">Tu equipo de proyecto</h3>
              <p className="mt-1 text-xs text-slate-400">El mismo de Roles / Equipos.</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-200">
                {extra.members.map((m) => (
                  <li key={m.studentId}>
                    {m.displayName}
                    {m.role ? ` · ${extraRoleLabel(m.role)}` : ""}
                    {m.studentId === extra.leaderId ? " · líder" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
