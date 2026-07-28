import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Layers } from "lucide-react";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "Operations — BSM Workforce & Operations" },
      { name: "description", content: "BSM Engineering daily operations and deployments." },
      { property: "og:title", content: "Operations — BSM Workforce & Operations" },
      { property: "og:description", content: "BSM Engineering daily operations and deployments." },
    ],
  }),
  component: OperationsPage,
});

function OperationsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operations</h1>
        <p className="text-sm text-muted-foreground">Daily deployment and worker transfers.</p>
        <EmptyState
          className="mt-6"
          icon={<Layers className="h-5 w-5" />}
          title="Operations module"
          description="Operations workflows will be implemented in Phase 4."
        />
      </div>
    </AppShell>
  );
}
