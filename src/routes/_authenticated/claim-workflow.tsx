import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { companyClaimSummaries, NO_COMPANY, type CompanyClaimSummary } from "@/core/company-claim-summary";
import { downloadCompanyClaimWorkbook } from "@/lib/company-claim-export";
import { getClaimSheets, getClients, getCompanies, getEmployees, getProjects, getSites } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/claim-workflow")({
  head: () => ({
    meta: [
      { title: "Salary sheet generator — BSM HR" },
      { name: "description", content: "Month-end company claim workbooks: combined summary and every project or site claim sheet." },
    ],
  }),
  component: ClaimWorkflowPage,
});

const STEPS = ["Combined claim sheet", "Salary sheet", "Client billing", "AP & AR"];
const lastMonth = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
const hours = (n: number) => n.toLocaleString("en-SG", { maximumFractionDigits: 2 });

function ClaimWorkflowPage() {
  const [month, setMonth] = useState(lastMonth);
  const [busy, setBusy] = useState<string | null>(null);

  const { summaries, error } = useMemo(() => {
    try {
      return { summaries: companyClaimSummaries(getClaimSheets(), getEmployees(), getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients() }), error: null };
    } catch (e) {
      return { summaries: [] as CompanyClaimSummary[], error: e instanceof Error ? e.message : "Could not read the claims" };
    }
  }, [month]);

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

  return (
    <AppShell>
      <div className="space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Salary sheet generator</h1>
          <p className="text-sm text-muted-foreground">After claim sheets are generated: one Excel per company with the combined summary and every project / site claim sheet.</p>
        </div>

        <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s} className={`rounded-[10px] border p-3 text-sm ${i === 0 ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground"}`}>
              {i + 1}. {s}{i > 0 && <span className="block text-xs">Next</span>}
            </li>
          ))}
        </ol>

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="claim-month">Claim month</Label>
            <Input id="claim-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
          </div>
        </div>

        {error && <div className="rounded-[10px] border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

        {!error && summaries.length === 0 && (
          <EmptyState title="No saved claims for this month" description="Generate and save claim sheets first (Timecard to ClaimSheet), then come back here." />
        )}

        {summaries.map((s) => {
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
                <Button onClick={() => void download(s)} disabled={busy !== null || s.companyId === NO_COMPANY}>
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
