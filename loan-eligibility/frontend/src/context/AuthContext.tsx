import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthError, MissingIdentityError, getUser, handleAuthCallback, login, logout, onAuthChange, signup, type User as IdentityUser } from "@netlify/identity";
import type { User } from "@/lib/types";

interface AuthValue {
  user: User | null;
  ready: boolean;
  authError: string;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthValue | null>(null);

function profile(user: IdentityUser): User {
  return {
    id: user.id,
    name: user.name || user.email?.split("@")[0] || "Applicant",
    email: user.email || "",
    role: user.roles?.includes("admin") ? "admin" : "applicant",
  };
}

export function authMessage(error: unknown): string {
  if (error instanceof MissingIdentityError) return "Sign-in is temporarily unavailable. Please try again shortly.";
  if (error instanceof AuthError) {
    if (error.message.toLowerCase().includes("confirm")) return "Please confirm your email using the link in your inbox before signing in.";
    if (error.status === 400 || error.status === 401) return "Invalid email or password. Please try again.";
    return error.message;
  }
  return "Unable to connect to sign-in. Check your connection and try again.";
}

// Share callback processing across StrictMode mounts: confirmation links are single-use.
let initialization: Promise<IdentityUser | null> | undefined;
function restoreSession() {
  return initialization ??= (async () => {
    await handleAuthCallback();
    return getUser();
  })();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((_event, next) => {
      if (active) setUser(next ? profile(next) : null);
    });
    restoreSession()
      .then((next) => { if (active) setUser(next ? profile(next) : null); })
      .catch((error: unknown) => { if (active) setAuthError(authMessage(error)); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user, ready, authError, signOut,
    signIn: async (email, password) => {
      setAuthError("");
      const next = profile(await login(email.trim(), password));
      setUser(next);
      return next;
    },
    signUp: async (name, email, password) => {
      setAuthError("");
      const next = await signup(email.trim(), password, { full_name: name.trim() });
      if (!next.confirmedAt) return null;
      const account = profile(next);
      setUser(account);
      return account;
    },
  }), [user, ready, authError, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
