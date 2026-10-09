function PaperPlaneInvalid() {
  return (
    <g>
      <g transform="translate(28 38) rotate(-16)">
        <polygon points="0,36 150,16 32,58" fill="#e2e8f0" />
        <polygon points="0,36 150,16 122,32" fill="#f8fafc" />
        <polygon points="48,28 98,24 68,70" fill="#94a3b8" />
      </g>
      <line x1="36" y1="36" x2="168" y2="118" stroke="#f43f5e" strokeWidth="10" strokeLinecap="round" />
      <line x1="168" y1="36" x2="36" y2="118" stroke="#f43f5e" strokeWidth="10" strokeLinecap="round" />
    </g>
  );
}

function BuiltPlaneA() {
  return (
    <g>
      <rect x="48" y="86" width="118" height="10" rx="3" fill="#b45309" />
      <rect x="52" y="82" width="8" height="18" rx="2" fill="#92400e" />
      <rect x="154" y="82" width="8" height="18" rx="2" fill="#92400e" />
      <polygon points="40,90 108,48 176,90" fill="#fde68a" stroke="#ca8a04" strokeWidth="2" />
      <polygon points="40,90 108,58 176,90" fill="#fcd34d" />
      <polygon points="148,88 196,70 196,108" fill="#fef3c7" stroke="#ca8a04" strokeWidth="1.5" />
      <circle cx="62" cy="91" r="4" fill="#38bdf8" />
      <circle cx="78" cy="91" r="4" fill="#38bdf8" />
      <text x="86" y="94" fill="#0f172a" fontSize="9" fontWeight="700">
        NOMBRE
      </text>
    </g>
  );
}

function BuiltPlaneB() {
  return (
    <g>
      <rect x="54" y="88" width="112" height="9" rx="3" fill="#a16207" />
      <line x1="70" y1="88" x2="70" y2="70" stroke="#78350f" strokeWidth="3" />
      <line x1="150" y1="88" x2="150" y2="70" stroke="#78350f" strokeWidth="3" />
      <ellipse cx="110" cy="68" rx="78" ry="22" fill="#fdba74" stroke="#c2410c" strokeWidth="2" />
      <polygon points="158,90 198,78 198,104" fill="#fed7aa" stroke="#c2410c" strokeWidth="1.5" />
      <rect x="96" y="84" width="28" height="16" rx="2" fill="#fb923c" />
      <text x="72" y="72" fill="#0f172a" fontSize="9" fontWeight="700">
        NOMBRE
      </text>
    </g>
  );
}

function Badge({ ok, x, y }: { ok: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="16" cy="16" r="16" fill={ok ? "#059669" : "#e11d48"} />
      {ok ? (
        <path d="M8 16.5 L13 21.5 L24 10" fill="none" stroke="#ecfdf5" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M10 10 L22 22 M22 10 L10 22" fill="none" stroke="#fff1f2" strokeWidth="3.2" strokeLinecap="round" />
      )}
    </g>
  );
}

export default function AvionIllustration({ compact = false }: { compact?: boolean }) {
  const width = compact ? 280 : 360;
  const height = compact ? 340 : 430;
  return (
    <figure className="mx-auto max-w-md">
      <svg
        viewBox="0 0 360 430"
        width={width}
        height={height}
        className="mx-auto h-auto w-full max-w-sm"
        role="img"
        aria-label="Avión de papel tachado no vale. Dos aviones de cascarón, palillos y palos de paleta sí cuentan."
      >
        <defs>
          <linearGradient id="avion-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#164e63" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="430" rx="24" fill="url(#avion-sky)" />

        <rect x="16" y="14" width="328" height="128" rx="16" fill="#1e293b" stroke="#fb7185" strokeWidth="2" />
        <text x="28" y="36" fill="#fda4af" fontSize="13" fontWeight="700">
          No vale — solo papel doblado
        </text>
        <g transform="translate(70 8) scale(1.05)">
          <PaperPlaneInvalid />
        </g>
        <Badge ok={false} x="300" y="22" />

        <rect x="16" y="156" width="328" height="122" rx="16" fill="#052e16" stroke="#34d399" strokeWidth="2" />
        <text x="28" y="178" fill="#6ee7b7" fontSize="13" fontWeight="700">
          Sí cuenta — cascarón, palos y silicón
        </text>
        <g transform="translate(28 168)">
          <BuiltPlaneA />
        </g>
        <Badge ok x="300" y="164" />

        <rect x="16" y="292" width="328" height="122" rx="16" fill="#052e16" stroke="#34d399" strokeWidth="2" />
        <text x="28" y="314" fill="#6ee7b7" fontSize="13" fontWeight="700">
          Sí cuenta — estructura + alas rígidas
        </text>
        <g transform="translate(28 304)">
          <BuiltPlaneB />
        </g>
        <Badge ok x="300" y="300" />
      </svg>
      <figcaption className="mt-2 text-center text-xs text-slate-400">
        Papel doblado = no válido. Cascarón o ilustración, palillos, palos de paleta y silicón frío = sí cuenta.
      </figcaption>
    </figure>
  );
}
