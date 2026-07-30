import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, FileText, IdCard, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  getEmployees,
  getLeaveByEmployee,
  getPayrollByEmployee,
} from "@/lib/store";
import type { LeaveType } from "@/lib/types";

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

function MyPortalPage() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? "";
  const [refresh, setRefresh] = useState(0);
  const employee = useMemo(
    () =>
      getEmployees().find(
        (e) => (user?.id && e.userId === user.id) || (!!email && (e.email ?? "").toLowerCase() === email),
      ),
    [email, user?.id, refresh],
  );

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LeaveType>("Annual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const documents = useMemo(
    () => (employee ? getDocumentsByEmployee(employee.id) : []),
    [employee, refresh],
  );
  const payslips = useMemo(
    () => (employee ? getPayrollByEmployee(employee.id) : []),
    [employee, refresh],
  );
  const leaves = useMemo(
    () => (employee ? getLeaveByEmployee(employee.id) : []),
    [employee, refresh],
  );

  if (!employee) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={<UserRound className="h-5 w-5" />}
            title="No employee record linked"
            description={`No employee profile matches ${email || "your account"}. Ask an administrator to set your work email on your employee record.`}
          />
        </div>
      </AppShell>
    );
  }

  const passDays = daysUntil(employee.passExpiry);
  const approvedLeaveDays = leaves
    .filter((l) => l.status === "Approved")
    .reduce((sum, l) => sum + l.days, 0);
  const lastPayslip = [...payslips].sort((a, b) => b.month.localeCompare(a.month))[0];

  const submit = () => {
    if (!startDate || !endDate) {
      toast.error("Select start and end dates");
      return;
    }
    const days = countLeaveDays(startDate, endDate);
    if (days <= 0) {
      toast.error("End date must be on or after the start date");
      return;
    }
    addLeaveRequest({
      employeeId: employee.id,
      type,
      startDate,
      endDate,
      reason: reason || undefined,
      status: "Pending",
    });
    toast.success("Leave request submitted for approval");
    setOpen(false);
    setStartDate("");
    setEndDate("");
    setReason("");
    setRefresh((n) => n + 1);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Portal</h1>
            <p className="text-sm text-muted-foreground">
              {employee.name} · {employee.employeeCode} · {employee.trade}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <CalendarPlus className="h-4 w-4" />
                Apply for leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for leave</DialogTitle>
                <DialogDescription>
                  Your request goes to the approvals queue for review.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Leave type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Reason</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submit}>Submit request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Pass status"
            value={passDays === null ? "—" : `${passDays} days`}
            icon={<IdCard className="h-5 w-5" />}
            caption={`${employee.passType} · expires ${employee.passExpiry}`}
          />
          <SummaryCard
            title="Leave taken"
            value={`${approvedLeaveDays} days`}
            icon={<CalendarPlus className="h-5 w-5" />}
            caption={`${leaves.filter((l) => l.status === "Pending").length} pending`}
          />
          <SummaryCard
            title="Latest net pay"
            value={lastPayslip ? `$${lastPayslip.netPay.toLocaleString()}` : "—"}
            icon={<Wallet className="h-5 w-5" />}
            caption={lastPayslip ? lastPayslip.month : "No payslip yet"}
          />
          <SummaryCard
            title="Documents"
            value={String(documents.length)}
            icon={<FileText className="h-5 w-5" />}
            caption={`${documents.filter((d) => d.verified).length} verified`}
          />
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="edit">Edit my profile</TabsTrigger>
            <TabsTrigger value="leave">My leave</TabsTrigger>
            <TabsTrigger value="payslips">Payslips</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["P-File No", employee.employeeCode],
                ["Full name", employee.name],
                ["Nationality", employee.nationality],
                ["FIN / NRIC", employee.fin],
                ["Pass type", employee.passType],
                ["Pass expiry", employee.passExpiry],
                ["Designation", employee.trade],
                ["Site", employee.site ?? "Unassigned"],
                ["Status", employee.status],
                ["Joined on", employee.joinedOn],
                ["Phone", employee.phone ?? "-"],
                ["Email", employee.email ?? "-"],
                ["Dormitory", employee.dormitory ?? "-"],
                ["Emergency contact", employee.emergencyContact ?? "-"],
                ["Emergency phone", employee.emergencyPhone ?? "-"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="edit" className="mt-4 space-y-3">
            {employee.status === "Pending Profile Completion" ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Your profile is incomplete. Fill in the details below and submit for HR verification.
              </div>
            ) : employee.status === "Pending Verification" ? (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
                Submitted — waiting for HR verification. You can still update your details.
              </div>
            ) : null}
            <SelfProfileForm employee={employee} onSaved={() => setRefresh((n) => n + 1)} />
          </TabsContent>

          <TabsContent value="leave" className="mt-4">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                        No leave requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaves.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.type}</TableCell>
                        <TableCell>{l.startDate}</TableCell>
                        <TableCell>{l.endDate}</TableCell>
                        <TableCell>{l.days}</TableCell>
                        <TableCell>
                          <StatusBadge label={l.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payslips" className="mt-4">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Overtime</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        No payslips available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...payslips]
                      .sort((a, b) => b.month.localeCompare(a.month))
                      .map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.month}</TableCell>
                          <TableCell className="text-right">{p.basicSalary.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{p.overtimePay.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {(p.deductions + p.cpfEmployee).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {p.netPay.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <StatusBadge label={p.status} />
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                        No documents on file.
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>{d.type}</TableCell>
                        <TableCell>{d.expiryDate ?? "-"}</TableCell>
                        <TableCell>
                          <StatusBadge label={d.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
