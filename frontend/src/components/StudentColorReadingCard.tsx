import type { StudentLectura } from "../lib/types";

export default function StudentColorReadingCard({ lectura }: { lectura: StudentLectura }) {
  const hex = lectura.hex;

  return (
    <section
      className="glass mb-6 overflow-hidden border-2 p-0"
      style={{ borderColor: `${hex}66` }}
    >
      <div className="px-5 py-4" style={{ backgroundColor: `${hex}22` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
          Solo tu equipo · {lectura.colorName} · sesión {lectura.sessionNumber}
        </p>
        <p className="mt-1 text-xs text-slate-400">{lectura.topic}</p>
        <h2 className="mt-1 text-lg font-bold text-white">{lectura.titulo}</h2>
      </div>

      <div className="border-t border-white/10 px-5 py-5" style={{ backgroundColor: `${hex}18` }}>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Tú lees este párrafo en voz alta</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {lectura.roleName} · {lectura.displayName || lectura.teammates.find((m) => m.isMe)?.displayName || "Tu turno"}
        </p>
        <p className="mt-3 text-base leading-relaxed text-white">{lectura.paragraph}</p>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lectura completa de tu equipo (cada quien lee el suyo)
        </p>
        <ol className="mt-3 space-y-3">
          {lectura.teammates.map((m) => (
            <li
              key={m.studentId}
              className={`rounded-xl border px-4 py-3 ${
                m.isMe ? "border-cyan-400/50 bg-cyan-500/15 ring-1 ring-cyan-300/30" : "border-white/10 bg-white/5"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {m.roleName}
                {m.isMe ? " · tú" : ""} · {m.displayName}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-100">{m.paragraph}</p>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-indigo-100">Producto de todo el equipo</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            {lectura.producto ||
              "Armen UN solo organizador gráfico o mapa cognitivo en Canva y expónganlo frente al grupo."}
          </p>
        </div>
      </div>
    </section>
  );
}
