import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HardHat, Users, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEmployees, getAssignments, getCompanies } from "@/lib/store";
import { activeAssignedEmployeeIds, isEmployeeAvailable } from "@/lib/availability";
import { employeeSlugById } from "@/lib/employee-slug";
import { isCountableWorker } from "@/lib/workforce-split";

export const Route = createFileRoute("/_authenticated/available-workers")({
  head: () => ({
    meta: [
      { title: "Available Workers — BSM Workforce & Operations" },
      { name: "description", content: "Workers not assigned to any project, grouped by designation." },
      { property: "og:title", content: "Available Workers — BSM Workforce & Operations" },
      { property: "og:description", content: "Workers not assigned to any project, grouped by designation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AvailableWorkersPage,
});

function AvailableWorkersPage() {
  const employees = getEmployees().filter(isCountableWorker);
  const companies = getCompanies();
  const assignedIds = activeAssignedEmployeeIds(getAssignments());
  const available = employees.filter((e) => isEmployeeAvailable(e, assignedIds));

  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("all");
  const [company, setCompany] = useState("all");
  const [nationality, setNationality] = useState("all");

  const trades = Array.from(new Set(available.map((e) => e.trade).filter(Boolean))).sort();
  const nationalities = Array.from(new Set(available.map((e) => e.nationality).filter(Boolean))).sort();

  const byTrade = trades
    .map((t) => ({ trade: t, count: available.filter((e) => e.trade === t).length }))
    .sort((a, b) => b.count - a.count);

  const q = search.toLowerCase();
  const rows = available.filter(
    (e) =>
      (e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.passportNumber ?? "").toLowerCase().includes(q)) &&
      (trade === "all" || e.trade === trade) &&
      (company === "all" || e.companyId === company) &&
      (nationality === "all" || e.nationality === nationality),
  );

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Available Workers</h1>
            <p className="text-sm text-muted-foreground">
              Workers who are not assigned to any project right now.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/deployed-workers">Deployed workers</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Available now" value={String(available.length)} icon={<HardHat className="h-5 w-5" />} variant="success" caption="Free for deployment" compact />
          <SummaryCard title="Designations free" value={String(byTrade.length)} icon={<Users className="h-5 w-5" />} variant="primary" caption="Distinct trades" compact />
          <SummaryCard title="Deployed" value={String(assignedIds.size)} icon={<Users className="h-5 w-5" />} variant="info" caption="On projects" compact />
          <SummaryCard title="Total workforce" value={String(employees.length)} icon={<Users className="h-5 w-5" />} variant="primary" caption="All workers" compact />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Free by designation</h2>
          {byTrade.length === 0 ? (
            <p className="text-sm text-muted-foreground">No available workers.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {byTrade.map((t) => (
                <button
                  key={t.trade}
                  onClick={() => setTrade(trade === t.trade ? "all" : t.trade)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    trade === t.trade
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  {t.trade} · {t.count}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name, P-File, passport..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Designation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All designations</SelectItem>
                {trades.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={nationality} onValueChange={setNationality}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Nationality" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All nationalities</SelectItem>
                {nationalities.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Pass</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <EmptyState className="border-0 bg-transparent" icon={<HardHat className="h-5 w-5" />} title="No available workers" description="Everyone matching these filters is deployed." />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link to="/workforce/$slug" params={{ slug: employeeSlugById(e.id) }} className="font-medium text-primary hover:underline">
                          {e.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          P-File No: {e.employeeCode} · {e.nationality}
                        </div>
                      </TableCell>
                      <TableCell>{companies.find((c) => c.id === e.companyId)?.name ?? "—"}</TableCell>
                      <TableCell>{e.trade}</TableCell>
                      <TableCell>
                        <div>{e.passType}</div>
                        <div className="text-xs text-muted-foreground">{e.passExpiry}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant="success" label={e.status} dot />
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