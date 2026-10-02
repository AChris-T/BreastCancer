"use client";

import type { AuthResponse, AuthUser } from "@breastscan/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, refreshSession, setAccessToken, subscribeSession } from "./api";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  /** Store a session returned by login or email verification. */
  signIn: (session: AuthResponse) => void;
  signOut: () => Promise<void>;
  /** Re-read the user after profile, onboarding or settings changes. */
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();

  const apply = useCallback((session: AuthResponse | null) => {
    setAccessToken(session?.accessToken ?? null);
    setUser(session?.user ?? null);
    setStatus(session ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    subscribeSession(apply);
    void refreshSession().then((session) => apply(session));
  }, [apply]);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      apply(null);
      queryClient.clear();
    }
  }, [apply, queryClient]);

  const reloadUser = useCallback(async () => {
    setUser(await api<AuthUser>("/auth/me"));
  }, []);

  const value = useMemo(() => ({ status, user, signIn: apply, signOut, reloadUser }), [status, user, apply, signOut, reloadUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Where to send a user after sign-in: back where they were going, or the dashboard. */
export function homeFor(next?: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}
