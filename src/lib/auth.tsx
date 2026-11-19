import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type Context,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { loginEmail } from "@/core/worker-login";
import { clearSessionStore } from "@/lib/store";
import { readAccountRoles } from "@/lib/account-permissions";
import type { User, Session } from "@supabase/supabase-js";

import type { AppAuthRole } from "@/lib/permissions";

type AppRole = AppAuthRole;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  roleError: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

// Keep the context itself stable across hot updates. A reload callback runs
// too late: updated consumers can render against the old mounted provider first.
const AuthContext: Context<AuthContextValue | undefined> =
  import.meta.hot?.data.authContext ?? createContext<AuthContextValue | undefined>(undefined);
if (import.meta.hot) import.meta.hot.data.authContext = AuthContext;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);

  const fetchRoles = useCallback(async (userId: string) => {
    try {
      const verified = await readAccountRoles(userId);
      if (activeUserId.current !== userId) return;
      setRoles(verified);
      setRoleError(null);
    } catch {
      if (activeUserId.current !== userId) return;
      setRoles([]);
      setRoleError("Could not verify account permissions. Please try again.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted) return;
      if (error) console.error("getSession error:", error);
      activeUserId.current = initialSession?.user.id ?? null;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchRoles(initialSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (activeUserId.current !== (newSession?.user.id ?? null)) {
        setRoles([]);
        setRoleError(null);
      }
      activeUserId.current = newSession?.user.id ?? null;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        if (event === "SIGNED_IN" && newSession.access_token) {
          void import("@/lib/user-admin").then((m) => m.recordLogin());
        }
        // Auth callbacks run under the client's session lock. Defer queries
        // so refresh/sign-in cannot deadlock requests waiting for that lock.
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          window.setTimeout(() => { if (mounted) void fetchRoles(newSession.user.id); }, 0);
        }
      } else {
        clearSessionStore();
        setRoles([]);
        setRoleError(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(email), password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: phone ?? "" },
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    clearSessionStore();
    await supabase.auth.signOut();
  }, []);

  const refreshRoles = useCallback(async () => {
    if (user?.id) await fetchRoles(user.id);
  }, [fetchRoles, user?.id]);

  const value: AuthContextValue = {
    user,
    session,
    roles,
    roleError,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("admin") || roles.includes("manager") || roles.includes("hr"),
    isSupervisor:
      roles.includes("admin") ||
      roles.includes("manager") ||
      roles.includes("hr") ||
      roles.includes("supervisor"),
    signIn,
    signUp,
    signOut,
    refreshRoles,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
