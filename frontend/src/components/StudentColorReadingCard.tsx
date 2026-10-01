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
        <p className="mt-1 text-sm text-slate-300">Misión del equipo: {lectura.mision}</p>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Texto que lee tu equipo</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{lectura.texto}</p>
        <p className="mt-3 text-sm font-medium text-cyan-200">{lectura.preguntaGuia}</p>
        <p className="mt-2 text-xs text-slate-500">Claves: {lectura.clave.join(" · ")}</p>

        <h3 className="mt-5 text-sm font-semibold text-white">Qué le toca decir a cada quien</h3>
        <p className="mt-1 text-xs text-slate-500">
          Esto es privado de tu color. No compartas el texto con otra columna.
        </p>
        <ul className="mt-3 space-y-3">
          {lectura.teammates.map((m) => (
            <li
              key={m.studentId}
              className={`rounded-xl border px-3 py-2 ${
                m.isMe ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/5"
              }`}
            >
              <p className="text-sm font-semibold text-white">
                {m.displayName}
                {m.isMe ? " (tú)" : ""} · {m.roleName}
              </p>
              <p className="mt-1 text-xs text-slate-400">{m.roleTask}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">{m.speakScript}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
