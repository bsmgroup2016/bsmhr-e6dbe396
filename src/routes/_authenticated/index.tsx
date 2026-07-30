import type { ReactNode } from "react";
import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { SummaryCard, type SummaryBadge } from "@/components/ui/summary-card";

function urgencyTone(days: number | null): SummaryBadge["tone"] {
  if (days === null) return "neutral";
  if (days <= 7) return "critical";
  if (days <= 15) return "warning";
  if (days <= 30) return "info";
  return "neutral";
}
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
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
  BadgeCheck,
  CalendarX2,
  DollarSign,
  HeartPulse,
  Landmark,
  Palmtree,
  UserCheck,
  Briefcase,
  CheckCircle2,
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
  getLeaveRequests,
  getCertifications,
  getPayroll,
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
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {caption ? <span className="ml-auto text-sm text-muted-foreground">{caption}</span> : null}
    </div>
  );
}

function WorkPermitIdIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="8" width="22" height="17" rx="3.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 8V6.8C12 5.8 12.8 5 13.8 5h4.4c1 0 1.8.8 1.8 1.8V8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12.5" cy="15.2" r="2.6" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8.9 21c.7-2.2 2-3.3 3.6-3.3s2.9 1.1 3.6 3.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M19 14h5.2M19 18h4.2M19 22h5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.8 11h18.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

function PassportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M10 4.5h11.5A4.5 4.5 0 0 1 26 9v14a4.5 4.5 0 0 1-4.5 4.5H10A4 4 0 0 1 6 23.5v-15a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2.2" />
      <path d="M10.5 5v22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
      <circle cx="17.5" cy="15.2" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.7 15.2h7.6M17.5 11.2c1.2 1.4 1.8 2.7 1.8 4s-.6 2.6-1.8 4c-1.2-1.4-1.8-2.7-1.8-4s.6-2.6 1.8-4Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 22h7M14 24.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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

  // ---- Key operational metrics (each card links to its page) ----
  const monthKey = todayKey.slice(0, 7);
  const yearKey = todayKey.slice(0, 4);
  const empIds = new Set(employees.map((e) => e.id));

  const wpExpiring = employees.filter(
    (e) =>
      (e.passType === "Work Permit" || e.passType === "S Pass" || e.passType === "Employment Pass") &&
      e.passExpiry &&
      e.passExpiry !== "-" &&
      daysLeft(e.passExpiry) >= 0 &&
      daysLeft(e.passExpiry) <= 60,
  );
  const wpExpiring30 = wpExpiring.filter((e) => daysLeft(e.passExpiry) <= 30).length;
  const wpExpiring15 = wpExpiring.filter((e) => daysLeft(e.passExpiry) <= 15).length;
  const wpExpiring7 = wpExpiring.filter((e) => daysLeft(e.passExpiry) <= 7).length;
  const wpSoonestDays = wpExpiring.length
    ? Math.min(...wpExpiring.map((e) => daysLeft(e.passExpiry)))
    : null;

  const passportExpiring = employees.filter(
    (e) =>
      e.passportExpiry &&
      e.passportExpiry !== "-" &&
      daysLeft(e.passportExpiry) >= 0 &&
      daysLeft(e.passportExpiry) <= 90,
  );
  const passportExpiring30 = passportExpiring.filter((e) => daysLeft(e.passportExpiry!) <= 30).length;
  const passportExpiring15 = passportExpiring.filter((e) => daysLeft(e.passportExpiry!) <= 15).length;
  const passportExpiring7 = passportExpiring.filter((e) => daysLeft(e.passportExpiry!) <= 7).length;
  const passportSoonestDays = passportExpiring.length
    ? Math.min(...passportExpiring.map((e) => daysLeft(e.passportExpiry!)))
    : null;

  const leaves = getLeaveRequests().filter(
    (l) =>
      empIds.has(l.employeeId) &&
      l.status === "Approved" &&
      l.startDate <= todayKey &&
      l.endDate >= todayKey,
  );
  const onMedicalLeave = leaves.filter(
    (l) => l.type === "Medical Leave" || l.type === "Hospitalisation Leave",
  );
  const onNormalLeave = leaves.filter(
    (l) => l.type !== "Medical Leave" && l.type !== "Hospitalisation Leave",
  );
  const onLeaveIds = new Set(leaves.map((l) => l.employeeId));

  const csocValid = getCertifications().filter((c) => {
    if (!empIds.has(c.employeeId)) return false;
    const name = c.courseName.toLowerCase();
    const isCsoc =
      name.includes("csoc") || name.includes("safety orientation") || name.includes("safety course");
    if (!isCsoc) return false;
    return !c.expiryDate || daysLeft(c.expiryDate) >= 0;
  });
  const csocWorkers = new Set(csocValid.map((c) => c.employeeId)).size;

  const todayAttendance = getAttendance().filter((a) => a.date === todayKey && empIds.has(a.employeeId));
  const absentToday = todayAttendance.filter((a) => a.status === "Absent").length;
  const mcAttendanceToday = todayAttendance.filter((a) => a.status === "MC").length;
  const medicalLeaveCount = Math.max(onMedicalLeave.length, mcAttendanceToday);

  const availableWorkers = employees.filter(
    (e) =>
      (e.status === "Active" || e.status === "Deployed") &&
      !onLeaveIds.has(e.id) &&
      !todayAttendance.some((a) => a.employeeId === e.id && a.status === "Absent"),
  ).length;

  const runningProjects = projects.filter((p) => p.status === "Active");
  const endingProjects = runningProjects.filter(
    (p) => p.endDate && daysLeft(p.endDate) >= 0 && daysLeft(p.endDate) <= 30,
  );
  const clientsAll = getClients();
  const activeClientCount = clientsAll.filter((c) => c.status === "Active").length;

  const payrollAll = getPayroll().filter((p) => empIds.has(p.employeeId));
  const paidThisMonth = payrollAll.filter((p) => p.month === monthKey && p.status === "Paid");
  const salaryPaidMonth = paidThisMonth.reduce((s, p) => s + p.netPay, 0);
  const annualWages = payrollAll
    .filter((p) => p.month.startsWith(yearKey))
    .reduce((s, p) => s + p.basicSalary + p.overtimePay + p.allowances, 0);

  const sgd = (n: number) => `S$${Math.round(n).toLocaleString("en-SG")}`;

  // ---- Chart data ----
  const allAttendance = getAttendance().filter((a) => empIds.has(a.employeeId));
  const wageTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rows = payrollAll.filter((p) => p.month === key);
    return {
      month: d.toLocaleDateString("en-SG", { month: "short" }),
      gross: rows.reduce((s, p) => s + p.basicSalary + p.overtimePay + p.allowances, 0),
      paid: rows.filter((p) => p.status === "Paid").reduce((s, p) => s + p.netPay, 0),
    };
  });

  const attendanceTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const rows = allAttendance.filter((a) => a.date === key);
    return {
      day: d.toLocaleDateString("en-SG", { weekday: "short" }),
      Present: rows.filter((a) => a.status === "Present" || a.status === "Half Day").length,
      Leave: rows.filter((a) => a.status === "On Leave" || a.status === "MC").length,
      Absent: rows.filter((a) => a.status === "Absent").length,
    };
  });

  const passMix = Object.entries(
    employees.reduce<Record<string, number>>((acc, e) => {
      const k = e.passType || "Unknown";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const projectMix = (["Active", "Planning", "On Hold", "Completed", "Cancelled"] as const)
    .map((s) => ({ name: s, value: projects.filter((p) => p.status === s).length }))
    .filter((r) => r.value > 0);

  const availableRate = employees.length
    ? Math.round((availableWorkers / employees.length) * 100)
    : 0;

  const keyMetrics: Array<{
    to: LinkProps["to"];
    title: string;
    value: string;
    caption: string;
    icon: React.ReactNode;
    variant: "default" | "primary" | "success" | "warning" | "destructive" | "info";
    badges?: SummaryBadge[];
  }> = [
    {
      to: "/documents" as const,
      title: "WorkPermit Expiring",
      value: wpExpiring.length.toString(),
      caption: `${wpExpiring30} within 30 days · next 60 days`,
      icon: <WorkPermitIdIcon className="h-7 w-7" />,
      variant: wpExpiring7 ? "destructive" : wpExpiring30 ? "warning" : wpExpiring.length ? "info" : "success",
      badges: wpExpiring.length
        ? [
            { label: `${wpSoonestDays}d left (soonest)`, tone: urgencyTone(wpSoonestDays) },
            { label: `≤7d: ${wpExpiring7}`, tone: wpExpiring7 ? "critical" : "neutral" },
            { label: `≤15d: ${wpExpiring15}`, tone: wpExpiring15 ? "warning" : "neutral" },
            { label: `≤30d: ${wpExpiring30}`, tone: wpExpiring30 ? "info" : "neutral" },
          ]
        : [{ label: "No permits expiring", tone: "success" }],
    },
    {
      to: "/documents" as const,
      title: "Passport Expiring",
      value: passportExpiring.length.toString(),
      caption: `${passportExpiring30} within 30 days · next 90 days`,
      icon: <PassportIcon className="h-7 w-7" />,
      variant: passportExpiring7
        ? "destructive"
        : passportExpiring30
          ? "warning"
          : passportExpiring.length
            ? "info"
            : "success",
      badges: passportExpiring.length
        ? [
            { label: `${passportSoonestDays}d left (soonest)`, tone: urgencyTone(passportSoonestDays) },
            { label: `≤7d: ${passportExpiring7}`, tone: passportExpiring7 ? "critical" : "neutral" },
            { label: `≤15d: ${passportExpiring15}`, tone: passportExpiring15 ? "warning" : "neutral" },
            { label: `≤30d: ${passportExpiring30}`, tone: passportExpiring30 ? "info" : "neutral" },
          ]
        : [{ label: "No passports expiring", tone: "success" }],
    },
    {
      to: "/workforce" as const,
      title: "Available Workers",
      value: availableWorkers.toString(),
      caption: `of ${employees.length} total workers`,
      icon: <UserCheck className="h-5 w-5" />,
      variant: availableRate >= 70 ? "success" : availableRate >= 40 ? "warning" : "destructive",
      badges: [
        {
          label: `${availableRate}% available`,
          tone: availableRate >= 70 ? "success" : availableRate >= 40 ? "warning" : "critical",
        },
        { label: `On leave: ${leaves.length}`, tone: leaves.length ? "info" : "neutral" },
        { label: `Permit ≤30d: ${wpExpiring30}`, tone: wpExpiring30 ? "warning" : "neutral" },
      ],
    },
    {
      to: "/leave" as const,
      title: "On Medical Leave",
      value: medicalLeaveCount.toString(),
      caption: "MC / hospitalisation today",
      icon: <HeartPulse className="h-5 w-5" />,
      variant: "info" as const,
    },
    {
      to: "/training" as const,
      title: "CSOC Certified",
      value: csocWorkers.toString(),
      caption: `${Math.max(0, employees.length - csocWorkers)} without valid CSOC`,
      icon: <BadgeCheck className="h-5 w-5" />,
      variant: "primary" as const,
    },
    {
      to: "/leave" as const,
      title: "On Normal Leave",
      value: onNormalLeave.length.toString(),
      caption: "Annual / other leave today",
      icon: <Palmtree className="h-5 w-5" />,
      variant: "info" as const,
    },
    {
      to: "/time-management" as const,
      title: "Absent Today",
      value: absentToday.toString(),
      caption: `${presentToday} present today`,
      icon: <CalendarX2 className="h-5 w-5" />,
      variant: (absentToday ? "warning" : "success") as "warning" | "success",
    },
    {
      to: "/projects" as const,
      title: "Running Projects",
      value: runningProjects.length.toString(),
      caption: `${projects.length} projects in total`,
      icon: <FolderKanban className="h-5 w-5" />,
      variant: "primary" as const,
    },
    {
      to: "/projects" as const,
      title: "Projects Ending Soon",
      value: endingProjects.length.toString(),
      caption: "Completing within 30 days",
      icon: <Briefcase className="h-5 w-5" />,
      variant: (endingProjects.length ? "warning" : "default") as "warning" | "default",
    },
    {
      to: "/clients" as const,
      title: "Clients",
      value: clientsAll.length.toString(),
      caption: `${activeClientCount} active accounts`,
      icon: <Building2 className="h-5 w-5" />,
      variant: "info" as const,
    },
    {
      to: "/payroll" as const,
      title: "Salary Paid (Month)",
      value: sgd(salaryPaidMonth),
      caption: `${paidThisMonth.length} payslips · ${monthKey}`,
      icon: <DollarSign className="h-5 w-5" />,
      variant: "success" as const,
    },
    {
      to: "/payroll" as const,
      title: "Annual Wages",
      value: sgd(annualWages),
      caption: `Gross wages ${yearKey}`,
      icon: <Landmark className="h-5 w-5" />,
      variant: "primary" as const,
    },
  ];

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
    { to: "/workforce", search: { new: true }, icon: Users, label: "Register employee", desc: "Add a new worker to the system.", color: "primary" },
    { to: "/time-management", search: { new: true }, icon: CalendarClock, label: "Site attendance", desc: "Record daily attendance by site.", color: "success" },
    { to: "/operations", search: { new: true }, icon: FolderKanban, label: "Create assignment", desc: "Deploy workers to a project site.", color: "info" },
    { to: "/documents", search: undefined, icon: FileText, label: "Expiring documents", desc: "Review work permits and passes.", color: "warning" },
  ] as const;

  return (
    <AppShell>
      <div className="w-full space-y-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Dashboard
            </h1>
            <p className="text-base text-muted-foreground">
              Workforce, compliance and operations at a glance ·{" "}
              {today.toLocaleDateString("en-SG", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
              <UserCheck className="h-4 w-4" /> {availableWorkers} available today
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/25 bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning">
              <AlertCircle className="h-4 w-4" /> {pendingApprovals} pending approvals
            </span>
          </div>
        </div>

        {/* 1. Key numbers */}
        <section className="space-y-3">
          <SectionHeading
            title="Overview"
            caption="Click any card to open the related page"
            icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {keyMetrics.map((m) => (
              <Link key={m.title} to={m.to} className="block focus-visible:outline-none">
                <SummaryCard
                  title={m.title}
                  value={m.value}
                  caption={m.caption}
                  icon={m.icon}
                  badges={m.badges}
                  variant={m.variant}
                  className="h-full cursor-pointer hover:border-primary/40"
                />
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Company snapshot" caption="Live figures across sites and approvals" />
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
                  search={action.search as never}
                  className="flex items-center gap-3 rounded-xl border bg-gradient-surface p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elegant"
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-sm ${colorClass}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-medium text-foreground">{action.label}</p>
                    <p className="truncate text-sm text-muted-foreground">{action.desc}</p>
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
                    <p className="truncate text-base font-medium text-foreground">{f.subject}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {f.activityType} ·{" "}
                      {(f.clientId && clientNames.get(f.clientId)) ||
                        (f.leadId && leadNames.get(f.leadId)) ||
                        "—"}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <StatusBadge variant={badge.variant} label={badge.label} dot />
                      <span className="shrink-0 text-sm text-muted-foreground">
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
                  <p className="text-base font-medium text-foreground">Lead pipeline</p>
                  <Link to="/clients" className="text-sm text-primary hover:underline">
                    Open CRM
                  </Link>
                </div>
                {openLeads.length === 0 ? (
                  <p className="text-base text-muted-foreground">
                    No open leads yet. Add a lead to start tracking your pipeline.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pipeline.map((p) => (
                      <div key={p.stage} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-sm text-muted-foreground">
                          {p.stage}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-primary transition-all duration-500"
                            style={{ width: `${(p.count / maxStageCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-sm font-medium text-foreground">
                          {p.count}
                        </span>
                        <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                          {money(p.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-gradient-surface p-5 shadow-sm">
                <p className="mb-4 text-base font-medium text-foreground">Recent activity</p>
                {recentActivities.length === 0 ? (
                  <p className="text-base text-muted-foreground">
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
                          <p className="truncate text-base text-foreground">{a.subject}</p>
                          <p className="truncate text-sm text-muted-foreground">
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
                  to="/workforce/$id"
                  params={{ id: e.id }}
                  className="rounded-xl border bg-gradient-surface p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-elegant"
                >
                  <p className="truncate text-base font-medium text-foreground">{e.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
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

        {/* 4. Charts */}
        <section className="space-y-3">
          <SectionHeading
            title="Analytics"
            caption="Wages, attendance and workforce distribution"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          />
          <DashboardCharts
            data={{
              wageTrend,
              attendance: attendanceTrend,
              passMix,
              projectMix,
            }}
          />
        </section>

        {/* 5. History + system status */}
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
