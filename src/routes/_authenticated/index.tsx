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
  ShieldAlert,
} from "lucide-react";
import {
  getEmployees,
  getSites,
  getProjects,
  getApprovals,
  getDocuments,
  getAuditLogs,
  getAttendance,
  getCompanies,
  getCurrentCompany,
} from "@/lib/store";

export const Route = createFileRoute("/_authenticated/")({
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
  const companyId = getCurrentCompany();
  const company = getCompanies().find((c) => c.id === companyId);
  const allEmployees = getEmployees();
  const employees = companyId
    ? allEmployees.filter((e) => !e.companyId || e.companyId === companyId)
    : allEmployees;
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

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const presentToday = getAttendance().filter(
    (a) => a.date === todayKey && (a.status === "Present" || a.status === "Overtime"),
  ).length;

  const daysLeft = (iso: string) =>
    Math.ceil((new Date(iso).getTime() - today.getTime()) / 86_400_000);

  const expiringPasses = employees
    .filter((e) => e.passExpiry && e.passExpiry !== "-" && daysLeft(e.passExpiry) <= 60)
    .map((e) => ({ ...e, days: daysLeft(e.passExpiry) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const quickActions = [
    { to: "/workforce", icon: Users, label: "Register employee", desc: "Add a new worker to the system.", color: "primary" },
    { to: "/time-management", icon: CalendarClock, label: "Site attendance", desc: "Record daily attendance by site.", color: "success" },
    { to: "/operations", icon: FolderKanban, label: "Create assignment", desc: "Deploy workers to a project site.", color: "info" },
    { to: "/documents", icon: FileText, label: "Expiring documents", desc: "Review work permits and passes.", color: "warning" },
  ] as const;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 shadow-elegant sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex flex-col gap-2">
            <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
              BSM Engineering · Singapore
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {company ? company.name : "Dashboard"}
            </h1>
            <p className="max-w-xl text-sm text-white/75">
              Overview of workforce, sites, and operations across all active projects.
            </p>
          </div>
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
            caption={`${expiringDocs} docs · ${presentToday} present today`}
          />
        </div>

        <div className="rounded-xl border bg-gradient-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <h2 className="text-base font-semibold text-foreground">Pass expiry alerts</h2>
            <span className="ml-auto text-xs text-muted-foreground">Next 60 days</span>
          </div>
          {expiringPasses.length === 0 ? (
            <EmptyState
              className="mt-4 border-0 bg-transparent"
              icon={<AlertCircle className="h-5 w-5" />}
              title="No passes expiring soon"
              description="All work permits and passes are valid for more than 60 days."
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {expiringPasses.map((e) => (
                <Link
                  key={e.id}
                  to="/workforce"
                  className="rounded-lg border bg-card/60 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-elegant"
                >
                  <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.passType} · {e.employeeCode}
                  </p>
                  <div className="mt-2">
                    <StatusBadge
                      variant={e.days < 0 ? "destructive" : e.days <= 30 ? "warning" : "info"}
                      label={
                        e.days < 0
                          ? `Expired ${Math.abs(e.days)}d ago`
                          : `${e.days}d left · ${e.passExpiry}`
                      }
                      dot
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-gradient-surface p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => {
                const colorClass = {
                  primary: "bg-gradient-primary text-primary-foreground",
                  success: "bg-gradient-success text-success-foreground",
                  info: "bg-gradient-info text-info-foreground",
                  warning: "bg-gradient-warning text-warning-foreground",
                }[action.color];
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="flex items-center gap-3 rounded-lg border bg-card/60 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elegant"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${colorClass}`}>
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

          <div className="rounded-xl border bg-gradient-surface p-5 shadow-sm">
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

        <div className="rounded-xl border bg-gradient-surface p-5 shadow-sm">
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
