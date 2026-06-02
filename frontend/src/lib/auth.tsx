import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAuthToken } from "./api";
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
  const [auth, setAuth] = useState<AuthState | null>(() => loadStored());

  useEffect(() => {
    setAuthToken(auth?.token ?? null);
  }, [auth]);

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
