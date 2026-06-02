import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";

export default function Layout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            SimEvaluación
          </p>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">{user?.displayName}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-12">{children}</main>
    </div>
  );
}
