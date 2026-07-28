import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

export const Route = createFileRoute("/workforce")({
  head: () => ({
    meta: [
      { title: "Workforce — BSM Workforce & Operations" },
      { name: "description", content: "Manage BSM Engineering employees and worker records." },
      { property: "og:title", content: "Workforce — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage BSM Engineering employees and worker records." },
    ],
  }),
  component: WorkforcePage,
});

function WorkforcePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workforce</h1>
        <p className="text-sm text-muted-foreground">Employee directory and worker management.</p>
        <EmptyState
          className="mt-6"
          icon={<Users className="h-5 w-5" />}
          title="No employees yet"
          description="Employee list will be implemented in Phase 2 once the Supabase backend is connected."
        />
      </div>
    </AppShell>
  );
}
