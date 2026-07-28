import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — BSM Workforce & Operations" },
      { name: "description", content: "Operational reports for BSM Engineering." },
      { property: "og:title", content: "Reports — BSM Workforce & Operations" },
      { property: "og:description", content: "Operational reports for BSM Engineering." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Workforce, attendance, and payroll reports.</p>
        <EmptyState
          className="mt-6"
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports module"
          description="Reporting will be implemented in Phase 8."
        />
      </div>
    </AppShell>
  );
}
