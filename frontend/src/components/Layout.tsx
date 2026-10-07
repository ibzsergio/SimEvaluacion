import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import ThemeToggle from "./ThemeToggle";

export default function Layout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:px-4 sm:py-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80 sm:text-xs sm:tracking-[0.2em]">
            SimEvaluación
          </p>
          <h1 className="text-lg font-bold leading-tight text-white sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs leading-snug text-slate-400 sm:text-sm">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="sm:hidden">
            <ThemeToggle compact />
          </div>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">{user?.displayName}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 sm:px-4 sm:text-sm"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-3 pb-10 sm:px-4 sm:pb-12 lg:flex lg:min-h-0 lg:flex-col lg:pb-4">{children}</main>
      {footer ? (
        <footer className="mx-auto w-full max-w-6xl border-t border-white/5 px-3 py-5 text-center sm:px-4 sm:py-6">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
