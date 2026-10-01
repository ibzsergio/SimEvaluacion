import { bloquePorColor, rolPorFila } from "../lib/lecturaTkinter";
import type { StudentSeating } from "../lib/types";

export default function StudentColorReadingCard({ seating }: { seating: StudentSeating }) {
  const bloque = bloquePorColor(seating.columnColorName || seating.colorName, seating.col);
  const rol = rolPorFila(seating.row);
  const hex = bloque.hex;

  return (
    <section
      className="glass mb-6 overflow-hidden border-2 p-0"
      style={{ borderColor: `${hex}66` }}
    >
      <div className="px-5 py-4" style={{ backgroundColor: `${hex}22` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: hex }}>
          Lectura de hoy · {bloque.colorName}
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">{bloque.titulo}</h2>
        <p className="mt-1 text-sm text-slate-300">
          Tu rol (fila {seating.row}): <strong className="text-white">{rol.name}</strong> — {rol.task}
        </p>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-slate-200">{bloque.texto}</p>
        <p className="mt-3 text-sm font-medium text-cyan-200">Pregunta de tu equipo: {bloque.preguntaGuia}</p>
        <p className="mt-2 text-xs text-slate-500">Palabras clave: {bloque.clave.join(" · ")}</p>
      </div>
    </section>
  );
}
