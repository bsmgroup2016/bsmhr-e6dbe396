import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { hydrateStore, subscribe, getCurrentCompany, invalidateStoreTable } from "@/lib/store";
import { RequireRole } from "@/components/require-role";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canAccess, hasAssignedRole } from "@/core/access";
import { WelcomeDashboard } from "@/components/role-dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (roleError) throw new Error("Could not verify account permissions.");
    const roles = (roleRows ?? []).map((row) => String(row.role));
    if (!canAccess(location.pathname, roles)) throw redirect({ to: "/dashboard" });
    return { user: data.user, roles };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { roles, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [, force] = useState(0);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const companyId = getCurrentCompany();

  useEffect(() => {
    if (isLoading || !hasAssignedRole(roles) || !canAccess(pathname, roles)) return;
    let alive = true;
    setReady(false);
    setError(null);
    hydrateStore(pathname)
      .then(() => alive && setReady(true))
      .catch((e: Error) => alive && setError(e.message));
    const unsub = subscribe(() => force((n) => n + 1));
    return () => {
      alive = false;
      unsub();
    };
  }, [isLoading, roles.join(","), pathname, companyId, retry]);

  useEffect(() => {
    const written = (event: Event) => {
      const table = String((event as CustomEvent).detail);
      invalidateStoreTable(table);
      void queryClient.invalidateQueries({ predicate: (query) => ["history", "history-summary"].includes(String(query.queryKey[0])) && (query.queryKey[2] === table || table === "employees" || table === "assets" && query.queryKey[2] === "asset_issuances") });
    };
    window.addEventListener("bsm:data-write", written);
    return () => window.removeEventListener("bsm:data-write", written);
  }, [queryClient]);

  useEffect(() => { queryClient.removeQueries({ predicate: (query) => ["history", "history-summary"].includes(String(query.queryKey[0])) && query.queryKey[1] !== user?.id }); }, [queryClient, user?.id]);

  if (!isLoading && !hasAssignedRole(roles)) return <WelcomeDashboard />;
  if (!isLoading && !canAccess(pathname, roles)) return <RequireRole path={pathname}><Outlet /></RequireRole>;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm font-medium text-destructive">Could not load data</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading records…</span>
      </div>
    );
  }

  return (
    <RequireRole path={pathname}>
      <Outlet />
    </RequireRole>
  );
}
