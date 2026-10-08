export default function AvionIllustration({ compact = false }: { compact?: boolean }) {
  const width = compact ? 280 : 360;
  const height = compact ? 200 : 240;
  return (
    <figure className="mx-auto max-w-md">
      <svg
        viewBox="0 0 360 240"
        width={width}
        height={height}
        className="mx-auto h-auto w-full max-w-sm"
        role="img"
        aria-label="Avión de papel sobre una pista de medición"
      >
        <defs>
          <linearGradient id="avion-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="240" rx="24" fill="url(#avion-sky)" />
        <ellipse cx="180" cy="210" rx="130" ry="14" fill="#134e4a" opacity="0.7" />
        <rect x="40" y="198" width="280" height="8" rx="4" fill="#94a3b8" />
        <g fill="#cbd5e1">
          <rect x="70" y="196" width="2" height="12" />
          <rect x="140" y="196" width="2" height="12" />
          <rect x="210" y="196" width="2" height="12" />
          <rect x="280" y="196" width="2" height="12" />
        </g>
        <g transform="translate(70 70) rotate(-18)">
          <polygon points="0,40 210,20 40,70" fill="#e2e8f0" />
          <polygon points="0,40 210,20 170,38" fill="#f8fafc" />
          <polygon points="70,32 140,28 95,86" fill="#38bdf8" />
          <line x1="0" y1="40" x2="210" y2="20" stroke="#0f172a" strokeWidth="2" />
        </g>
        <text x="250" y="48" fill="#7dd3fc" fontSize="13" fontWeight="700">
          Scrum
        </text>
      </svg>
    </figure>
  );
}
