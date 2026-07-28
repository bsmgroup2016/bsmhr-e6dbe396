import { createFileRoute, Link } from "@tanstack/react-router";

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
  FileText,
} from "lucide-react";
import { getEmployees, getSites, getProjects, getApprovals, getDocuments, getAuditLogs } from "@/lib/store";

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
  const employees = getEmployees();
  const sites = getSites();
  const projects = getProjects();
  const approvals = getApprovals();
  const documents = getDocuments();
  const logs = getAuditLogs().slice(0, 10);

  const activeEmployees = employees.filter((e) => e.status === "Active" || e.status === "Deployed").length;
  const deployedEmployees = employees.filter((e) => e.status === "Deployed").length;
  const activeSites = sites.filter((s) => s.status === "Active").length;
  const activeProjects = projects.filter((p) => p.status === "Active").length;
  const pendingApprovals = approvals.filter((a) => a.status === "Pending").length;
  const expiringDocs = documents.filter((d) => d.status === "Expiring Soon" || d.status === "Expired").length;

  const quickActions = [
    { to: "/workforce", icon: Users, label: "Register employee", desc: "Add a new worker to the system.", color: "primary" },
    { to: "/time-management", icon: CalendarClock, label: "Site attendance", desc: "Record daily attendance by site.", color: "success" },
    { to: "/operations", icon: FolderKanban, label: "Create assignment", desc: "Deploy workers to a project site.", color: "info" },
    { to: "/documents", icon: FileText, label: "Expiring documents", desc: "Review work permits and passes.", color: "warning" },
  ] as const;

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
            value={employees.length.toString()}
            icon={<Users className="h-5 w-5" />}
            variant="primary"
            caption={`${activeEmployees} active · ${deployedEmployees} deployed`}
          />
          <SummaryCard
            title="Active Sites"
            value={activeSites.toString()}
            icon={<Building2 className="h-5 w-5" />}
            variant="info"
            caption={`Across ${projects.length} projects`}
          />
          <SummaryCard
            title="Active Projects"
            value={activeProjects.toString()}
            icon={<FolderKanban className="h-5 w-5" />}
            variant="success"
            caption={`${projects.filter((p) => p.status === "Planning").length} planning`}
          />
          <SummaryCard
            title="Pending Approval"
            value={pendingApprovals.toString()}
            icon={<Clock className="h-5 w-5" />}
            variant="warning"
            caption={`${expiringDocs} docs need attention`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => {
                const colorClass = {
                  primary: "bg-primary/10 text-primary",
                  success: "bg-success/10 text-success",
                  info: "bg-info/10 text-info",
                  warning: "bg-warning/10 text-warning",
                }[action.color];
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${colorClass}`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                  </Link>
                );
              })}
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expiring docs</span>
                <StatusBadge variant={expiringDocs > 0 ? "warning" : "success"} label={expiringDocs > 0 ? `${expiringDocs} alert` : "OK"} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
          {logs.length === 0 ? (
            <EmptyState
              className="mt-4 bg-transparent border-0"
              icon={<CalendarClock className="h-5 w-5" />}
              title="No recent activity"
              description="Once you start managing assignments and attendance, recent actions will appear here."
            />
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">User</th>
                    <th className="px-4 py-2 text-left font-medium">Action</th>
                    <th className="px-4 py-2 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-4 py-2 text-muted-foreground">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-2 font-medium">{l.userName}</td>
                      <td className="px-4 py-2">{l.action} {l.entityType}</td>
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-xs">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
