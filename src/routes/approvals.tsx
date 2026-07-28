import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — BSM Workforce & Operations" },
      { name: "description", content: "Approval workflows for BSM Engineering." },
      { property: "og:title", content: "Approvals — BSM Workforce & Operations" },
      { property: "og:description", content: "Approval workflows for BSM Engineering." },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground">Pending and completed approvals.</p>
        <EmptyState
          className="mt-6"
          icon={<ClipboardList className="h-5 w-5" />}
          title="Approval module"
          description="Approval workflows will be implemented in Phase 8."
        />
      </div>
    </AppShell>
  );
}
