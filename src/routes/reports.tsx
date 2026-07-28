import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  AlertTriangle,
  Download,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExportButton } from "@/components/data-io";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { getEmployees, getProjects, getSites, getAssignments, getDocuments, getPayroll } from "@/lib/store";
import { exportSheets, timestampedName } from "@/lib/xlsx";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — BSM Workforce & Operations" },
      { name: "description", content: "Workforce and operational reports." },
      { property: "og:title", content: "Reports — BSM Workforce & Operations" },
      { property: "og:description", content: "Workforce and operational reports." },
    ],
  }),
  component: ReportsPage,
});

export default function ReportsPage() {
  const [employees] = useState(getEmployees());
  const [projects] = useState(getProjects());
  const [sites] = useState(getSites());
  const [assignments] = useState(getAssignments());
  const [documents] = useState(getDocuments());
  const [payroll] = useState(getPayroll());
  const [report, setReport] = useState("manpower");

  const activeEmployees = employees.filter((e) => e.status === "Active" || e.status === "Deployed").length;
  const deployedCount = employees.filter((e) => e.status === "Deployed").length;
  const expiringDocs = documents.filter((d) => d.status === "Expiring Soon" || d.status === "Expired").length;
  const totalPayroll = payroll.reduce((s, p) => s + p.netPay, 0);

  const siteCoverage = sites.map((s) => {
    const assigned = assignments.filter((a) => a.siteId === s.id && a.status === "Active").length;
    const gap = Math.max(0, s.requiredWorkers - assigned);
    return { ...s, assigned, gap };
  });

  const passTypeCount = employees.reduce((acc, e) => {
    acc[e.passType] = (acc[e.passType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const manpowerRows = siteCoverage.map((s) => ({
    Site: s.name,
    Project: projects.find((p) => p.id === s.projectId)?.name ?? "",
    Required: s.requiredWorkers,
    Assigned: s.assigned,
    Gap: s.gap,
    Status: s.gap === 0 ? "Fully covered" : "Shortfall",
  }));

  const passRows = Object.entries(passTypeCount).map(([type, count]) => ({
    "Pass Type": type,
    Workers: count,
    Share: `${((count / (employees.length || 1)) * 100).toFixed(1)}%`,
  }));

  const documentRows = documents.map((d) => ({
    Employee: employees.find((e) => e.id === d.employeeId)?.name ?? "",
    Type: d.type,
    Document: d.name,
    "Issue Date": d.issueDate ?? "",
    "Expiry Date": d.expiryDate ?? "",
    Status: d.status,
  }));

  const payrollRows = payroll.map((p) => ({
    Month: p.month,
    Employee: employees.find((e) => e.id === p.employeeId)?.name ?? "",
    "Basic Salary": p.basicSalary,
    "Overtime Pay": p.overtimePay,
    Levies: p.levies,
    "Net Pay": p.netPay,
    Status: p.status,
  }));

  const currentRows =
    report === "manpower"
      ? manpowerRows
      : report === "passes"
        ? passRows
        : report === "documents"
          ? documentRows
          : payrollRows;

  async function exportFullPack() {
    await exportSheets(
      [
        { name: "Manpower by site", rows: manpowerRows },
        { name: "Pass types", rows: passRows },
        { name: "Document compliance", rows: documentRows },
        { name: "Payroll summary", rows: payrollRows },
        {
          name: "Employees",
          rows: employees.map((e) => ({
            "Employee Code": e.employeeCode,
            Name: e.name,
            FIN: e.fin,
            "Pass Type": e.passType,
            "Pass Expiry": e.passExpiry,
            Trade: e.trade,
            Site: e.site ?? "",
            Status: e.status,
            "Basic Salary": e.basicSalary,
          })),
        },
      ],
      timestampedName("bsm_report_pack", "xlsx"),
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">Workforce, compliance, and financial summaries.</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <ExportButton rows={currentRows} baseName={`report_${report}`} sheetName="Report" label="Export report" />
            <Button size="sm" onClick={exportFullPack}>
              <Download className="mr-1 h-4 w-4" />
              Full Excel pack
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Active workers" value={activeEmployees.toString()} icon={<Users className="h-5 w-5" />} variant="primary" caption="Ready / deployed" />
          <SummaryCard title="Deployed" value={deployedCount.toString()} icon={<Briefcase className="h-5 w-5" />} variant="success" caption="On site now" />
          <SummaryCard title="Expiring docs" value={expiringDocs.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" caption="Action needed" />
          <SummaryCard title="Total payroll" value={`S$${totalPayroll.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant="info" caption="All months" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Label className="text-sm font-medium">Report</Label>
            <Select value={report} onValueChange={setReport}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manpower">Manpower by site</SelectItem>
                <SelectItem value="passes">Pass types</SelectItem>
                <SelectItem value="documents">Document compliance</SelectItem>
                <SelectItem value="payroll">Payroll summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {report === "manpower" && (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Gap</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siteCoverage.map((s) => {
                    const project = projects.find((p) => p.id === s.projectId);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{project?.name}</TableCell>
                        <TableCell>{s.requiredWorkers}</TableCell>
                        <TableCell>{s.assigned}</TableCell>
                        <TableCell>{s.gap}</TableCell>
                        <TableCell>
                          <StatusBadge variant={s.gap > 0 ? "warning" : "success"} label={s.gap > 0 ? "Understaffed" : "Fully staffed"} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {report === "passes" && (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pass type</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>% of workforce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(passTypeCount).map(([type, count]) => (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{type}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>{((count / employees.length) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {report === "documents" && (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents
                    .filter((d) => d.status === "Expiring Soon" || d.status === "Expired")
                    .map((d) => {
                      const emp = employees.find((e) => e.id === d.employeeId);
                      return (
                        <TableRow key={d.id}>
                          <TableCell>{emp?.name} ({emp?.employeeCode})</TableCell>
                          <TableCell>{d.name}</TableCell>
                          <TableCell>{d.expiryDate}</TableCell>
                          <TableCell>
                            <StatusBadge variant={d.status === "Expired" ? "destructive" : "warning"} label={d.status} dot />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}

          {report === "payroll" && (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Net pay</TableHead>
                    <TableHead>CPF employee</TableHead>
                    <TableHead>Levies</TableHead>
                    <TableHead>Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(new Set(payroll.map((p) => p.month))).map((month) => {
                    const entries = payroll.filter((p) => p.month === month);
                    const net = entries.reduce((s, p) => s + p.netPay, 0);
                    const cpf = entries.reduce((s, p) => s + p.cpfEmployee, 0);
                    const levies = entries.reduce((s, p) => s + p.levies, 0);
                    return (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{month}</TableCell>
                        <TableCell>S$ {net.toLocaleString()}</TableCell>
                        <TableCell>S$ {cpf.toLocaleString()}</TableCell>
                        <TableCell>S$ {levies.toLocaleString()}</TableCell>
                        <TableCell>{entries.length}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
