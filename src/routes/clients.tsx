import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients — BSM Workforce & Operations" },
      { name: "description", content: "Manage BSM Engineering client companies." },
      { property: "og:title", content: "Clients — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage BSM Engineering client companies." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground">Client companies and contracts.</p>
        <EmptyState
          className="mt-6"
          icon={<Building2 className="h-5 w-5" />}
          title="No clients yet"
          description="Client management will be implemented in Phase 4."
        />
      </div>
    </AppShell>
  );
}
