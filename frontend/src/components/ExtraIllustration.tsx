export default function ExtraIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "overflow-hidden rounded-2xl border border-white/10" : ""}>
      <svg
        viewBox="0 0 360 420"
        className="h-auto w-full"
        role="img"
        aria-label="Prototipo en papel de una ventana Tkinter"
      >
        <defs>
          <linearGradient id="extra-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="420" rx="24" fill="url(#extra-sky)" />
        <rect x="24" y="28" width="312" height="364" rx="10" fill="#e2e8f0" />
        <rect x="24" y="28" width="312" height="36" rx="10" fill="#0f766e" />
        <rect x="24" y="48" width="312" height="16" fill="#0f766e" />
        <text x="180" y="52" textAnchor="middle" fill="#ecfdf5" fontSize="13" fontWeight="800">
          Plan de Acción · interfaz
        </text>
        <rect x="40" y="80" width="280" height="28" rx="4" fill="#134e4a" />
        <text x="180" y="99" textAnchor="middle" fill="#ccfbf1" fontSize="11" fontWeight="700">
          MiAppTkinter — pantalla principal
        </text>
        <rect x="40" y="122" width="170" height="150" rx="6" fill="#fff7ed" />
        <rect x="52" y="138" width="146" height="18" rx="3" fill="#fdba74" />
        <rect x="52" y="166" width="146" height="28" rx="4" fill="#fff" stroke="#fb923c" />
        <rect x="52" y="206" width="68" height="24" rx="4" fill="#0d9488" />
        <rect x="128" y="206" width="70" height="24" rx="4" fill="#64748b" />
        <text x="125" y="258" textAnchor="middle" fill="#9a3412" fontSize="9" fontWeight="700">
          cajas y botones
        </text>
        <rect x="222" y="122" width="98" height="150" rx="6" fill="#ecfeff" />
        <text x="271" y="146" textAnchor="middle" fill="#155e75" fontSize="9" fontWeight="700">
          CASOS DE USO
        </text>
        <rect x="234" y="158" width="74" height="8" fill="#67e8f9" />
        <rect x="234" y="174" width="74" height="8" fill="#67e8f9" />
        <rect x="234" y="190" width="58" height="8" fill="#67e8f9" />
        <rect x="40" y="286" width="280" height="48" rx="6" fill="#fef3c7" />
        <text x="180" y="306" textAnchor="middle" fill="#78350f" fontSize="10" fontWeight="700">
          Del diagrama a la ventana
        </text>
        <text x="180" y="322" textAnchor="middle" fill="#a16207" fontSize="9">
          3000 Firmas
        </text>
        <rect x="40" y="344" width="132" height="32" rx="4" fill="#dbeafe" />
        <text x="106" y="365" textAnchor="middle" fill="#1e3a8a" fontSize="9" fontWeight="700">
          Requerimientos ✓
        </text>
        <rect x="188" y="344" width="132" height="32" rx="4" fill="#dcfce7" />
        <text x="254" y="365" textAnchor="middle" fill="#14532d" fontSize="9" fontWeight="700">
          Clases / casos ✓
        </text>
      </svg>
    </div>
  );
}
