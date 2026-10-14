export default function ExtraIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "overflow-hidden rounded-2xl border border-white/10" : ""}>
      <svg viewBox="0 0 360 420" className="h-auto w-full" role="img" aria-label="Portada de periódico de ejemplo">
        <defs>
          <linearGradient id="extra-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="420" rx="24" fill="url(#extra-sky)" />
        <rect x="28" y="28" width="304" height="364" rx="8" fill="#f4efe4" />
        <rect x="40" y="40" width="280" height="36" rx="4" fill="#b91c1c" />
        <text x="180" y="65" textAnchor="middle" fill="#fff7ed" fontSize="18" fontWeight="800">
          ¡EXTRA, EXTRA!
        </text>
        <text x="180" y="98" textAnchor="middle" fill="#1c1917" fontSize="13" fontWeight="700">
          LANZAN SU APP TKINTER EN EL PLANTEL
        </text>
        <rect x="40" y="112" width="168" height="130" rx="4" fill="#fb7185" />
        <rect x="52" y="128" width="60" height="44" fill="#fde68a" />
        <rect x="120" y="140" width="72" height="52" fill="#38bdf8" />
        <rect x="64" y="188" width="88" height="36" fill="#86efac" />
        <text x="124" y="248" textAnchor="middle" fill="#7f1d1d" fontSize="10" fontWeight="700">
          collage
        </text>
        <rect x="220" y="112" width="100" height="130" rx="4" fill="#fff" stroke="#d6d3d1" />
        <text x="270" y="138" textAnchor="middle" fill="#44403c" fontSize="9" fontWeight="700">
          CÓMO FUNCIONA
        </text>
        <rect x="232" y="150" width="76" height="8" fill="#a8a29e" />
        <rect x="232" y="166" width="76" height="8" fill="#a8a29e" />
        <rect x="232" y="182" width="58" height="8" fill="#a8a29e" />
        <rect x="40" y="256" width="280" height="58" rx="4" fill="#fef3c7" />
        <text x="180" y="280" textAnchor="middle" fill="#78350f" fontSize="11" fontWeight="700">
          SELLO QA · REVISADO
        </text>
        <text x="180" y="298" textAnchor="middle" fill="#a16207" fontSize="9">
          Créditos del equipo · no se despega
        </text>
        <rect x="40" y="326" width="132" height="48" rx="4" fill="#e0e7ff" />
        <text x="106" y="354" textAnchor="middle" fill="#312e81" fontSize="10" fontWeight="700">
          $5 · edición de hoy
        </text>
        <rect x="184" y="326" width="136" height="48" rx="4" fill="#dcfce7" />
        <text x="252" y="354" textAnchor="middle" fill="#14532d" fontSize="10" fontWeight="700">
          Scrum en 50 min
        </text>
      </svg>
    </div>
  );
}
