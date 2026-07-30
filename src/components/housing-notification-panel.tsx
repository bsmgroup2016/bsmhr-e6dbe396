import { useMemo, useState } from "react";
import { Download, MapPinned, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEmployees, getAllocations, getDormitories, updateEmployee } from "@/lib/store";
import { exportRows, timestampedName } from "@/lib/xlsx";
import {
  housingSync, housingNotificationRows, housingSummary, ADDRESS_NOTICE_DAYS,
  type HousingSyncRow,
} from "@/lib/housing";

const tone = (s: HousingSyncRow["status"]) =>
  s === "Overdue" ? "destructive" : s === "Pending" ? "warning" : s === "Synced" ? "success" : "ghost";

export function HousingNotificationPanel() {
  const [tick, setTick] = useState(0);
  const rows = useMemo(
    () => housingSync(getEmployees(), getAllocations(), getDormitories()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );
  const summary = housingSummary(rows);
  const outstanding = rows.filter((r) => r.status === "Pending" || r.status === "Overdue");

  const exportFile = async () => {
    const data = housingNotificationRows(rows);
    if (!data.length) return toast.info("No pending address notifications.");
    await exportRows(data, timestampedName("mom-address-notification", "xlsx"), "Address Update");
    toast.success(`${data.length} worker address update(s) exported for MOM submission.`);
  };

  const markSubmitted = (row: HousingSyncRow) => {
    updateEmployee(row.employee.id, { dormitoryAddress: row.actualAddress });
    setTick((t) => t + 1);
    toast.success(`${row.employee.name} — address marked as notified to MOM.`);
  };

  const markAllSubmitted = () => {
    outstanding.forEach((r) => updateEmployee(r.employee.id, { dormitoryAddress: r.actualAddress }));
    setTick((t) => t + 1);
    toast.success(`${outstanding.length} address notification(s) marked as submitted.`);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Notifiable workers" value={summary.total} icon={MapPinned} />
        <SummaryCard title="Address in sync" value={summary.synced} icon={CheckCircle2} />
        <SummaryCard title="Pending submission" value={summary.pending} icon={RefreshCw} />
        <SummaryCard title={`Overdue (> ${ADDRESS_NOTICE_DAYS} days)`} value={summary.overdue} icon={AlertTriangle} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground">
          MOM requires a work pass holder&apos;s residential address to be updated within{" "}
          {ADDRESS_NOTICE_DAYS} days of moving. Export the file, upload it to WP Online / OFWAS, then mark as submitted.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportFile}>
            <Download className="mr-2 h-4 w-4" /> Export MOM file ({outstanding.length})
          </Button>
          <Button size="sm" disabled={!outstanding.length} onClick={markAllSubmitted}>
            Mark all submitted
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="No notifiable workers"
          description="Active Work Permit / S Pass / EP holders will appear here once registered."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>FIN</TableHead>
                <TableHead>Declared to MOM</TableHead>
                <TableHead>Actual accommodation</TableHead>
                <TableHead>Move-in</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee.id}>
                  <TableCell className="font-medium">
                    {r.employee.name}
                    <div className="text-xs text-muted-foreground">{r.employee.employeeCode}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.employee.fin ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                    {r.declaredAddress || "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px] text-xs">{r.actualAddress || "—"}</TableCell>
                  <TableCell className="text-xs">{r.effectiveDate || "—"}</TableCell>
                  <TableCell className="text-right text-xs">{r.allocation ? r.daysElapsed : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge label={r.status} variant={tone(r.status)} dot />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "Pending" || r.status === "Overdue" ? (
                      <Button variant="ghost" size="sm" onClick={() => markSubmitted(r)}>
                        Mark submitted
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
