import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthValue {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signOut: () => void;
}
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) { setReady(true); return; }
    api.me().then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setReady(true));
  }, [signOut]);

  const value = useMemo<AuthValue>(() => ({
    user, ready, signOut,
    signIn: async (email, password) => { const r = await api.login({ email, password }); tokenStore.set(r.token); setUser(r.user); return r.user; },
    signUp: async (name, email, password) => { const r = await api.register({ name, email, password }); tokenStore.set(r.token); setUser(r.user); return r.user; },
  }), [user, ready, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
