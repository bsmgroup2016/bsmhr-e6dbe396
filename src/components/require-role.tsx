import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export function RequireRole({ path, children }: { path: string; children: ReactNode }) {
  const { roles, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccess(path, roles)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Access restricted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your role does not have permission to view this page. Contact an administrator if you
            need access.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
