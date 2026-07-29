import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, CalendarDays, CheckCircle2, Clock, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { notifyLeaveDecision } from "@/lib/notify";
import { ExportButton } from "@/components/data-io";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  getEmployees,
  getLeaveRequests,
  addLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  approveLeaveRequest,
  countLeaveDays,
  getCurrentCompany,
} from "@/lib/store";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/lib/types";

const leaveTypes: LeaveType[] = [
  "Annual Leave",
  "Medical Leave",
  "Hospitalisation Leave",
  "Unpaid Leave",
  "Home Leave",
  "Compassionate Leave",
];

const leaveStatuses: LeaveStatus[] = ["Pending", "Approved", "Rejected", "Cancelled"];

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({
    meta: [
      { title: "Leave Management — BSM Workforce & Operations" },
      { name: "description", content: "Apply, approve and track worker leave with attendance sync." },
      { property: "og:title", content: "Leave Management — BSM Workforce & Operations" },
      { property: "og:description", content: "Apply, approve and track worker leave with attendance sync." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeavePage,
});

export default function LeavePage() {
  const [leaves, setLeaves] = useState(getLeaveRequests());
  const [employees] = useState(getEmployees());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const companyId = getCurrentCompany();
  const companyEmployees = employees.filter((e) => !companyId || e.companyId === companyId);

  function refresh() {
    setLeaves(getLeaveRequests());
  }

  const filtered = leaves.filter((l) => {
    const emp = employees.find((e) => e.id === l.employeeId);
    const q = search.toLowerCase();
    const matchesCompany = !companyId || emp?.companyId === companyId;
    const matchesSearch =
      !q ||
      emp?.name.toLowerCase().includes(q) ||
      emp?.employeeCode.toLowerCase().includes(q) ||
      l.type.toLowerCase().includes(q);
    return matchesCompany && matchesSearch && (statusFilter === "all" || l.status === statusFilter);
  });

  const pending = filtered.filter((l) => l.status === "Pending").length;
  const approved = filtered.filter((l) => l.status === "Approved").length;
  const totalDays = filtered.filter((l) => l.status === "Approved").reduce((s, l) => s + l.days, 0);
  const onLeaveToday = leaves.filter((l) => {
    const today = new Date().toISOString().slice(0, 10);
    return l.status === "Approved" && l.startDate <= today && l.endDate >= today;
  }).length;

  function handleCreate(formData: FormData) {
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    if (!startDate || !endDate || countLeaveDays(startDate, endDate) === 0) {
      toast.error("End date must be on or after the start date");
      return;
    }
    addLeaveRequest({
      employeeId: formData.get("employeeId") as string,
      type: formData.get("type") as LeaveType,
      startDate,
      endDate,
      reason: (formData.get("reason") as string) || undefined,
      status: "Pending",
    });
    setIsCreateOpen(false);
    refresh();
    toast.success("Leave request submitted for approval");
  }

  function approve(row: LeaveRequest) {
    approveLeaveRequest(row.id);
    void notifyLeaveDecision(row.id, "Approved");
    refresh();
    toast.success(`Approved — ${row.days} day(s) pushed to attendance`);
  }

  function reject(row: LeaveRequest) {
    updateLeaveRequest(row.id, { status: "Rejected" });
    void notifyLeaveDecision(row.id, "Rejected");
    refresh();
    toast.success("Leave request rejected");
  }

  function remove(row: LeaveRequest) {
    deleteLeaveRequest(row.id);
    refresh();
    toast.success("Leave request deleted");
  }

  const exportRowsData = filtered.map((l) => {
    const emp = employees.find((e) => e.id === l.employeeId);
    return {
      "Employee Code": emp?.employeeCode ?? "",
      Name: emp?.name ?? "",
      Type: l.type,
      From: l.startDate,
      To: l.endDate,
      Days: l.days,
      Status: l.status,
      Reason: l.reason ?? "",
    };
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leave Management</h1>
            <p className="text-sm text-muted-foreground">
              Apply, approve and sync leave into daily attendance.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Apply leave
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Apply leave</DialogTitle>
                  <DialogDescription>Submit a leave request for approval.</DialogDescription>
                </DialogHeader>
                <LeaveForm employees={companyEmployees} onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
            <ExportButton rows={exportRowsData} baseName="leave" sheetName="Leave" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Pending" value={pending.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Awaiting approval" />
          <SummaryCard title="Approved" value={approved.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="This list" />
          <SummaryCard title="On leave today" value={onLeaveToday.toString()} icon={<CalendarDays className="h-5 w-5" />} variant="info" caption={new Date().toISOString().slice(0, 10)} />
          <SummaryCard title="Approved days" value={totalDays.toString()} icon={<CalendarDays className="h-5 w-5" />} variant="primary" caption="Total" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search worker or leave type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeaveStatus | "all")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {leaveStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <EmptyState
                        className="border-0 bg-transparent"
                        icon={<CalendarDays className="h-5 w-5" />}
                        title="No leave requests"
                        description="Apply leave to start the approval workflow."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => {
                    const emp = employees.find((e) => e.id === l.employeeId);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{emp?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{emp?.employeeCode}</div>
                        </TableCell>
                        <TableCell>{l.type}</TableCell>
                        <TableCell>{l.startDate}</TableCell>
                        <TableCell>{l.endDate}</TableCell>
                        <TableCell>{l.days}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={
                              l.status === "Approved"
                                ? "success"
                                : l.status === "Pending"
                                  ? "warning"
                                  : l.status === "Rejected"
                                    ? "destructive"
                                    : "info"
                            }
                            label={l.status}
                            dot
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {l.status === "Pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="secondary" onClick={() => approve(l)}>
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => reject(l)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => remove(l)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LeaveForm({
  employees,
  onSubmit,
}: {
  employees: ReturnType<typeof getEmployees>;
  onSubmit: (data: FormData) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const days = countLeaveDays(startDate, endDate);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <Label htmlFor="employeeId">Employee</Label>
        <Select name="employeeId" required>
          <SelectTrigger id="employeeId">
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} · {e.employeeCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="type">Leave type</Label>
        <Select name="type" defaultValue="Annual Leave">
          <SelectTrigger id="type">
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="startDate">From</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">To</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Total: <span className="font-medium text-foreground">{days}</span> day(s)
      </p>

      <div className="space-y-1">
        <Label htmlFor="reason">Reason</Label>
        <Textarea id="reason" name="reason" rows={3} placeholder="Optional" />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={days === 0}>
          Submit request
        </Button>
      </DialogFooter>
    </form>
  );
}