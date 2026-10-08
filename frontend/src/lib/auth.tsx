import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { refreshAuthSession, setAuthToken } from "./api";
import type { User } from "./types";

const STORAGE_KEY = "simeval_auth";

type AuthState = {
  token: string;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  login: (state: AuthState) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const stored = loadStored();
    setAuthToken(stored?.token ?? null);
    return stored;
  });

  useEffect(() => {
    setAuthToken(auth?.token ?? null);
  }, [auth]);

  const isLoggedIn = Boolean(auth?.token);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    async function renew() {
      try {
        const next = await refreshAuthSession();
        if (cancelled) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setAuthToken(next.token);
      } catch {
        /* si falla, se sigue con el token actual */
      }
    }
    void renew();
    const id = window.setInterval(() => void renew(), 6 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLoggedIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      login: (state) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setAuth(state);
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setAuth(null);
      },
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
