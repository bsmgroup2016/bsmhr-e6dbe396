import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  X,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  FileCheck,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getApprovals, getUsers, getCurrentUser, updateApproval } from "@/lib/store";
import type { Approval, ApprovalStatus, ApprovalType } from "@/lib/types";

const approvalTypes: ApprovalType[] = ["Assignment", "Leave", "Payroll", "Overtime", "Transfer", "Termination", "Document", "Other"];
const approvalStatuses: ApprovalStatus[] = ["Pending", "Approved", "Rejected", "Escalated"];

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — BSM Workforce & Operations" },
      { name: "description", content: "Review and approve workflow requests." },
      { property: "og:title", content: "Approvals — BSM Workforce & Operations" },
      { property: "og:description", content: "Review and approve workflow requests." },
    ],
  }),
  component: ApprovalsPage,
});

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState(getApprovals());
  const [users] = useState(getUsers());
  const currentUser = getCurrentUser();
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">("Pending");
  const [typeFilter, setTypeFilter] = useState<ApprovalType | "all">("all");
  const [selected, setSelected] = useState<Approval | null>(null);
  const [notes, setNotes] = useState("");

  const filtered = approvals.filter((a) => {
    return (statusFilter === "all" || a.status === statusFilter) && (typeFilter === "all" || a.type === typeFilter);
  });

  const pendingCount = approvals.filter((a) => a.status === "Pending").length;
  const approvedCount = approvals.filter((a) => a.status === "Approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "Rejected").length;

  function refresh() {
    setApprovals(getApprovals());
  }

  function decide(status: ApprovalStatus) {
    if (!selected) return;
    updateApproval(selected.id, {
      status,
      approverId: currentUser?.id,
      approverName: currentUser?.name,
      approverNotes: notes,
      decidedAt: new Date().toISOString(),
    });
    setSelected(null);
    setNotes("");
    refresh();
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Approvals</h1>
            <p className="text-sm text-muted-foreground">Review pending requests and approve or reject.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Pending" value={pendingCount.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Needs action" />
          <SummaryCard title="Approved" value={approvedCount.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="This month" />
          <SummaryCard title="Rejected" value={rejectedCount.toString()} icon={<XCircle className="h-5 w-5" />} variant="destructive" caption="This month" />
          <SummaryCard title="Total" value={approvals.length.toString()} icon={<FileCheck className="h-5 w-5" />} variant="primary" caption="All requests" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ApprovalStatus | "all")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {approvalStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ApprovalType | "all")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {approvalTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<FileCheck className="h-5 w-5" />} title="No approvals" description="There are no matching requests." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(a)}>
                      <TableCell>{a.type}</TableCell>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>
                        <div>{a.requestedByName}</div>
                        <div className="text-xs text-muted-foreground">{a.requestedBy}</div>
                      </TableCell>
                      <TableCell>{new Date(a.requestedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={a.status === "Pending" ? "warning" : a.status === "Approved" ? "success" : a.status === "Rejected" ? "destructive" : "info"}
                          label={a.status}
                          dot
                        />
                      </TableCell>
                      <TableCell>
                        {a.status === "Pending" ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={(evt) => { evt.stopPropagation(); setSelected(a); }}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(evt) => { evt.stopPropagation(); setSelected(a); }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={(evt) => { evt.stopPropagation(); setSelected(a); }}>
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected?.title}</DialogTitle>
              <DialogDescription>
                {selected?.type} request by {selected?.requestedByName} on {selected?.requestedAt ? new Date(selected.requestedAt).toLocaleDateString() : "—"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-medium text-muted-foreground">Payload</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selected?.payload}</p>
              </div>
              {selected?.status !== "Pending" && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm font-medium text-muted-foreground">Decision</p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{selected?.approverName}</span> · {selected?.decidedAt ? new Date(selected.decidedAt).toLocaleDateString() : "—"}
                  </p>
                  {selected?.approverNotes && <p className="mt-1 text-sm text-muted-foreground">{selected.approverNotes}</p>}
                </div>
              )}
              {selected?.status === "Pending" && (
                <div className="space-y-2">
                  <Label htmlFor="notes">Approver notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for decision..." />
                </div>
              )}
            </div>
            <DialogFooter>
              {selected?.status === "Pending" ? (
                <>
                  <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={() => decide("Rejected")}>Reject</Button>
                  <Button onClick={() => decide("Approved")}>Approve</Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
