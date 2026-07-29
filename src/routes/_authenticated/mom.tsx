import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, Users, Landmark, HeartPulse, Download, Eye } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getEmployees, getCompanies, getCurrentCompany } from "@/lib/store";
import { severityLabel, severityVariant } from "@/lib/compliance";
import {
  MOM_SECTORS, DRC, computeQuota, levySummary, insuranceItems, type MomSector,
} from "@/lib/mom";
import { exportRows } from "@/lib/xlsx";

export const Route = createFileRoute("/_authenticated/mom")({
  head: () => ({
    meta: [
      { title: "MOM Levy & Quota — BSM Workforce & Operations" },
      { name: "description", content: "Foreign worker levy bill, Dependency Ratio Ceiling quota and medical insurance tracking for MOM compliance." },
      { property: "og:title", content: "MOM Levy & Quota — BSM Workforce & Operations" },
      { property: "og:description", content: "Foreign worker levy bill, DRC quota and medical insurance tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MomPage,
});

const money = (n: number) => `S$${Math.round(n).toLocaleString()}`;
const pct = (n: number) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : "Over quota");

function MomPage() {
  const companyId = getCurrentCompany();
  const companies = getCompanies();
  const company = companies.find((c) => c.id === companyId);
  const [sector, setSector] = useState<MomSector>(
    (MOM_SECTORS.includes(company?.sector as MomSector) ? company?.sector : "Construction") as MomSector,
  );

  const employees = useMemo(() => {
    const all = getEmployees();
    return companyId ? all.filter((e) => (e.companyId ?? "bsm") === companyId) : all;
  }, [companyId]);

  const quota = useMemo(() => computeQuota(employees, sector), [employees, sector]);
  const levy = useMemo(() => levySummary(employees, sector), [employees, sector]);
  const insurance = useMemo(() => insuranceItems(employees), [employees]);
  const insuranceRisk = insurance.filter((i) => i.severity !== "ok").length;

  function exportLevy() {
    void exportRows(
      levy.perWorker.map((r) => ({
        "Employee code": r.employee.employeeCode,
        Name: r.employee.name,
        FIN: r.employee.fin,
        "Pass type": r.employee.passType,
        Sector: sector,
        "Levy tier": r.tier,
        "Monthly levy (S$)": r.levy,
      })),
      "mom-levy-summary", "Levy",
    );
  }

  function exportInsurance() {
    void exportRows(
      insurance.map((i) => ({
        "Employee code": i.employee.employeeCode,
        Name: i.employee.name,
        "Pass type": i.employee.passType,
        Requirement: i.kind,
        "Due date": i.dueDate ?? "",
        "Days left": i.daysLeft ?? "",
        Status: i.severity === "missing" ? "Not recorded" : severityLabel[i.severity],
      })),
      "mom-insurance", "Insurance",
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">MOM Levy & Quota</h1>
            <p className="text-sm text-muted-foreground">
              Dependency Ratio Ceiling, monthly foreign worker levy and worker medical cover.
            </p>
          </div>
          <Select value={sector} onValueChange={(v) => setSector(v as MomSector)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOM_SECTORS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Monthly levy" value={money(levy.total)} icon={<Landmark className="h-5 w-5" />} variant="primary" caption={`${levy.perWorker.length} levy-payable workers`} />
          <SummaryCard title="Local headcount" value={quota.local.toString()} icon={<Users className="h-5 w-5" />} variant="info" caption="Singaporean / PR" />
          <SummaryCard
            title="Foreign headroom"
            value={quota.foreignHeadroom.toString()}
            icon={<ShieldAlert className="h-5 w-5" />}
            variant={quota.foreignHeadroom < 0 ? "destructive" : quota.foreignHeadroom < 3 ? "warning" : "success"}
            caption={quota.foreignHeadroom < 0 ? "Over DRC — action needed" : "Workers still hireable"}
          />
          <SummaryCard
            title="Medical cover risk"
            value={insuranceRisk.toString()}
            icon={<HeartPulse className="h-5 w-5" />}
            variant={insuranceRisk ? "warning" : "success"}
            caption="Missing or expiring"
          />
        </div>

        <Tabs defaultValue="quota">
          <TabsList>
            <TabsTrigger value="quota">Quota (DRC)</TabsTrigger>
            <TabsTrigger value="levy">Levy bill</TabsTrigger>
            <TabsTrigger value="insurance">Medical & insurance</TabsTrigger>
          </TabsList>

          <TabsContent value="quota" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="text-sm font-medium">Dependency Ratio Ceiling</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sector}: foreign workers may be at most {Math.round(DRC[sector].drc * 100)}% of total workforce.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{quota.foreign} of {quota.foreignAllowed} allowed</span>
                    <span className={quota.foreignHeadroom < 0 ? "font-medium text-destructive" : ""}>{pct(quota.drcUsage)}</span>
                  </div>
                  <Progress value={Math.min(100, Number.isFinite(quota.drcUsage) ? quota.drcUsage * 100 : 100)} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>S Pass {quota.sPass} of {quota.sPassAllowed} sub-quota</span>
                    <span className={quota.sPassHeadroom < 0 ? "font-medium text-destructive" : ""}>{pct(quota.sPassUsage)}</span>
                  </div>
                  <Progress value={Math.min(100, Number.isFinite(quota.sPassUsage) ? quota.sPassUsage * 100 : 100)} />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="text-sm font-medium">Workforce mix</h2>
                <Table className="mt-2">
                  <TableBody>
                    <TableRow><TableCell>Singaporean / PR</TableCell><TableCell className="text-right font-medium">{quota.local}</TableCell></TableRow>
                    <TableRow><TableCell>Work Permit</TableCell><TableCell className="text-right font-medium">{quota.workPermit}</TableCell></TableRow>
                    <TableRow><TableCell>S Pass</TableCell><TableCell className="text-right font-medium">{quota.sPass}</TableCell></TableRow>
                    <TableRow><TableCell>Employment Pass (no quota)</TableCell><TableCell className="text-right font-medium">{quota.employmentPass}</TableCell></TableRow>
                    <TableRow><TableCell className="font-medium">Total headcount</TableCell><TableCell className="text-right font-medium">{quota.total + quota.employmentPass}</TableCell></TableRow>
                  </TableBody>
                </Table>
                {quota.overQuota && (
                  <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                    Quota exceeded. Hire more local staff or reduce foreign headcount before the next work pass renewal.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="levy" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium">Estimated monthly levy bill</h2>
                  <p className="text-xs text-muted-foreground">
                    Work Permit {money(levy.workPermitLevy)} · S Pass {money(levy.sPassLevy)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={exportLevy} disabled={!levy.perWorker.length}>
                  <Download className="mr-1 h-4 w-4" /> Export
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {levy.byTier.map((t) => (
                  <div key={t.tier} className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t.tier}</div>
                    <div className="text-lg font-semibold">{money(t.amount)}</div>
                    <div className="text-xs text-muted-foreground">{t.count} workers</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Pass type</TableHead>
                      <TableHead>Levy tier</TableHead>
                      <TableHead className="text-right">Monthly levy</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levy.perWorker.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<Landmark className="h-5 w-5" />} title="No levy payable" description="No Work Permit or S Pass holders in this company." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      levy.perWorker.map((r) => (
                        <TableRow key={r.employee.id}>
                          <TableCell>
                            <div className="font-medium">{r.employee.name}</div>
                            <div className="text-xs text-muted-foreground">{r.employee.employeeCode}</div>
                          </TableCell>
                          <TableCell>{r.employee.passType}</TableCell>
                          <TableCell>{r.tier}</TableCell>
                          <TableCell className="text-right font-medium">{money(r.levy)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" asChild title="Open profile">
                              <Link to="/workforce/$id" params={{ id: r.employee.id }}><Eye className="h-4 w-4" /></Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="insurance" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium">Medical insurance & six-monthly examination</h2>
                  <p className="text-xs text-muted-foreground">Required for every Work Permit and S Pass holder.</p>
                </div>
                <Button size="sm" variant="outline" onClick={exportInsurance} disabled={!insurance.length}>
                  <Download className="mr-1 h-4 w-4" /> Export
                </Button>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Requirement</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Days left</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insurance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<HeartPulse className="h-5 w-5" />} title="Nothing to track" description="No foreign pass holders on record." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      insurance.map((i) => (
                        <TableRow key={`${i.employee.id}-${i.kind}`}>
                          <TableCell>
                            <div className="font-medium">{i.employee.name}</div>
                            <div className="text-xs text-muted-foreground">{i.employee.employeeCode}</div>
                          </TableCell>
                          <TableCell>{i.kind}</TableCell>
                          <TableCell>{i.dueDate ?? "—"}</TableCell>
                          <TableCell className={(i.daysLeft ?? 0) < 0 ? "font-medium text-destructive" : ""}>
                            {i.daysLeft === null ? "—" : i.daysLeft < 0 ? `${Math.abs(i.daysLeft)} days ago` : `${i.daysLeft} days`}
                          </TableCell>
                          <TableCell>
                            {i.severity === "missing" ? (
                              <StatusBadge variant="warning" label="Not recorded" dot />
                            ) : (
                              <StatusBadge variant={severityVariant[i.severity]} label={severityLabel[i.severity]} dot />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" asChild title="Open profile">
                              <Link to="/workforce/$id" params={{ id: i.employee.id }}><Eye className="h-4 w-4" /></Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
