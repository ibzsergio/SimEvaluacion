import { TORRE_NIVELES } from "../lib/torreTkinter";

const FLAG_COLORS = ["#f472b6", "#22d3ee", "#fbbf24", "#34d399", "#a78bfa"];

export default function TorreIllustration({ compact = false }: { compact?: boolean }) {
  const width = compact ? 280 : 360;
  const height = compact ? 320 : 420;
  return (
    <figure className="mx-auto max-w-md">
      <svg
        viewBox="0 0 360 420"
        width={width}
        height={height}
        className="mx-auto h-auto w-full max-w-sm"
        role="img"
        aria-label="Torre de popotes con banderillas de Tkinter y una bandera en la cima que dice Tkinter"
      >
        <defs>
          <linearGradient id="torre-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="420" rx="24" fill="url(#torre-sky)" />
        <ellipse cx="180" cy="392" rx="110" ry="16" fill="#334155" opacity="0.7" />
        <rect x="78" y="368" width="204" height="14" rx="4" fill="#94a3b8" />
        <rect x="86" y="360" width="188" height="10" rx="3" fill="#cbd5e1" />

        {/* popotes verticales */}
        <g stroke="#e2e8f0" strokeWidth="7" strokeLinecap="round">
          <line x1="130" y1="360" x2="148" y2="86" />
          <line x1="180" y1="360" x2="180" y2="22" />
          <line x1="230" y1="360" x2="212" y2="86" />
        </g>
        <g stroke="#94a3b8" strokeWidth="4" strokeLinecap="round">
          <line x1="132" y1="318" x2="228" y2="318" />
          <line x1="138" y1="262" x2="222" y2="262" />
          <line x1="144" y1="206" x2="216" y2="206" />
          <line x1="150" y1="150" x2="210" y2="150" />
          <line x1="156" y1="104" x2="204" y2="104" />
          <line x1="132" y1="318" x2="222" y2="262" />
          <line x1="228" y1="318" x2="138" y2="262" />
          <line x1="144" y1="206" x2="210" y2="150" />
          <line x1="216" y1="206" x2="150" y2="150" />
        </g>

        {/* Bandera final: Tkinter */}
        <line x1="180" y1="22" x2="180" y2="8" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
        <polygon points="180,8 268,20 180,36" fill="#f43f5e" />
        <text
          x="208"
          y="25"
          textAnchor="middle"
          fill="#fff"
          fontSize="10"
          fontWeight="800"
          fontFamily="ui-sans-serif, system-ui"
        >
          Tkinter
        </text>

        {TORRE_NIVELES.map((nivel, i) => {
          const y = 318 - i * 54;
          const x = i % 2 === 0 ? 28 : 236;
          const color = FLAG_COLORS[i];
          const word = nivel.palabras[0];
          return (
            <g key={nivel.nivel}>
              <line
                x1={i % 2 === 0 ? 148 : 212}
                y1={y}
                x2={i % 2 === 0 ? 86 : 274}
                y2={y - 8}
                stroke={color}
                strokeWidth="2"
              />
              <polygon
                points={
                  i % 2 === 0
                    ? `${x},${y - 22} ${x + 92},${y - 10} ${x + 92},${y + 18} ${x},${y + 6}`
                    : `${x + 92},${y - 22} ${x},${y - 10} ${x},${y + 18} ${x + 92},${y + 6}`
                }
                fill={color}
              />
              <text
                x={x + 46}
                y={y + 2}
                textAnchor="middle"
                fill="#0f172a"
                fontSize="11"
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui"
              >
                {word}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-slate-400">
        Producto terminado: torre de popotes con banderillas de hojas de color y, en la cima, una bandera que
        diga Tkinter. Gana la más alta que se sostenga sola.
      </figcaption>
    </figure>
  );
}
