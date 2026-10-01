import { bloquePorIndice } from "../lib/lecturaTkinter";
import type { StudentLectura } from "../lib/types";

export default function StudentColorReadingCard({ lectura }: { lectura: StudentLectura }) {
  const bloque = bloquePorIndice(lectura.readingIndex);
  const hex = lectura.hex || bloque.hex;

  return (
    <section
      className="glass mb-6 overflow-hidden border-2 p-0"
      style={{ borderColor: `${hex}66` }}
    >
      <div className="px-5 py-4" style={{ backgroundColor: `${hex}22` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
          Lectura de tu equipo · {lectura.colorName} · {lectura.readingIndex + 1} de {lectura.teamCount}
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">{bloque.titulo}</h2>
        <p className="mt-1 text-sm text-slate-300">
          Tu rol: <strong className="text-white">{lectura.roleName}</strong> — {lectura.roleTask}
        </p>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-slate-200">{bloque.texto}</p>
        <p className="mt-3 text-sm font-medium text-cyan-200">Pregunta de tu equipo: {bloque.preguntaGuia}</p>
        <p className="mt-2 text-xs text-slate-500">Palabras clave: {bloque.clave.join(" · ")}</p>
        {lectura.teammates.length > 1 ? (
          <p className="mt-3 text-xs text-slate-400">
            Equipo:{" "}
            {lectura.teammates
              .map((m) => (m.isMe ? `${m.displayName} (tú, ${m.roleName})` : `${m.displayName} · ${m.roleName}`))
              .join(" · ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
