import { useMemo, useState } from "react";
import type { StudentLectura } from "../lib/types";

export default function StudentColorReadingCard({ lectura }: { lectura: StudentLectura }) {
  const options = useMemo(() => {
    const past = lectura.pastReadings ?? [];
    const rest = past.filter((item) => item.sessionNumber !== lectura.sessionNumber);
    return [lectura, ...rest];
  }, [lectura]);

  const [sessionNumber, setSessionNumber] = useState(lectura.sessionNumber);
  const shown = options.find((item) => item.sessionNumber === sessionNumber) ?? lectura;
  const hex = shown.hex;
  const myName = shown.displayName || shown.teammates.find((m) => m.isMe)?.displayName || "Tu turno";
  const [open, setOpen] = useState(false);
  const [openParas, setOpenParas] = useState<Record<string, boolean>>(() => {
    const mine = shown.teammates.find((m) => m.isMe);
    return mine ? { [mine.studentId]: true } : {};
  });

  function chooseSession(next: number) {
    setSessionNumber(next);
    setOpen(false);
    const item = options.find((o) => o.sessionNumber === next) ?? lectura;
    const mine = item.teammates.find((m) => m.isMe);
    setOpenParas(mine ? { [mine.studentId]: true } : {});
  }

  function togglePara(id: string) {
    setOpenParas((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <section
      className="glass mb-6 overflow-hidden border-2 p-0"
      style={{ borderColor: `${hex}66` }}
    >
      {options.length > 1 ? (
        <div className="px-5 pt-4 no-print">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Consultar lectura
            <select
              value={shown.sessionNumber}
              onChange={(e) => chooseSession(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white"
            >
              {options.map((item) => (
                <option key={item.sessionNumber} value={item.sessionNumber}>
                  Sesión {item.sessionNumber} · {item.topic} · {item.titulo}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left no-print"
        style={{ backgroundColor: `${hex}22` }}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
            Solo tu equipo · {shown.colorName} · sesión {shown.sessionNumber}
          </p>
          <p className="mt-1 text-xs text-slate-400">{shown.topic}</p>
          <h2 className="mt-1 text-lg font-bold text-white">{shown.titulo}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {shown.roleName} · {myName}
          </p>
          {!open ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{shown.paragraph}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
          {open ? "Ocultar" : "Ver lectura"}
        </span>
      </button>

      <div className="hidden px-5 py-4 print:block" style={{ backgroundColor: `${hex}22` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
          Solo tu equipo · {shown.colorName} · sesión {shown.sessionNumber}
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">{shown.titulo}</h2>
      </div>

      <div className={open ? "block" : "hidden print:block"}>
        <div className="border-t border-white/10 px-5 py-5" style={{ backgroundColor: `${hex}18` }}>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Tú lees este párrafo en voz alta</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {shown.roleName} · {myName}
          </p>
          <p className="mt-3 max-w-prose text-[15px] leading-7 text-white">{shown.paragraph}</p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lectura completa de tu equipo (toca un nombre para ver u ocultar su párrafo)
          </p>
          <ol className="mt-3 space-y-3">
            {shown.teammates.map((m) => {
              const paraOpen = Boolean(openParas[m.studentId]);
              return (
                <li
                  key={m.studentId}
                  className={`rounded-xl border ${
                    m.isMe ? "border-cyan-400/50 bg-cyan-500/15 ring-1 ring-cyan-300/30" : "border-white/10 bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => togglePara(m.studentId)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left no-print"
                    aria-expanded={paraOpen}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {m.roleName}
                      {m.isMe ? " · tú" : ""} · {m.displayName}
                    </p>
                    <span className="text-xs font-semibold text-slate-400">{paraOpen ? "Ocultar" : "Ver"}</span>
                  </button>
                  <p className="hidden px-4 pb-3 text-xs font-bold uppercase tracking-wide text-slate-400 print:block">
                    {m.roleName}
                    {m.isMe ? " · tú" : ""} · {m.displayName}
                  </p>
                  <p className={`max-w-prose px-4 pb-3 text-[15px] leading-7 text-slate-100 ${paraOpen ? "block" : "hidden print:block"}`}>
                    {m.paragraph}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-indigo-100">Producto de todo el equipo</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-200">
              {shown.producto ||
                "Armen UN solo organizador gráfico o mapa cognitivo en Canva y expónganlo frente al grupo."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
