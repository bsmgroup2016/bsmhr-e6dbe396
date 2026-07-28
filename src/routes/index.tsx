import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users,
  Building2,
  FolderKanban,
  Clock,
  CalendarClock,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — BSM Workforce & Operations" },
      { name: "description", content: "BSM Engineering operations dashboard." },
      { property: "og:title", content: "Dashboard — BSM Workforce & Operations" },
      { property: "og:description", content: "BSM Engineering operations dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of workforce, sites, and operations for BSM Engineering.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Employees"
            value="248"
            icon={<Users className="h-5 w-5" />}
            variant="primary"
            caption="Active workers"
            trend={{ value: "4.2%", positive: true }}
          />
          <SummaryCard
            title="Active Sites"
            value="12"
            icon={<Building2 className="h-5 w-5" />}
            variant="info"
            caption="Across 6 projects"
          />
          <SummaryCard
            title="Projects"
            value="8"
            icon={<FolderKanban className="h-5 w-5" />}
            variant="success"
            caption="3 recruiting"
          />
          <SummaryCard
            title="Pending Approval"
            value="18"
            icon={<Clock className="h-5 w-5" />}
            variant="warning"
            caption="Timesheets"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Register employee</p>
                  <p className="text-xs text-muted-foreground">Add a new worker to the system.</p>
                </div>
              </button>
              <button className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Site attendance</p>
                  <p className="text-xs text-muted-foreground">Record daily attendance by site.</p>
                </div>
              </button>
              <button className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Create assignment</p>
                  <p className="text-xs text-muted-foreground">Deploy workers to a project site.</p>
                </div>
              </button>
              <button className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Expiring documents</p>
                  <p className="text-xs text-muted-foreground">Review work permits and passes.</p>
                </div>
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Status</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">System</span>
                <StatusBadge variant="success" label="Operational" dot />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payroll period</span>
                <StatusBadge variant="primary" label="Jul 2026" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Attendance lock</span>
                <StatusBadge variant="warning" label="Pending" dot />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
          <EmptyState
            className="mt-4 bg-transparent border-0"
            icon={<CalendarClock className="h-5 w-5" />}
            title="No recent activity"
            description="Once you start managing assignments and attendance, recent actions will appear here."
          />
        </div>
      </div>
    </AppShell>
  );
}
