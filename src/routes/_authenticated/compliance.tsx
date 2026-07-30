import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, AlertTriangle, CalendarClock, Search, Download, FileText, Eye } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getEmployees, getDocuments, getCurrentCompany } from "@/lib/store";
import { buildComplianceItems, severityLabel, severityVariant, type ComplianceSeverity } from "@/lib/compliance";
import { openR2File } from "@/lib/r2";
import { exportRows } from "@/lib/xlsx";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance & Expiry — BSM Workforce & Operations" },
      { name: "description", content: "Work pass, passport and document expiry tracking for MOM compliance." },
      { property: "og:title", content: "Compliance & Expiry — BSM Workforce & Operations" },
      { property: "og:description", content: "Work pass, passport and document expiry tracking for MOM compliance." },
    ],
  }),
  component: CompliancePage,
});

const WINDOWS = [
  { value: "30", label: "Next 30 days" },
  { value: "60", label: "Next 60 days" },
  { value: "90", label: "Next 90 days" },
  { value: "180", label: "Next 180 days" },
  { value: "all", label: "All records" },
];

export default function CompliancePage() {
  const companyId = getCurrentCompany();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<ComplianceSeverity | "all">("all");
  const [windowFilter, setWindowFilter] = useState<string>("90");

  const items = useMemo(() => {
    const all = buildComplianceItems(getEmployees(), getDocuments());
    return companyId ? all.filter((i) => !i.companyId || i.companyId === companyId) : all;
  }, [companyId]);

  const expiredCount = items.filter((i) => i.severity === "expired").length;
  const criticalCount = items.filter((i) => i.severity === "critical").length;
  const warningCount = items.filter((i) => i.severity === "warning").length;

  const filtered = items.filter((i) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      i.employeeName.toLowerCase().includes(q) ||
      i.employeeCode.toLowerCase().includes(q) ||
      i.label.toLowerCase().includes(q) ||
      (i.reference ?? "").toLowerCase().includes(q);
    const inWindow = windowFilter === "all" || i.daysLeft <= Number(windowFilter);
    return (
      matchesSearch &&
      inWindow &&
      (categoryFilter === "all" || i.category === categoryFilter) &&
      (severityFilter === "all" || i.severity === severityFilter)
    );
  });

  function handleExport() {
    void exportRows(
      filtered.map((i) => ({
        "Employee code": i.employeeCode,
        Employee: i.employeeName,
        Category: i.category,
        Item: i.label,
        Reference: i.reference ?? "",
        "Expiry date": i.expiryDate,
        "Days left": i.daysLeft,
        Status: severityLabel[i.severity],
      })),
      "compliance-expiry", "Expiry",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Compliance & Expiry</h1>
            <p className="text-sm text-muted-foreground">
              Work passes, passports and documents in one MOM-compliance watchlist.
            </p>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Tracked items" value={items.length.toString()} icon={<ShieldCheck className="h-5 w-5" />} variant="primary" caption="Passes, passports, documents" />
          <SummaryCard title="Expired" value={expiredCount.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" caption="Immediate action" />
          <SummaryCard title="Within 30 days" value={criticalCount.toString()} icon={<CalendarClock className="h-5 w-5" />} variant="warning" caption="Start renewal now" />
          <SummaryCard title="Within 90 days" value={warningCount.toString()} icon={<CalendarClock className="h-5 w-5" />} variant="default" caption="Plan ahead" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search employee, item or number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={windowFilter} onValueChange={setWindowFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WINDOWS.map((w) => (<SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="Work Pass">Work Pass</SelectItem>
                  <SelectItem value="Passport">Passport</SelectItem>
                  <SelectItem value="Document">Document</SelectItem>
                  <SelectItem value="Medical">Medical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as ComplianceSeverity | "all")}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="critical">≤ 30 days</SelectItem>
                  <SelectItem value="warning">≤ 90 days</SelectItem>
                  <SelectItem value="ok">Valid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Days left</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <EmptyState className="border-0 bg-transparent" icon={<ShieldCheck className="h-5 w-5" />} title="Nothing expiring" description="No records match this window." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="font-medium">{i.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{i.employeeCode}</div>
                      </TableCell>
                      <TableCell>{i.category}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{i.label}</TableCell>
                      <TableCell className="font-mono text-xs">{i.reference || "—"}</TableCell>
                      <TableCell>{i.expiryDate}</TableCell>
                      <TableCell className={i.daysLeft < 0 ? "font-medium text-destructive" : ""}>
                        {i.daysLeft < 0 ? `${Math.abs(i.daysLeft)} days ago` : `${i.daysLeft} days`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={severityVariant[i.severity]} label={severityLabel[i.severity]} dot />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {i.fileUrl && (
                            <Button size="icon" variant="ghost" title="Open file" onClick={() => void openR2File(i.fileUrl!)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" asChild title="Open profile">
                            <Link to="/workforce/$id" params={{ id: i.employeeId }}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}