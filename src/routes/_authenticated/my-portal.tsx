import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { singaporeDate, singaporeTime } from "@/core/portal-punch";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CalendarPlus, Clock, Download, FileText, Home, IdCard, Loader2, LogIn, LogOut, UserRound, Wallet, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { isWorkerOnly } from "@/core/access";
import { monthAttendance } from "@/features/worker-portal/attendance";
import { leaveSummary, payslipsInRange, rangeAttendance, weekRange } from "@/features/worker-portal/summaries";
import { leaveBalances } from "@/lib/sg-leave";
import { downloadPayslipPdf } from "@/lib/pdf";
import { openR2File } from "@/lib/r2";
import { SelfProfileForm } from "@/components/self-profile-form";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addLeaveRequest,
  countLeaveDays,
  getDocumentsByEmployee,
  getAttendanceByEmployee,
  getEmployees,
  getLeaveByEmployee,
  getPayrollByEmployee,
  invalidateStoreTable,
  subscribe,
} from "@/lib/store";
import type { Attendance, Employee, LeaveType } from "@/lib/types";

const leaveTypes: LeaveType[] = [
  "Annual Leave",
  "Medical Leave",
  "Hospitalisation Leave",
  "Unpaid Leave",
  "Home Leave",
  "Compassionate Leave",
];

