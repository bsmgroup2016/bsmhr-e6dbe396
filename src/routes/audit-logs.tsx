import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";

export const Route = createFileRoute("/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — BSM Workforce & Operations" },
      { name: "description", content: "Audit history and activity logs for BSM Engineering." },
      { property: "og:title", content: "Audit Logs — BSM Workforce & Operations" },
      { property: "og:description", content: "Audit history and activity logs for BSM Engineering." },
    ],
  }),
  component: AuditLogsPage,
});

function AuditLogsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Activity history and audit trails.</p>
        <EmptyState
          className="mt-6"
          icon={<History className="h-5 w-5" />}
          title="Audit logs"
          description="Audit logging will be implemented in Phase 8."
        />
      </div>
    </AppShell>
  );
}
