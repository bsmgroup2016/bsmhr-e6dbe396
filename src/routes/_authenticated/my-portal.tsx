import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CalendarPlus, Clock, Download, FileText, Home, IdCard, Loader2, LogIn, LogOut, UserRound, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { isWorkerOnly } from "@/core/access";
import { monthAttendance } from "@/features/worker-portal/attendance";
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
} from "@/lib/store";
import type { Employee, LeaveType } from "@/lib/types";

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
    <div className="worker-app min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/95 px-4 lg:px-8 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
          {(employee?.name ?? "?").slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{employee?.name ?? "My Portal"}</p>
          <p className="truncate text-xs text-muted-foreground">{employee ? `${employee.employeeCode} · ${employee.trade}` : "BSM Workforce"}</p>
        </div>
        <Button size="icon" variant="ghost" aria-label="Sign out" onClick={() => void signOut().then(() => window.location.replace("/auth"))}>
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
        <main className="min-w-0 flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 lg:px-8 lg:pb-10 lg:pt-6">{children}</main>
      </div>
      {employee && (
        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Portal">
          <div className="mx-auto grid max-w-3xl grid-cols-5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${tab === id ? "text-primary" : "text-muted-foreground"}`}
                aria-current={tab === id ? "page" : undefined}>
                <Icon className="h-5 w-5" />{label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-4 shadow-sm ${className}`}>{children}</div>;
}

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
function PunchCard({ checkIn, checkOut, status, onDone }: { checkIn?: string; checkOut?: string; status?: string; onDone: (kind: "in" | "out", time: string) => void }) {
  const [now, setNow] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const punch = async (kind: "in" | "out") => {
    setBusy(kind);
    try {
      const at = new Date();
      const time = localTime(at);
      const pos = await getPosition();
      const res = await apiFetch("/attendance", {
        method: "POST",
        body: { date: localDate(at), punchedAt: at.toISOString(), ...(kind === "in" ? { checkIn: time } : { checkOut: time }), ...(pos ?? {}) },
      });
      if (!res.ok) return void toast.error(res.error?.message ?? "Could not save attendance");
      toast.success(kind === "in" ? `Checked in at ${time}` : `Checked out at ${time}`);
      onDone(kind, time);
    } catch {
      toast.error("Could not save attendance. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const state = checkOut ? "Day complete" : checkIn ? "On duty" : "Not checked in";
  return (
    <Card className="p-5 lg:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Today's attendance</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums lg:text-4xl">{now ? now.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</p>
          <p className="text-sm text-muted-foreground">{now ? now.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}</p>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{status && status !== "Present" ? status : state}</p></div>
            <div><p className="text-xs text-muted-foreground">Check in</p><p className="font-medium tabular-nums">{checkIn ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Check out</p><p className="font-medium tabular-nums">{checkOut ?? "—"}</p></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:w-80">
          <Button size="lg" className="h-14 gap-2 text-base" disabled={!!busy || !!checkIn} onClick={() => void punch("in")}>
            {busy === "in" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}Check in
          </Button>
          <Button size="lg" variant="secondary" className="h-14 gap-2 text-base" disabled={!!busy || !checkIn || !!checkOut} onClick={() => void punch("out")}>
            {busy === "out" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}Check out
          </Button>
          <p className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" />Your location is recorded with each punch.</p>
        </div>
      </div>
    </Card>
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

  const [punched, setPunched] = useState<{ date: string; in?: string; out?: string }>({ date: "" });
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

  const today = localDate();
  const todayAtt = attendanceAll.find((a) => a.date === today);
  const local = punched.date === today ? punched : { date: today };
  const todayIn = todayAtt?.checkIn ?? local.in;
  const todayOut = todayAtt?.checkOut ?? local.out;
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
        <Button className="h-11 w-full gap-2 sm:w-auto"><CalendarPlus className="h-4 w-4" />Apply for leave</Button>
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
      <PunchCard checkIn={todayIn} checkOut={todayOut} status={todayAtt?.status}
        onDone={(kind, time) => {
          setPunched((p) => ({ ...(p.date === today ? p : { date: today }), [kind]: time }));
          invalidateStoreTable("attendance");
          setRefresh((n) => n + 1);
        }} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <SummaryCard title="Work permit" value={passDays === null ? "—" : `${passDays} days`} icon={<IdCard className="h-5 w-5" />} caption={`expires ${employee.workPermitExpiryDate || employee.passExpiry || "-"}`} />
        <SummaryCard title="This month" value={`${att.daysWorked} days`} icon={<CalendarCheck className="h-5 w-5" />} caption={`${att.normalHours}h + ${att.otHours}h OT`} />
        <SummaryCard title="Leave taken" value={`${approvedLeaveDays} days`} icon={<CalendarPlus className="h-5 w-5" />} caption={`${leaves.filter((l) => l.status === "Pending").length} pending`} />
        <SummaryCard title="Latest net pay" value={lastPayslip ? `$${lastPayslip.netPay.toLocaleString()}` : "—"} icon={<Wallet className="h-5 w-5" />} caption={lastPayslip ? lastPayslip.month : "No payslip yet"} />
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

  const attendance = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="att-month" className="shrink-0">Month</Label>
        <Input id="att-month" type="month" className="h-11" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Card><p className="text-xl font-semibold">{att.daysWorked}</p><p className="text-xs text-muted-foreground">Days worked</p></Card>
        <Card><p className="text-xl font-semibold">{att.normalHours}</p><p className="text-xs text-muted-foreground">Normal hrs</p></Card>
        <Card><p className="text-xl font-semibold">{att.otHours}</p><p className="text-xs text-muted-foreground">OT hrs</p></Card>
      </div>
      {att.rows.length === 0 ? <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="No attendance" description="No attendance recorded for this month." /> : (
        <div className="space-y-2">
          {att.rows.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-semibold">{new Date(a.date).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })}</p>
                <p className="text-xs text-muted-foreground">In {a.checkIn ?? "-"} · Out {a.checkOut ?? "-"}</p>
              </div>
              <div className="text-right">
                <StatusBadge label={a.status} />
                <p className="mt-1 text-xs text-muted-foreground">{a.hoursWorked}h + {a.overtimeHours}h OT</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const leave = (
    <div className="space-y-4">
      {leaveDialog}
      {leaves.length === 0 ? <EmptyState icon={<CalendarPlus className="h-5 w-5" />} title="No leave requests" description="Requests you submit will appear here." /> : (
        <div className="space-y-2">
          {leaves.map((l) => (
            <Card key={l.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-semibold">{l.type}</p>
                <p className="text-xs text-muted-foreground">{l.startDate} → {l.endDate} · {l.days} day(s)</p>
              </div>
              <StatusBadge label={l.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const payslipView = payslips.length === 0 ? <EmptyState icon={<Wallet className="h-5 w-5" />} title="No payslips" description="Your payslips will appear here once payroll is processed." /> : (
    <div className="space-y-3">
      {payslips.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">{p.month}</p>
            <StatusBadge label={p.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Basic</span><span className="text-right">${p.basicSalary.toLocaleString()}</span>
            <span className="text-muted-foreground">Overtime</span><span className="text-right">${p.overtimePay.toLocaleString()}</span>
            <span className="text-muted-foreground">Deductions</span><span className="text-right">-${(p.deductions + p.cpfEmployee).toLocaleString()}</span>
            <span className="font-semibold">Net pay</span><span className="text-right font-semibold">${p.netPay.toLocaleString()}</span>
          </div>
          <Button variant="outline" className="mt-3 h-10 w-full gap-2" onClick={() => void downloadPayslipPdf(p, { employee }).catch(() => toast.error("Could not create payslip PDF"))}>
            <Download className="h-4 w-4" />Download payslip
          </Button>
        </Card>
      ))}
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
          {worker && <h1 className="mb-3 text-xl font-semibold lg:mb-5 lg:text-2xl">{TABS.find((t) => t.id === tab)?.label}</h1>}
          {TABS.map((t) => <TabsContent key={t.id} value={t.id} className={worker ? "mt-0" : "mt-4"}>{views[t.id]}</TabsContent>)}
        </Tabs>
      </div>
    </PortalShell>
  );
}
