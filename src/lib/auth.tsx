import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionStore } from "@/lib/store";
import type { User, Session } from "@supabase/supabase-js";

import type { AppAuthRole } from "@/lib/permissions";

type AppRole = AppAuthRole;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) {
      console.error("Failed to fetch roles:", error);
      setRoles([]);
      return;
    }
    setRoles((data?.map((r) => r.role as AppRole) ?? []).filter(Boolean));
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted) return;
      if (error) console.error("getSession error:", error);
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchRoles(initialSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        if (event === "SIGNED_IN" && newSession.access_token) {
          void import("@/lib/user-admin").then((m) => m.recordLogin());
        }
        await fetchRoles(newSession.user.id);
      } else {
        clearSessionStore();
        setRoles([]);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
