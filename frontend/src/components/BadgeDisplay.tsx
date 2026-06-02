const BADGES = {
  gold: { label: "Campeón", emoji: "🥇", className: "glow-gold bg-yellow-500/20 text-yellow-200 border-yellow-400/40" },
  silver: { label: "Plata", emoji: "🥈", className: "bg-slate-400/20 text-slate-100 border-slate-300/40" },
  bronze: { label: "Bronce", emoji: "🥉", className: "bg-orange-500/20 text-orange-100 border-orange-400/40" },
  top10: { label: "Top 10", emoji: "⭐", className: "glow-cyan bg-cyan-500/20 text-cyan-100 border-cyan-400/40" },
} as const;

export default function BadgeDisplay({ badge }: { badge: keyof typeof BADGES | null }) {
  if (!badge) {
    return (
      <div className="glass flex items-center gap-3 px-4 py-3">
        <span className="text-2xl">🎯</span>
        <div>
          <p className="text-sm font-semibold text-slate-200">Sigue participando</p>
          <p className="text-xs text-slate-400">Cada actividad suma puntos al ranking</p>
        </div>
      </div>
    );
  }

  const info = BADGES[badge];
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${info.className}`}>
      <span className="text-3xl">{info.emoji}</span>
      <div>
        <p className="text-sm font-bold">{info.label}</p>
        <p className="text-xs opacity-80">Insignia desbloqueada</p>
      </div>
    </div>
  );
}
