import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Building2, Download, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ClaimSalaryAiReview } from "@/components/claim-salary-ai-review";
import { claimSalaryReviewSnapshot } from "@/core/claim-salary-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { companyClaimSummaries, NO_COMPANY, type CompanyClaimSummary } from "@/core/company-claim-summary";
import { createAllCompanyClaimWorkbook, downloadCompanyClaimWorkbook } from "@/lib/company-claim-export";
import { claimWorkbookBlob, downloadClaimBlob } from "@/lib/combined-claim-export";
import { claimCompanyCards, claimSalaryRows, eligibleClaimSummaries } from "@/core/claim-workflow";
import {
  ALL,
  claimFilterCompanyOptions,
  claimSalaryStatuses,
  emptyClaimFilter,
  filterClaimSummaries,
  filterSalaryRows,
  isClaimFilterActive,
  type ClaimFilter,
} from "@/core/claim-filters";
import { exportRows } from "@/lib/xlsx";
import { getClaimSheets, getClients, getCompanies, getEmployees, getPayroll, getProjects, getSites, subscribe } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/claim-workflow")({
  head: () => ({
    meta: [
      { title: "Salary sheet generator — BSM HR" },
      { name: "description", content: "Company claim summaries, all-company combined claim workbook and monthly salary sheet." },
      { property: "og:title", content: "Claim & salary workflow — BSM HR" },
      { property: "og:description", content: "Company summaries, combined claims and salary sheets for each claim month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClaimWorkflowPage,
});

const STEPS = ["Company claim summary", "Combined claim sheet", "Salary sheet"];
const lastMonth = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
const hours = (n: number) => n.toLocaleString("en-SG", { maximumFractionDigits: 2 });

function ClaimWorkflowPage() {
  const [month, setMonth] = useState(lastMonth);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<ClaimFilter>(emptyClaimFilter);
  useEffect(() => subscribe(() => setRevision(n => n + 1)), []);

  const { summaries, error } = useMemo(() => {
    try {
      return { summaries: companyClaimSummaries(getClaimSheets(), getEmployees(), getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients() }), error: null };
    } catch (e) {
      return { summaries: [] as CompanyClaimSummary[], error: e instanceof Error ? e.message : "Could not read the claims" };
    }
  }, [month, revision]);

  const companies = getCompanies();
  const companyOptions = claimFilterCompanyOptions(summaries, companies);
  const filterCompanyLabel = filter.company === ALL ? null : companyOptions.find(o => o.value === filter.company)?.label ?? null;
  const hasFilters = isClaimFilterActive(filter);
  const clearFilters = () => setFilter(emptyClaimFilter());

  // Every table and every Excel download reads these filtered sets, so the file matches the screen.
  const visibleSummaries = filterClaimSummaries(summaries, filter);
  const companyCards = filterClaimSummaries(claimCompanyCards(summaries, companies), filter);
  const eligible = eligibleClaimSummaries(visibleSummaries);
  const allSalaryRows = claimSalaryRows(summaries, getEmployees(), getPayroll(), month);
  const salaryRows = filterSalaryRows(allSalaryRows, filter, filterCompanyLabel);
  const statusOptions = claimSalaryStatuses(allSalaryRows);
  const scopeName = filterCompanyLabel ? filterCompanyLabel.toUpperCase() : "ALL COMPANIES";
  const incompleteSalary = salaryRows.filter(row => row["Net pay (SGD)"] === null);
  const totalNormal = eligible.reduce((n, s) => n + s.projects.reduce((v, p) => v + p.normalHours, 0), 0);
  const totalOt = eligible.reduce((n, s) => n + s.projects.reduce((v, p) => v + p.otHours, 0), 0);

  async function downloadAll() {
    setBusy("combined");
    try {
      const workbook = await createAllCompanyClaimWorkbook(eligible, getEmployees(), getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients() });
      downloadClaimBlob(await claimWorkbookBlob(workbook), `${scopeName} COMBINED CLAIM - ${month}.xlsx`);
      toast.success("Combined claim sheet downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the combined claim sheet");
    } finally { setBusy(null); }
  }

  async function downloadSalary() {
    setBusy("salary");
    try {
      await exportRows(salaryRows, `SALARY SHEET - ${month}${filterCompanyLabel ? ` - ${filterCompanyLabel}` : ""}.xlsx`, "SALARY SHEET");
      toast.success("Salary sheet downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the salary sheet");
    } finally { setBusy(null); }
  }

  async function download(summary: CompanyClaimSummary) {
    setBusy(summary.companyId);
    try {
      await downloadCompanyClaimWorkbook(summary, getEmployees(), getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients() });
      toast.success(`${summary.companyName}: Excel downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the Excel");
    } finally {
      setBusy(null);
    }
  }

  const noClaims = summaries.length === 0;
  const noMatches = hasFilters && (step === 2 ? salaryRows.length === 0 : eligible.length === 0);

  return (
    <AppShell>
      <div className="space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Salary sheet generator</h1>
          <p className="text-sm text-muted-foreground">Claim period · {month}</p>
        </div>

        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s}>
              <Button variant={step === i ? "default" : "outline"} onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined} className="h-auto min-h-14 w-full justify-start whitespace-normal text-left">
                {i + 1}. {s}
              </Button>
            </li>
          ))}
        </ol>

        <div className="space-y-3 rounded-[10px] border bg-card p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="claim-month">Claim month</Label>
              <Input id="claim-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="claim-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="claim-search"
                  type="search"
                  placeholder="Worker, P-File, project, site or client…"
                  value={filter.search}
                  onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="claim-company">Company</Label>
              <Select value={filter.company} onValueChange={(v) => setFilter(f => ({ ...f, company: v }))}>
                <SelectTrigger id="claim-company" aria-label="Filter by company" className="w-48">
                  <Building2 className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All companies</SelectItem>
                  {companyOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {step === 2 && (
              <div className="space-y-1">
                <Label htmlFor="claim-status">Status</Label>
                <Select value={filter.status} onValueChange={(v) => setFilter(f => ({ ...f, status: v }))}>
                  <SelectTrigger id="claim-status" aria-label="Filter by payroll status" className="w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All status</SelectItem>
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-10">
                <X className="mr-1 h-4 w-4" /> Clear filters
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {hasFilters
              ? `${eligible.length} of ${summaries.length} companies with claims match${step === 2 ? ` · ${salaryRows.length} of ${allSalaryRows.length} salary rows` : ""}. Downloads contain only what you see.`
              : "Filter by company, worker, project or payroll status. Downloads contain only what you see."}
          </p>
        </div>

        {error && <div className="rounded-[10px] border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

        {!error && noClaims && step !== 0 && (
          <EmptyState title="No saved claims for this month" description="Generate and save claim sheets first (Timecard to ClaimSheet), then come back here." />
        )}

        {!error && !noClaims && noMatches && (
          <EmptyState title="Nothing matches these filters" description="Try another name, P-File, project or client, or clear the filters." action={{ label: "Clear filters", onClick: clearFilters }} />
        )}

        {step === 0 && !error && !noMatches && (
          <section className="space-y-3 rounded-[10px] border border-primary/25 bg-primary/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">BSM Group{hasFilters ? " (filtered)" : ""}</h2>
                <p className="text-sm text-muted-foreground">{companyCards.filter(s => s.companyId !== NO_COMPANY).length} companies · {eligible.reduce((n, s) => n + s.workers.length, 0)} workers · {hours(totalNormal)} G hrs · {hours(totalOt)} OT hrs</p>
              </div>
              <Button onClick={() => void downloadAll()} disabled={busy !== null || eligible.length === 0}>{busy === "combined" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download combined Excel</Button>
            </div>
            <Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead className="text-right">Workers</TableHead><TableHead className="text-right">G hrs</TableHead><TableHead className="text-right">OT hrs</TableHead></TableRow></TableHeader>
              <TableBody>{companyCards.filter(s => s.companyId !== NO_COMPANY).map(s => <TableRow key={s.companyId}><TableCell className="font-medium">{s.companyName}</TableCell><TableCell className="text-right">{s.workers.length}</TableCell><TableCell className="text-right">{hours(s.projects.reduce((n, p) => n + p.normalHours, 0))}</TableCell><TableCell className="text-right">{hours(s.projects.reduce((n, p) => n + p.otHours, 0))}</TableCell></TableRow>)}</TableBody>
            </Table>
          </section>
        )}

        {step === 0 && !error && !noMatches && companyCards.map((s) => {
          const normal = s.projects.reduce((n, p) => n + p.normalHours, 0);
          const ot = s.projects.reduce((n, p) => n + p.otHours, 0);
          const unassigned = s.projects.filter((p) => p.key.startsWith("UNASSIGNED|"));
          return (
            <section key={s.companyId} className="space-y-3 rounded-[10px] border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{s.companyName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {s.projects.length} project / site · {s.workers.length} workers · {hours(normal)} G hrs · {hours(ot)} OT hrs
                  </p>
                </div>
                <Button onClick={() => void download(s)} disabled={busy !== null || s.companyId === NO_COMPANY || s.sheets.length === 0}>
                  {busy === s.companyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Excel
                </Button>
              </div>

              {s.companyId === NO_COMPANY && (
                <Warning text="These claims have no company. Set the company on the worker (or the claim) so they go into the right company's file." />
              )}
              {unassigned.length > 0 && (
                <Warning text={`${unassigned.length} group(s) have no project linked. Link the site to a project in Projects & Sites so it is tracked by project.`} />
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project / site</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Workers</TableHead>
                    <TableHead className="text-right">G hrs</TableHead>
                    <TableHead className="text-right">OT hrs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.projects.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{hasFilters ? "No rows match the filters" : `No saved claims for ${month}`}</TableCell></TableRow>}
                  {s.projects.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell>{p.label}</TableCell>
                      <TableCell>{p.clientName || "—"}</TableCell>
                      <TableCell className="text-right">{p.workers}</TableCell>
                      <TableCell className="text-right">{hours(p.normalHours)}</TableCell>
                      <TableCell className="text-right">{hours(p.otHours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          );
        })}

        {step === 1 && !noMatches && eligible.length > 0 && (
          <section className="space-y-4 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold">All companies combined claim sheet{hasFilters ? " (filtered)" : ""}</h2><p className="text-sm text-muted-foreground">{eligible.length} companies · {hours(totalNormal)} G hrs · {hours(totalOt)} OT hrs</p></div>
              <Button onClick={() => void downloadAll()} disabled={busy !== null}>{busy === "combined" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download combined Excel</Button>
            </div>
            {summaries.some(s => s.companyId === NO_COMPANY) && <Warning text="Claims without a company are excluded. Assign their company in the first step." />}
            <Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead className="text-right">Workers</TableHead><TableHead className="text-right">Projects / sites</TableHead><TableHead className="text-right">G hrs</TableHead><TableHead className="text-right">OT hrs</TableHead></TableRow></TableHeader>
              <TableBody>{eligible.map(s => <TableRow key={s.companyId}><TableCell className="font-medium">{s.companyName}</TableCell><TableCell className="text-right">{s.workers.length}</TableCell><TableCell className="text-right">{s.projects.length}</TableCell><TableCell className="text-right">{hours(s.projects.reduce((n, p) => n + p.normalHours, 0))}</TableCell><TableCell className="text-right">{hours(s.projects.reduce((n, p) => n + p.otHours, 0))}</TableCell></TableRow>)}</TableBody>
            </Table>
          </section>
        )}

        {step === 2 && !noMatches && salaryRows.length > 0 && (
          <section className="space-y-4 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Salary sheet{hasFilters ? " (filtered)" : ""}</h2><p className="text-sm text-muted-foreground">{salaryRows.length} workers · {month} · Saved payroll</p></div>
              <Button onClick={() => void downloadSalary()} disabled={busy !== null || incompleteSalary.length > 0}>{busy === "salary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download salary Excel</Button>
            </div>
            {incompleteSalary.length > 0 && <Warning text={`${incompleteSalary.length} worker(s) need a linked worker record and one payroll entry for ${month} before salary download.`} />}
            <Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead>P-File</TableHead><TableHead>Worker</TableHead><TableHead className="text-right">G hrs</TableHead><TableHead className="text-right">OT hrs</TableHead><TableHead className="text-right">Net pay (SGD)</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{salaryRows.map((row, i) => <TableRow key={`${row.Company}-${row["P-File number"]}-${i}`}><TableCell>{row.Company}</TableCell><TableCell>{row["P-File number"] || "—"}</TableCell><TableCell>{row.Name}</TableCell><TableCell className="text-right">{hours(row["G hours"])}</TableCell><TableCell className="text-right">{hours(row["OT hours"])}</TableCell><TableCell className="text-right">{row["Net pay (SGD)"] === null ? "—" : row["Net pay (SGD)"].toLocaleString("en-SG", { minimumFractionDigits: 2 })}</TableCell><TableCell>{row.Status}</TableCell></TableRow>)}</TableBody>
            </Table>
          </section>
        )}

        {summaries.length > 0 && <div className="flex justify-between border-t pt-4"><Button variant="outline" disabled={step === 0} onClick={() => setStep(n => n - 1)}>Back</Button>{step < 2 && <Button onClick={() => setStep(n => n + 1)}>Next: {STEPS[step + 1]}</Button>}</div>}
        {!error && <ClaimSalaryAiReview snapshot={claimSalaryReviewSnapshot(month, visibleSummaries, salaryRows, step === 2 ? "salary" : "claim")} />}
      </div>
    </AppShell>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-warning/40 bg-warning/5 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> {text}
    </div>
  );
}
