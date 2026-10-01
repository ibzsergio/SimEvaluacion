import { useTheme } from "../lib/theme";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Modo claro" : "Modo oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`no-print inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-medium text-slate-200 transition hover:bg-white/10 ${
        compact ? "h-10 w-10 px-0" : "px-3 py-2 text-sm"
      }`}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M6.2 6.2 5.1 5.1M18.9 18.9l-1.1-1.1M6.2 17.8 5.1 18.9M18.9 5.1l-1.1 1.1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
          <path d="M18 14.5A7.5 7.5 0 0 1 9.5 6 6.5 6.5 0 1 0 18 14.5Z" />
        </svg>
      )}
      {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </button>
  );
}
