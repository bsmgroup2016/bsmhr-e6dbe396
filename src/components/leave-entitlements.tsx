/**
 * Statutory leave entitlement and balance view (Employment Act, Singapore).
 */
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Download, CalendarCheck } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { exportRows } from "@/lib/xlsx";
import type { Employee, LeaveRequest } from "@/lib/types";
import { leaveBalances, monthsOfService } from "@/lib/sg-leave";

interface Props {
  employees: Employee[];
  requests: LeaveRequest[];
}

export function LeaveEntitlements({ employees, requests }: Props) {
  const [employeeId, setEmployeeId] = useState<string>(employees[0]?.id ?? "");
  const employee = employees.find((e) => e.id === employeeId);
  const balances = useMemo(
    () => (employee ? leaveBalances(employee, requests) : []),
    [employee, requests],
  );

  function exportAll() {
    void exportRows(
      employees.flatMap((e) =>
        leaveBalances(e, requests).map((b) => ({
          Employee: e.name,
          "Employee code": e.employeeCode,
          "Leave type": b.type,
          Entitled: b.entitled,
          Taken: b.taken,
          Balance: b.balance,
          Note: b.note,
        })),
      ),
      "leave-entitlements", "Entitlements",
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Statutory leave entitlement</h2>
          <p className="text-xs text-muted-foreground">
            Annual leave 7–14 days by year of service, 14 days outpatient MC, 60 days hospitalisation,
            childcare, maternity / paternity and NS reservist leave.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} · {e.employeeCode}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportAll} disabled={!employees.length}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {!employee ? (
        <EmptyState className="mt-4 border-0 bg-transparent" icon={<CalendarCheck className="h-5 w-5" />} title="No employees" description="Add employees to see their leave entitlement." />
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            {employee.name} — {monthsOfService(employee)} months of service since {employee.joinedOn || "—"}
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave type</TableHead>
                  <TableHead>Entitled</TableHead>
                  <TableHead>Taken</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => (
                  <TableRow key={b.type}>
                    <TableCell className="font-medium">{b.type}</TableCell>
                    <TableCell>{b.entitled}</TableCell>
                    <TableCell className={b.taken > b.entitled ? "font-medium text-destructive" : ""}>{b.taken}</TableCell>
                    <TableCell>
                      <StatusBadge dot
                        variant={!b.eligible ? "default" : b.taken > b.entitled ? "destructive" : b.balance === 0 ? "warning" : "success"}
                        label={!b.eligible ? "Not yet eligible" : `${b.balance} days left`} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}