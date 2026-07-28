import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "Users & Permissions — BSM Workforce & Operations" },
      { name: "description", content: "User roles and permissions for BSM Engineering." },
      { property: "og:title", content: "Users & Permissions — BSM Workforce & Operations" },
      { property: "og:description", content: "User roles and permissions for BSM Engineering." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users & Permissions</h1>
        <p className="text-sm text-muted-foreground">Roles, permissions, and access control.</p>
        <EmptyState
          className="mt-6"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="User management"
          description="Users and roles will be implemented in Phase 1 after Supabase is connected."
        />
      </div>
    </AppShell>
  );
}
