import type { ReactNode } from "react";
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
import { Target, PhoneCall, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
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
  getLeads,
  getActivities,
  getClients,
  crmPipeline,
  dueFollowUps,
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

function SectionHeading({
  title,
  caption,
  icon,
}: {
  title: string;
  caption?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      {caption ? <span className="ml-auto text-xs text-muted-foreground">{caption}</span> : null}
    </div>
  );
}

function DashboardPage() {
  const companyId = getCurrentCompany();
  const { roles } = useAuth();
  const showCrm = canAccess("/clients", roles);
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
    (a) => a.date === todayKey && (a.status === "Present" || a.status === "Half Day"),
  ).length;

  const daysLeft = (iso: string) =>
    Math.ceil((new Date(iso).getTime() - today.getTime()) / 86_400_000);

  // CRM overview
  const leads = getLeads().filter((l) => !companyId || !l.companyId || l.companyId === companyId);
  const pipeline = crmPipeline(companyId ?? undefined).filter(
    (p) => p.stage !== "Won" && p.stage !== "Lost",
  );
  const openLeads = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const wonLeads = leads.filter((l) => l.stage === "Won");
  const pipelineValue = openLeads.reduce((s, l) => s + (l.monthlyValue || 0), 0);
  const weightedValue = pipeline.reduce((s, p) => s + p.weighted, 0);
  const maxStageCount = Math.max(1, ...pipeline.map((p) => p.count));
  const followUpsDue = dueFollowUps(companyId ?? undefined).length;
  // Open follow-up reminders (due, overdue and upcoming), soonest first
  const followUpCards = getActivities()
    .filter(
      (a) =>
        !a.done &&
        a.followUpDate &&
        (!companyId || !a.companyId || a.companyId === companyId),
    )
    .map((a) => ({
      ...a,
      days: Math.ceil(
        (new Date(`${a.followUpDate}T00:00:00`).getTime() -
          new Date(`${todayKey}T00:00:00`).getTime()) /
          86_400_000,
      ),
    }))
    .sort((a, b) => a.days - b.days || a.subject.localeCompare(b.subject))
    .slice(0, 8);
  const overdueCount = followUpCards.filter((f) => f.days < 0).length;
  const followUpBadge = (days: number) =>
    days < 0
      ? { variant: "destructive" as const, label: `Overdue ${Math.abs(days)}d` }
      : days === 0
        ? { variant: "warning" as const, label: "Due today" }
        : days <= 3
          ? { variant: "info" as const, label: `In ${days}d` }
          : { variant: "outline" as const, label: `In ${days}d` };
  const activeClients = getClients().filter((c) => c.status === "Active").length;
  const clientNames = new Map(getClients().map((c) => [c.id, c.name]));
  const leadNames = new Map(leads.map((l) => [l.id, l.companyName]));
  const recentActivities = getActivities()
    .filter((a) => !companyId || !a.companyId || a.companyId === companyId)
    .slice()
    .sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1))
    .slice(0, 6);
  const money = (n: number) =>
    `S$${Math.round(n).toLocaleString("en-SG")}`;

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
      <div className="mx-auto max-w-7xl space-y-8">
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

        {/* 1. Key numbers */}
        <section className="space-y-3">
          <SectionHeading title="Overview" caption="Live figures for the selected company" />
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
        </section>

        {/* 2. Act now — quick actions */}
        <section className="space-y-3">
          <SectionHeading title="Quick actions" caption="Most used day-to-day tasks" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  className="flex items-center gap-3 rounded-xl border bg-gradient-surface p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elegant"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm ${colorClass}`}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 3. Attention needed — pass expiry */}
        {showCrm ? (
          <section className="space-y-3">
            <SectionHeading
              title="CRM overview"
              caption="Lead pipeline & recent client activity"
              icon={<Target className="h-4 w-4 text-primary" />}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Open Leads"
                value={openLeads.length.toString()}
                icon={<Target className="h-5 w-5" />}
                variant="primary"
                caption={`${wonLeads.length} won · ${leads.length} total`}
              />
              <SummaryCard
                title="Pipeline Value"
                value={money(pipelineValue)}
                icon={<TrendingUp className="h-5 w-5" />}
                variant="info"
                caption={`${money(weightedValue)} weighted / month`}
              />
              <SummaryCard
                title="Active Clients"
                value={activeClients.toString()}
                icon={<Building2 className="h-5 w-5" />}
                variant="success"
                caption="Currently engaged accounts"
              />
              <SummaryCard
                title="Follow-ups Due"
                value={followUpsDue.toString()}
                icon={<PhoneCall className="h-5 w-5" />}
                variant="warning"
                caption={`${overdueCount} overdue · today or earlier`}
              />
            </div>

            {followUpCards.length > 0 ? (
              <div className="space-y-3">
                <SectionHeading
                  title="Follow-up reminders"
                  caption="Soonest first"
                  icon={<PhoneCall className="h-4 w-4 text-warning" />}
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {followUpCards.map((f) => {
                    const badge = followUpBadge(f.days);
                    return (
                      <Link
                        key={f.id}
                        to="/clients"
                        className="rounded-xl border bg-gradient-surface p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-elegant"
                      >
                        <p className="truncate text-sm font-medium text-foreground">{f.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {f.activityType} ·{" "}
                          {(f.clientId && clientNames.get(f.clientId)) ||
                            (f.leadId && leadNames.get(f.leadId)) ||
                            "—"}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <StatusBadge variant={badge.variant} label={badge.label} dot />
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {f.followUpDate}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-gradient-surface p-5 shadow-sm lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Lead pipeline</p>
                  <Link to="/clients" className="text-xs text-primary hover:underline">
                    Open CRM
                  </Link>
                </div>
                {openLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No open leads yet. Add a lead to start tracking your pipeline.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pipeline.map((p) => (
                      <div key={p.stage} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                          {p.stage}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-primary transition-all duration-500"
                            style={{ width: `${(p.count / maxStageCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-medium text-foreground">
                          {p.count}
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                          {money(p.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-gradient-surface p-5 shadow-sm">
                <p className="mb-4 text-sm font-medium text-foreground">Recent activity</p>
                {recentActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No calls, meetings or emails logged yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {recentActivities.map((a) => (
                      <li key={a.id} className="flex items-start gap-3">
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <PhoneCall className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{a.subject}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.activityType} ·{" "}
                            {(a.clientId && clientNames.get(a.clientId)) ||
                              (a.leadId && leadNames.get(a.leadId)) ||
                              "—"}{" "}
                            · {a.activityDate}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionHeading
            title="Pass expiry alerts"
            caption="Next 60 days"
            icon={<ShieldAlert className="h-4 w-4 text-warning" />}
          />
          {expiringPasses.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="h-5 w-5" />}
              title="No passes expiring soon"
              description="All work permits and passes are valid for more than 60 days."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {expiringPasses.map((e) => (
                <Link
                  key={e.id}
                  to="/workforce"
                  className="rounded-xl border bg-gradient-surface p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-elegant"
                >
                  <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.passType} · {e.employeeCode}
                  </p>
                  <div className="mt-3">
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
        </section>

        {/* 4. History + system status */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <SectionHeading title="Recent activity" caption="Latest 10 actions" />
            {logs.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-5 w-5" />}
                title="No recent activity"
                description="Once you start managing assignments and attendance, recent actions will appear here."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
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
                        <td className="max-w-xs truncate px-4 py-2 text-muted-foreground">{l.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <SectionHeading title="Status" />
            <div className="space-y-3 rounded-xl border bg-gradient-surface p-5 shadow-sm">
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
                <StatusBadge
                  variant={expiringDocs > 0 ? "warning" : "success"}
                  label={expiringDocs > 0 ? `${expiringDocs} alert` : "OK"}
                />
              </div>
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  );
}
