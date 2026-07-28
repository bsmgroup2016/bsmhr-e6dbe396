import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — BSM Workforce & Operations" },
      { name: "description", content: "Payroll runs and payslips for BSM Engineering workers." },
      { property: "og:title", content: "Payroll — BSM Workforce & Operations" },
      { property: "og:description", content: "Payroll runs and payslips for BSM Engineering workers." },
    ],
  }),
  component: PayrollPage,
});

function PayrollPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payroll</h1>
        <p className="text-sm text-muted-foreground">Payroll periods, runs, and payslips.</p>
        <EmptyState
          className="mt-6"
          icon={<Briefcase className="h-5 w-5" />}
          title="Payroll module"
          description="Payroll management will be implemented in Phase 7."
        />
      </div>
    </AppShell>
  );
}