export const Route = createFileRoute("/_authenticated/my-portal")({
  head: () => ({
    meta: [
      { title: "My Portal — BSM Workforce & Operations" },
      { name: "description", content: "Your profile, documents, payslips and leave requests." },
      { property: "og:title", content: "My Portal — BSM Workforce & Operations" },
      { property: "og:description", content: "Self-service portal for employees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyPortalPage,
});

function daysUntil(date?: string) {
  if (!date || date === "-") return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

type PortalTab = "home" | "attendance" | "leave" | "payslips" | "profile";
const TABS: { id: PortalTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "leave", label: "Leave", icon: CalendarPlus },
  { id: "payslips", label: "Payslips", icon: Wallet },
  { id: "profile", label: "Profile", icon: UserRound },
];

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Worker-only accounts get an app-like shell (top bar + bottom tabs); staff keep the office shell. */
function PortalShell({ worker, employee, tab, setTab, children }: { worker: boolean; employee?: Employee; tab: PortalTab; setTab: (t: PortalTab) => void; children: ReactNode }) {
  const { signOut } = useAuth();
  if (!worker) return <AppShell>{children}</AppShell>;
  return (
    <div className="worker-app min-h-svh text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-transparent px-5 pb-3 backdrop-blur-md pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur lg:border-b lg:bg-card/95 lg:px-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center wa-avatar rounded-full text-base font-semibold ring-2 ring-card shadow-md lg:h-10 lg:w-10">
          {(employee?.name ?? "?").slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium lg:text-sm lg:font-semibold"><span className="lg:hidden">Hello, </span>{employee?.name?.split(" ")[0] ?? "My Portal"}<span className="hidden lg:inline">{employee?.name?.split(" ").slice(1).join(" ") ? ` ${employee?.name?.split(" ").slice(1).join(" ")}` : ""}</span></p>
          <p className="truncate text-xs text-muted-foreground">{employee ? `${employee.employeeCode} · ${employee.trade}` : "BSM Workforce"}</p>
        </div>
        <Button size="icon" variant="ghost" className="rounded-full text-primary" aria-label="Sign out" onClick={() => void signOut().then(() => window.location.replace("/auth"))}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>
      <div className="mx-auto flex max-w-7xl">
        {employee && (
          <aside className="sticky top-[65px] hidden h-[calc(100svh-65px)] w-60 shrink-0 border-r px-3 py-6 lg:block" aria-label="Portal menu">
            <nav className="space-y-1">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${tab === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  aria-current={tab === id ? "page" : undefined}>
                  <Icon className="h-5 w-5 shrink-0" />{label}
                </button>
              ))}
            </nav>
          </aside>
        )}
        <main className="min-w-0 flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-1 lg:px-8 lg:pb-10 lg:pt-6">{children}</main>
      </div>
      {employee && (
        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.12)]" aria-label="Portal">
          <div className="mx-auto grid max-w-3xl grid-cols-5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}
                className={`relative flex min-h-[62px] flex-col items-center justify-center gap-1 text-[11px] transition-colors active:bg-muted ${tab === id ? "font-semibold text-foreground before:absolute before:inset-x-4 before:top-0 before:h-[3px] before:rounded-b before:bg-gradient-to-r before:from-primary before:to-[var(--wa-pink)]" : "font-medium text-muted-foreground"}`}
                aria-current={tab === id ? "page" : undefined}>
                <Icon className="h-[22px] w-[22px] text-primary" /><span className="max-w-full truncate px-0.5">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-4 shadow-sm ${className}`}>{children}</div>;
}

function localDate(d = new Date()) {
  return singaporeDate(d);
}
function localTime(d = new Date()) {
  return singaporeTime(d);
}
function getPosition(): Promise<{ lat: number; lng: number; accuracyM: number } | undefined> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

/** Check in / check out for today, shown first on the worker home. */
function PunchCard({ checkIn, checkOut, status, unavailable, onDone }: { checkIn?: string; checkOut?: string; status?: string; unavailable: boolean; onDone: (row: Attendance) => void }) {
  const [now, setNow] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const punch = async (kind: "in" | "out") => {
    if (busy || unavailable) return;
    setBusy(kind);
    try {
      const at = new Date();
      const time = localTime(at);
      const pos = await getPosition();
      const res = await apiFetch<Attendance | null>("/attendance", {
        method: "POST",
        body: { date: localDate(at), punchedAt: at.toISOString(), ...(kind === "in" ? { checkIn: time } : { checkOut: time }), ...(pos ?? {}) },
      });
      if (!res.ok) return void toast.error(res.error?.message ?? "Could not save attendance");
      const savedTime = kind === "in" ? res.data?.checkIn : res.data?.checkOut;
      if (!res.data?.id || !savedTime) return void toast.error("Save could not be confirmed. Refresh before trying again.");
      toast.success(kind === "in" ? `Checked in at ${savedTime}` : `Checked out at ${savedTime}`);
      onDone(res.data);
    } catch {
      toast.error("Could not save attendance. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const state = checkOut ? "Day complete" : checkIn ? "On duty" : "Not checked in";
  const mins = (t?: string) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const startM = mins(checkIn);
  const endM = checkOut ? mins(checkOut) : now ? mins(localTime(now)) : null;
  const worked = startM !== null && endM !== null ? Math.max(0, endM - startM) : 0;
  const pct = Math.min(100, Math.round((worked / 540) * 100));
  const label = status && status !== "Present" ? status : state;
  const mobile = (
    <div className="wa-hero relative overflow-hidden rounded-3xl p-5 text-primary-foreground lg:hidden">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-lime/25 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <p className="text-xl font-semibold tracking-tight">Attendance</p>
        <span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium">{label}</span>
      </div>
      <div className="wa-glass mt-4 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-md"><Clock className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm opacity-90">{now ? now.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short" }) : ""}</p>
            <p className="text-xs opacity-70">Duty 9h incl. 1h lunch</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">{checkIn ? "Worked" : "Time now"}</p>
            <p className="text-2xl font-semibold tabular-nums">{checkIn ? `${String(Math.floor(worked / 60)).padStart(2, "0")}h:${String(worked % 60).padStart(2, "0")}m` : now ? now.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full rounded-full bg-gradient-to-r from-primary-foreground to-brand-lime transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="mt-2 flex justify-between text-sm tabular-nums">
          <span>In {checkIn ?? "--:--"}</span><span>Out {checkOut ?? "--:--"}</span>
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        {checkOut ? (
          <div className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-primary-foreground/70 font-semibold">Day complete</div>
        ) : (
          <Button type="button" disabled={!!busy || unavailable} onClick={() => void punch(checkIn ? "out" : "in")}
            className="flex h-12 flex-1 items-center justify-center gap-2 wa-pink-btn rounded-xl text-base font-semibold text-brand-lime-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : checkIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}{checkIn ? "Check out" : "Check in"}
          </Button>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs opacity-80"><MapPin className="h-3.5 w-3.5 shrink-0" />{unavailable ? "Confirming today's attendance…" : "Location is recorded when permission is granted"}</p>
    </div>
  );
  return (
    <>
    {mobile}
    <Card className="hidden p-5 lg:block lg:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Today's attendance</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight lg:text-4xl">{now ? now.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</p>
          <p className="text-sm text-muted-foreground">{now ? now.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}</p>
          <div className="mt-4 flex gap-6 text-sm lg:flex lg:flex-wrap lg:gap-6">
            <div className=""><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{status && status !== "Present" ? status : state}</p></div>
            <div className=""><p className="text-xs text-muted-foreground">Check in</p><p className="font-medium tabular-nums">{checkIn ?? "—"}</p></div>
            <div className=""><p className="text-xs text-muted-foreground">Check out</p><p className="font-medium tabular-nums">{checkOut ?? "—"}</p></div>
          </div>
        </div>
        <div className="hidden grid-cols-2 gap-3 lg:grid lg:w-80">
          <Button size="lg" className="h-14 gap-2 text-base" disabled={!!busy || unavailable || !!checkIn} onClick={() => void punch("in")}>
            {busy === "in" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}Check in
          </Button>
          <Button size="lg" variant="secondary" className="h-14 gap-2 text-base" disabled={!!busy || unavailable || !checkIn || !!checkOut} onClick={() => void punch("out")}>
            {busy === "out" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}Check out
          </Button>
          <p className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" />{unavailable ? "Confirming today's attendance…" : "Location is recorded when permission is granted."}</p>
        </div>
      </div>
    </Card>
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value === undefined || value === null || value === "" ? "-" : value}</p>
    </div>
  );
}

function MyPortalPage() {
  const { user, roles } = useAuth();
  const worker = isWorkerOnly(roles);
  const email = user?.email?.toLowerCase() ?? "";
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<PortalTab>("home");
  const [month, setMonth] = useState(thisMonth());
  const employee = useMemo(
    () => getEmployees().find((e) => (user?.id && e.userId === user.id) || (!!email && (e.email ?? "").toLowerCase() === email)),
    [email, user?.id, refresh],
  );

  const [today, setToday] = useState(localDate);
  useEffect(() => subscribe(() => setRefresh(n => n + 1)), []);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const todayQuery = useQuery({
    queryKey: ["portal-punch", user?.id, employee?.id, today],
    enabled: Boolean(employee && user),
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    queryFn: async () => {
      const res = await apiFetch<Attendance[]>("/attendance", { query: { employeeId: employee?.id, from: today, to: today, limit: 1 } });
      if (!res.ok) throw new Error(res.error.message);
      return res.data[0] ?? null;
    },
  });
  const [attView, setAttView] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [attDay, setAttDay] = useState(() => localDate());
  const [leaveYear, setLeaveYear] = useState(() => new Date().getFullYear());
  const [leaveMonth, setLeaveMonth] = useState(0);
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");
  const [paySel, setPaySel] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<LeaveType>("Annual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const documents = useMemo(() => (employee ? getDocumentsByEmployee(employee.id) : []), [employee, refresh]);
  const payslips = useMemo(() => (employee ? [...getPayrollByEmployee(employee.id)].sort((a, b) => b.month.localeCompare(a.month)) : []), [employee, refresh]);
  const leaves = useMemo(() => (employee ? [...getLeaveByEmployee(employee.id)].sort((a, b) => b.startDate.localeCompare(a.startDate)) : []), [employee, refresh]);
  const attendanceAll = useMemo(() => (employee ? getAttendanceByEmployee(employee.id) : []), [employee, refresh]);
  const att = useMemo(() => monthAttendance(attendanceAll, month), [attendanceAll, month]);

  if (!employee) {
    return (
      <PortalShell worker={worker} tab={tab} setTab={setTab}>
        <div className="mx-auto max-w-3xl">
          <EmptyState icon={<UserRound className="h-5 w-5" />} title="No employee record linked"
            description={`No employee profile matches ${email || "your account"}. Ask HR to set your work email on your employee record.`} />
        </div>
      </PortalShell>
    );
  }

  const todayAtt = todayQuery.data;
  const todayIn = todayAtt?.checkIn;
  const todayOut = todayAtt?.checkOut;
  const passDays = daysUntil(employee.workPermitExpiryDate || employee.passExpiry);
  const approvedLeaveDays = leaves.filter((l) => l.status === "Approved").reduce((sum, l) => sum + l.days, 0);
  const lastPayslip = payslips[0];
  const expiring = [
    ...documents.filter((d) => { const n = daysUntil(d.expiryDate); return n !== null && n <= 60; }).map((d) => ({ name: d.name, days: daysUntil(d.expiryDate)! })),
    ...(daysUntil(employee.passportExpiry) !== null && daysUntil(employee.passportExpiry)! <= 180 ? [{ name: "Passport", days: daysUntil(employee.passportExpiry)! }] : []),
  ];

  const submit = () => {
    if (!startDate || !endDate) return void toast.error("Select start and end dates");
    const days = countLeaveDays(startDate, endDate);
    if (days <= 0) return void toast.error("End date must be on or after the start date");
    addLeaveRequest({ employeeId: employee.id, type, startDate, endDate, reason: reason || undefined, status: "Pending" });
    toast.success("Leave request submitted for approval");
    setOpen(false); setStartDate(""); setEndDate(""); setReason("");
    setRefresh((n) => n + 1);
  };

  const leaveDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 shrink-0 gap-2 rounded-full px-4"><CalendarPlus className="h-4 w-4" />Apply for leave</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>Your request goes to HR for approval.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Leave type</Label>
            <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{leaveTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Start date</Label><Input className="h-11" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>End date</Label><Input className="h-11" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Submit request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const home = (
    <div className="space-y-4 lg:space-y-6">
      {todayQuery.isError && <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive"><span>Could not confirm today's attendance. Check your connection.</span><Button variant="outline" onClick={() => void todayQuery.refetch()}>Retry</Button></div>}
      <PunchCard checkIn={todayIn} checkOut={todayOut} status={todayAtt?.status} unavailable={todayQuery.isFetching || todayQuery.isPending || todayQuery.isError}
        onDone={() => {
          void todayQuery.refetch();
          invalidateStoreTable("attendance");
          setRefresh((n) => n + 1);
        }} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <SummaryCard compact title="Work permit" value={passDays === null ? "—" : `${passDays} days`} icon={<IdCard className="h-5 w-5" />} caption={`expires ${employee.workPermitExpiryDate || employee.passExpiry || "-"}`} />
        <SummaryCard compact title="This month" value={`${att.daysWorked} days`} icon={<CalendarCheck className="h-5 w-5" />} caption={`${att.normalHours}h + ${att.otHours}h OT`} />
        <SummaryCard compact title="Leave taken" value={`${approvedLeaveDays} days`} icon={<CalendarPlus className="h-5 w-5" />} caption={`${leaves.filter((l) => l.status === "Pending").length} pending`} />
        <SummaryCard compact title="Latest net pay" value={lastPayslip ? `$${lastPayslip.netPay.toLocaleString()}` : "—"} icon={<Wallet className="h-5 w-5" />} caption={lastPayslip ? lastPayslip.month : "No payslip yet"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Recent attendance</p>
            <Button size="sm" variant="ghost" onClick={() => setTab("attendance")}>View all</Button>
          </div>
          {att.rows.length === 0 ? <p className="text-sm text-muted-foreground">No attendance this month yet.</p> : (
            <ul className="divide-y">
              {[...att.rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{new Date(a.date).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{a.checkIn ?? "-"} → {a.checkOut ?? "-"}</span>
                  <StatusBadge label={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Leave</p>
            {leaveDialog}
          </div>
          {expiring.length > 0 && (
            <div className="mb-3 rounded-lg border border-destructive/40 p-3">
              <p className="text-sm font-semibold">Documents to renew</p>
              <ul className="mt-2 space-y-1 text-sm">
                {expiring.map((d) => <li key={d.name} className="flex justify-between"><span>{d.name}</span><span className="text-destructive">{d.days < 0 ? "Expired" : `${d.days} days`}</span></li>)}
              </ul>
            </div>
          )}
          {leaves.length === 0 ? <p className="text-sm text-muted-foreground">No leave requests yet.</p> : (
            <ul className="divide-y">
              {leaves.slice(0, 4).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{l.type} · {l.startDate}</span>
                  <StatusBadge label={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );

  const attRange = attView === "daily" ? { from: attDay, to: attDay } : attView === "weekly" ? weekRange(attDay) : { from: `${month}-01`, to: `${month}-31` };
  const attSum = rangeAttendance(attendanceAll, attRange.from, attRange.to);
  const stat = (label: string, value: string | number, tone = "") => (
    <Card className="p-3 lg:p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold tabular-nums lg:text-2xl ${tone}`}>{value}</p></Card>
  );
  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const attendance = (
    <div className="space-y-4">
      <Card className="grid gap-3 p-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="grid grid-cols-3 rounded-lg border p-1">
          {(["daily", "weekly", "monthly"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setAttView(v)} className={`rounded-md px-2 py-2 text-sm sm:px-4 font-medium capitalize ${attView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
          ))}
        </div>
        {attView === "monthly" ? (
          <div className="grid gap-1"><Label htmlFor="att-month" className="text-xs">Month</Label><Input id="att-month" type="month" className="h-10 sm:w-48" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} /></div>
        ) : (
          <div className="grid gap-1"><Label htmlFor="att-day" className="text-xs">{attView === "weekly" ? "Any day in the week" : "Date"}</Label><Input id="att-day" type="date" className="h-10 sm:w-48" value={attDay} onChange={(e) => setAttDay(e.target.value || today)} /></div>
        )}
        <p className="text-sm text-muted-foreground sm:ml-auto">{attRange.from === attRange.to ? fmtDay(attRange.from) : `${fmtDay(attRange.from)} – ${fmtDay(attRange.to).replace(/^\w+, /, "")}`}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stat("Days worked", attSum.daysWorked)}
        {stat("Normal hours", attSum.normalHours)}
        {stat("OT hours", attSum.otHours, "text-primary")}
        {stat("Absent", attSum.absent, attSum.absent ? "text-destructive" : "")}
        {stat("Leave / MC", attSum.leave)}
      </div>
      {attSum.rows.length === 0 ? <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="No attendance" description="No attendance recorded for this period." /> : (
        <>
        <ul className="space-y-2 lg:hidden">
          {attSum.rows.map((a) => (
            <li key={a.id} className="rounded-2xl border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm font-semibold">{fmtDay(a.date)}</p><StatusBadge label={a.status} /></div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                {([["In", a.checkIn ?? "-"], ["Out", a.checkOut ?? "-"], ["Hours", a.hoursWorked], ["OT", a.overtimeHours]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-muted/60 py-1.5"><p className="text-muted-foreground">{l}</p><p className="text-sm font-medium tabular-nums">{v}</p></div>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Card className="hidden overflow-x-auto p-0 lg:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Check in</th><th className="px-4 py-3">Check out</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3 text-right">OT</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {attSum.rows.map((a) => (
                <tr key={a.id}><td className="px-4 py-3 font-medium">{fmtDay(a.date)}</td><td className="px-4 py-3 tabular-nums">{a.checkIn ?? "-"}</td><td className="px-4 py-3 tabular-nums">{a.checkOut ?? "-"}</td><td className="px-4 py-3 text-right tabular-nums">{a.hoursWorked}</td><td className="px-4 py-3 text-right tabular-nums">{a.overtimeHours}</td><td className="px-4 py-3"><StatusBadge label={a.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </div>
  );

  const years = Array.from(new Set([new Date().getFullYear(), ...leaves.map((l) => Number(l.startDate.slice(0, 4)))])).filter(Boolean).sort((x, y) => y - x);
  const lv = leaveSummary(leaves, leaveYear, leaveMonth || undefined);
  const balances = leaveBalances(employee, leaves);
  const leave = (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="text-sm text-muted-foreground">Balances are for {new Date().getFullYear()}, under the Employment Act.</p>
        {leaveDialog}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {balances.filter((b) => b.entitled > 0 || b.taken > 0).map((b) => (
          <Card key={b.type} className="relative overflow-hidden p-4 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-primary before:to-[var(--wa-pink)]">
            <p className="text-xs text-muted-foreground">{b.type}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{b.balance}<span className="text-sm font-normal text-muted-foreground"> / {b.entitled} days left</span></p>
            <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="wa-bar h-1.5 rounded-full" style={{ width: `${b.entitled ? Math.min(100, (b.taken / b.entitled) * 100) : 0}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{b.taken} taken{b.eligible ? "" : " · not yet eligible"}</p>
          </Card>
        ))}
      </div>
      <Card className="grid grid-cols-2 items-end gap-3 p-3 sm:flex sm:flex-wrap">
        <div className="grid gap-1"><Label className="text-xs">Year</Label>
          <Select value={String(leaveYear)} onValueChange={(v) => setLeaveYear(Number(v))}><SelectTrigger className="h-10 w-full sm:w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="grid gap-1"><Label className="text-xs">Month</Label>
          <Select value={String(leaveMonth)} onValueChange={(v) => setLeaveMonth(Number(v))}><SelectTrigger className="h-10 w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Whole year</SelectItem>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{new Date(2000, i, 1).toLocaleString("en-SG", { month: "long" })}</SelectItem>)}</SelectContent></Select>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stat("Requested", lv.requested)}
        {stat("Approved", lv.approved, "text-primary")}
        {stat("Pending", lv.pending)}
        {stat("Rejected", lv.rejected, lv.rejected ? "text-destructive" : "")}
        {stat("Approved days", lv.approvedDays)}
      </div>
      {lv.rows.length === 0 ? <EmptyState icon={<CalendarPlus className="h-5 w-5" />} title="No leave requests" description="No requests in this period." /> : (
        <>
        <ul className="space-y-2 lg:hidden">
          {lv.rows.map((l) => (
            <li key={l.id} className="rounded-2xl border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm font-semibold">{l.type}</p><StatusBadge label={l.status} /></div>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">{l.startDate}{l.endDate && l.endDate !== l.startDate ? ` → ${l.endDate}` : ""} · {l.days} day{l.days === 1 ? "" : "s"}</p>
              {(l.remarks || l.reason) && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{l.remarks || l.reason}</p>}
            </li>
          ))}
        </ul>
        <Card className="hidden overflow-x-auto p-0 lg:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Days</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {lv.rows.map((l) => (
                <tr key={l.id}><td className="px-4 py-3 font-medium">{l.type}</td><td className="px-4 py-3">{l.startDate}</td><td className="px-4 py-3">{l.endDate}</td><td className="px-4 py-3 text-right tabular-nums">{l.days}</td><td className="max-w-[16rem] truncate px-4 py-3 text-muted-foreground">{l.remarks || l.reason || "-"}</td><td className="px-4 py-3"><StatusBadge label={l.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </div>
  );

  const money = (n: number) => `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const ps = payslipsInRange(payslips, payFrom, payTo);
  const selected = ps.rows.find((p) => p.id === paySel) ?? ps.rows[0];
  const line = (label: string, v?: number, neg = false) => v ? <div className="flex justify-between gap-3 py-1.5 text-sm"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{neg ? "-" : ""}{money(v)}</span></div> : null;
  const payslipView = payslips.length === 0 ? <EmptyState icon={<Wallet className="h-5 w-5" />} title="No payslips" description="Your payslips will appear here once payroll is processed." /> : (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 items-end gap-3 p-3 sm:flex sm:flex-wrap">
        <div className="grid gap-1"><Label htmlFor="pay-from" className="text-xs">From month</Label><Input id="pay-from" type="month" className="h-10 w-full sm:w-44" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} /></div>
        <div className="grid gap-1"><Label htmlFor="pay-to" className="text-xs">To month</Label><Input id="pay-to" type="month" className="h-10 w-full sm:w-44" value={payTo} onChange={(e) => setPayTo(e.target.value)} /></div>
        <Button variant="outline" className="col-span-2 h-10 sm:col-auto" onClick={() => { setPayFrom(""); setPayTo(""); }}>All time</Button>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Months paid", ps.months)}
        {stat("Total gross", money(ps.gross))}
        {stat("Total deductions", money(ps.deductions))}
        {stat("Total net pay", money(ps.net), "text-primary")}
      </div>
      {ps.rows.length === 0 ? <EmptyState icon={<Wallet className="h-5 w-5" />} title="No payslips in this range" description="Choose a different month range." /> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="p-0">
            <ul className="divide-y">
              {ps.rows.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { setPaySel(p.id); if (window.innerWidth < 1024) window.setTimeout(() => document.getElementById("payslip-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }} className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${selected?.id === p.id ? "wa-tint border-l-4 border-primary" : "hover:bg-muted/50"}`}>
                    <div className="min-w-0"><p className="font-medium">{new Date(`${p.month}-01T00:00:00`).toLocaleDateString("en-SG", { month: "long", year: "numeric" })}</p><p className="text-xs text-muted-foreground">{p.status}</p></div>
                    <span className="shrink-0 font-semibold tabular-nums">{money(p.netPay)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected && (
            <div id="payslip-detail" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start"><Card className="relative overflow-hidden p-5 shadow-[var(--wa-shadow)]"><div aria-hidden className="wa-bar absolute inset-x-0 top-0 h-1.5" />
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Payslip</p><p className="text-lg font-semibold">{new Date(`${selected.month}-01T00:00:00`).toLocaleDateString("en-SG", { month: "long", year: "numeric" })}</p></div>
                <StatusBadge label={selected.status} />
              </div>
              <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Earnings</p>
              <div className="divide-y">
                {line("Basic salary", selected.basicSalary)}
                {line(`Overtime${selected.overtimeHours ? ` (${selected.overtimeHours}h)` : ""}`, selected.overtimePay)}
                {line("Allowances", selected.allowances)}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Deductions</p>
              <div className="divide-y">
                {line("CPF (employee)", selected.cpfEmployee, true)}
                {line("Accommodation", selected.accommodationDeduction, true)}
                {line("Loan repayment", selected.loanRepayment, true)}
                {line(selected.shgFund && selected.shgFund !== "None" ? `${selected.shgFund} fund` : "Self-help fund", selected.shgAmount, true)}
                {line("Other deductions", selected.otherDeductions, true)}
                {!selected.accommodationDeduction && !selected.loanRepayment && !selected.otherDeductions ? line("Deductions", selected.deductions, true) : null}
              </div>
              <div className="wa-net mt-3 flex justify-between rounded-xl px-4 py-3 text-base font-semibold"><span>Net pay</span><span className="tabular-nums">{money(selected.netPay)}</span></div>
              {selected.paidAt && <p className="mt-1 text-xs text-muted-foreground">Paid on {selected.paidAt.slice(0, 10)}</p>}
              <Button className="wa-pink-btn mt-4 h-10 w-full gap-2 border-0 text-primary" onClick={() => void downloadPayslipPdf(selected, { employee }).catch(() => toast.error("Could not create payslip PDF"))}>
                <Download className="h-4 w-4" />Download payslip
              </Button>
            </Card></div>
          )}
        </div>
      )}
    </div>
  );

  const profile = editing ? (
    <div className="space-y-3">
      <Button variant="outline" onClick={() => setEditing(false)}>← Back to profile</Button>
      <SelfProfileForm employee={employee} onSaved={() => { setRefresh((n) => n + 1); setEditing(false); }} />
    </div>
  ) : (
    <div className="space-y-4">
      {employee.status === "Pending Profile Completion" && <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">Your profile is incomplete. Tap Edit my details and submit for HR verification.</div>}
      <Button className="h-11 w-full sm:w-auto" onClick={() => setEditing(true)}>Edit my details</Button>
      {([
        ["Personal", [["P-File No", employee.employeeCode], ["Full name", employee.name], ["Nationality", employee.nationality], ["Date of birth", employee.dateOfBirth], ["FIN / NRIC", employee.fin], ["Phone", employee.phone], ["Email", employee.email], ["Dormitory", employee.dormitory], ["Emergency contact", employee.emergencyContact], ["Emergency phone", employee.emergencyPhone]]],
        ["Work", [["Designation", employee.trade], ["Site", employee.site ?? "Unassigned"], ["Status", employee.status], ["Joined on", employee.joinedOn]]],
        ["Pass & passport", [["Pass type", employee.passType], ["Work permit no", employee.workPermitNumber], ["WP expiry", employee.workPermitExpiryDate || employee.passExpiry], ["Passport no", employee.passportNumber], ["Passport expiry", employee.passportExpiry]]],
        ["Bank", [["Bank", employee.bankName], ["Account no", employee.bankAccount]]],
      ] as [string, [string, string | undefined][]][]).map(([title, fields]) => (
        <Card key={title}>
          <p className="mb-3 text-sm font-semibold">{title}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{fields.map(([l, v]) => <Field key={l} label={l} value={v} />)}</div>
        </Card>
      ))}
      <Card>
        <p className="mb-3 text-sm font-semibold">Documents</p>
        {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents on file.</p> : (
          <ul className="divide-y">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.type} · expires {d.expiryDate ?? "-"}</p>
                </div>
                {d.fileUrl ? <Button size="sm" variant="outline" className="gap-1" onClick={() => void openR2File(d.fileUrl!).catch(() => toast.error("Could not open file"))}><FileText className="h-4 w-4" />View</Button> : <StatusBadge label={d.status} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );

  const views: Record<PortalTab, ReactNode> = { home, attendance, leave, payslips: payslipView, profile };

  return (
    <PortalShell worker={worker} employee={employee} tab={tab} setTab={setTab}>
      <div className="mx-auto max-w-6xl space-y-4">
        {!worker && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Portal</h1>
            <p className="text-sm text-muted-foreground">{employee.name} · {employee.employeeCode} · {employee.trade}</p>
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as PortalTab)}>
          <TabsList className={worker ? "hidden" : "flex w-full justify-start overflow-x-auto"}>
            {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
          </TabsList>
          {worker && <h1 className={`mb-3 text-xl font-semibold lg:mb-5 lg:text-2xl ${tab === "home" ? "hidden lg:block" : ""}`}>{TABS.find((t) => t.id === tab)?.label}</h1>}
          {TABS.map((t) => <TabsContent key={t.id} value={t.id} className={worker ? "mt-0" : "mt-4"}>{views[t.id]}</TabsContent>)}
        </Tabs>
      </div>
    </PortalShell>
  );
}
