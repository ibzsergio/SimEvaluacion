import type { StudentSeating } from "../lib/types";

export default function StudentSeatingCard({ seating }: { seating: StudentSeating }) {
  return (
    <section
      className="glass mb-6 overflow-hidden border-2 p-0"
      style={{ borderColor: `${seating.color}66` }}
    >
      <div
        className="px-6 py-4"
        style={{
          background: `linear-gradient(135deg, ${seating.color}33 0%, transparent 70%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Tu lugar hoy
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-white">{seating.label}</h2>
            <p className="mt-1 text-sm text-slate-300">
              Asiento <strong className="text-white">#{seating.seatNumber}</strong>
              {seating.listPosition ? (
                <span className="text-slate-400"> · Lista #{seating.listPosition}</span>
              ) : null}
            </p>
          </div>
          <div className="text-right">
            <span
              className="inline-block rounded-2xl px-4 py-2 text-sm font-bold text-slate-950 shadow-lg"
              style={{ backgroundColor: seating.color }}
            >
              {seating.theme === "column_colors"
                ? `Columna ${seating.columnColorName}`
                : seating.colorName}
            </span>
            <p className="mt-2 text-[11px] text-slate-500">
              Busca tu color en el aula · Fila {seating.row}, Col. {seating.col}
            </p>
          </div>
        </div>
      </div>

      <MiniSeatMap seating={seating} />
    </section>
  );
}

function MiniSeatMap({ seating }: { seating: StudentSeating }) {
  const cells = Array.from({ length: 36 }, (_, i) => {
    const row = Math.floor(i / 6) + 1;
    const col = (i % 6) + 1;
    const seatNumber = i + 1;
    const isMine = seatNumber === seating.seatNumber;
    const sameColumn = col === seating.col && seating.theme === "column_colors";
    return { row, col, seatNumber, isMine, sameColumn };
  });

  return (
    <div className="border-t border-white/10 bg-slate-950/40 px-4 py-4">
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Mapa del aula · tú estás resaltado
      </p>
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {cells.map((cell) => (
          <div
            key={cell.seatNumber}
            className={`flex h-7 items-center justify-center rounded-md text-[9px] font-bold ${
              cell.isMine
                ? "ring-2 ring-white text-slate-950"
                : cell.sameColumn
                  ? "opacity-50"
                  : "bg-white/5 text-slate-600"
            }`}
            style={
              cell.isMine
                ? { backgroundColor: seating.color }
                : cell.sameColumn
                  ? { backgroundColor: `${seating.color}44` }
                  : undefined
            }
            title={cell.isMine ? "Tu lugar" : `Asiento #${cell.seatNumber}`}
          >
            {cell.isMine ? "Tú" : cell.seatNumber}
          </div>
        ))}
      </div>
    </div>
  );
}
