import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, Building2, Briefcase, HardHat, Mail, MapPin, Phone, Receipt,
  TrendingUp, Users, Wallet, FileDown, AlertTriangle, CreditCard, FileText,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExportButton } from "@/components/data-io";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Invoice } from "@/lib/billing-types";
import {
  getClients, getProjects, getSites, getAssignments, getEmployees,
  getInvoices, getRateAgreements, getContracts, getReceipts, getQuotations, recordInvoicePayment,
} from "@/lib/store";
import { getCompanies, subscribe } from "@/lib/store";
import { downloadInvoicePdf } from "@/lib/pdf";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AGING_BUCKETS, daysOverdue, invoiceBalance, summarizeReceivables } from "@/core/client-receivables";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { employeeSlugById } from "@/lib/employee-slug";

export const Route = createFileRoute("/_authenticated/clients_/$id")({
  head: () => ({
    meta: [
      { title: "Client profile — BSM Workforce & Operations" },
      { name: "description", content: "Full client profile: contacts, projects and sites, deployed manpower, rate agreements, invoices and profitability." },
      { property: "og:title", content: "Client profile — BSM Workforce & Operations" },
      { property: "og:description", content: "Client contacts, projects, deployed manpower, rates and billing performance in one view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientProfilePage,
});

const money = (n: number) => `$${n.toLocaleString("en-SG", { maximumFractionDigits: 0 })}`;

function daysSince(iso?: string) {
  if (!iso) return null;
  const t = new Date(`${iso}T00:00:00+08:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86_400_000));
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
const money2 = (n: number) => `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const invVariant = (st: string): "success" | "destructive" | "warning" | "ghost" | "info" =>
  st === "Paid" ? "success" : st === "Overdue" ? "destructive" : st === "Partially Paid" ? "warning" : st === "Cancelled" || st === "Draft" ? "ghost" : "info";

function ClientProfilePage() {
  const { id } = Route.useParams();
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  const [invSearch, setInvSearch] = useState("");
  const [invStatus, setInvStatus] = useState<string>("all");
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const clients = getClients();
  const client = clients.find((c) => c.id === id || c.code.toLowerCase() === id.toLowerCase());

  const data = useMemo(() => {
    if (!client) return null;
    const projects = getProjects().filter((p) => p.clientId === client.id);
    const projectIds = new Set(projects.map((p) => p.id));
    const sites = getSites().filter((s) => projectIds.has(s.projectId));
    const employees = getEmployees();
    const assignments = getAssignments().filter((a) => projectIds.has(a.projectId));
    const active = assignments.filter((a) => a.status === "Active" || a.status === "Approved");
    const invoices = getInvoices().filter((i) => i.clientId === client.id);
    const rates = getRateAgreements().filter((r) => r.clientId === client.id);
    const contracts = getContracts().filter((c) => c.clientId === client.id);
    const invoiceIds = new Set(invoices.map((i) => i.id));
    const receipts = getReceipts()
      .filter((r) => r.clientId === client.id || (r.invoiceId && invoiceIds.has(r.invoiceId)))
      .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
    const quotations = getQuotations().filter((q) => q.clientId === client.id)
      .sort((a, b) => b.quoteDate.localeCompare(a.quoteDate));
    const lastPaid: Record<string, string> = {};
    for (const r of receipts) if (r.invoiceId && !lastPaid[r.invoiceId]) lastPaid[r.invoiceId] = r.receivedOn;
    const ar = summarizeReceivables(invoices, today, lastPaid);
    invoices.sort((a, b) => b.issueDate.localeCompare(a.issueDate));

    const billed = invoices.reduce((s, i) => s + i.total, 0);
    const paid = invoices.reduce((s, i) => s + i.amountPaid, 0);
    const outstanding = Math.max(0, billed - paid);
    const required = projects.reduce((s, p) => s + (p.requiredWorkers || 0), 0);
    const fillRate = required ? Math.round((active.length / required) * 100) : 0;

    // rough monthly manpower cost proxy for profitability signal
    const monthlyRevenue = invoices
      .reduce<Record<string, number>>((acc, i) => {
        const key = i.issueDate.slice(0, 7);
        acc[key] = (acc[key] ?? 0) + i.total;
        return acc;
      }, {});
    const months = Object.entries(monthlyRevenue).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    const maxMonth = Math.max(1, ...months.map(([, v]) => v));

    return {
      projects, sites, employees, assignments, active, invoices, rates, contracts, receipts, quotations, ar,
      billed, paid, outstanding, required, fillRate, months, maxMonth,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, tick]);

  if (!client || !data) {
    return (
      <AppShell>
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="Client not found"
          description="This client may have been removed."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-7 px-2 text-xs">
              <Link to="/clients"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Client directory</Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {client.code} · {client.industry ?? "—"} ·{" "}
              <StatusBadge
                variant={client.status === "Active" ? "success" : client.status === "Prospect" ? "warning" : "ghost"}
                label={client.status}
                dot
              />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/deployment-history" search={{ client: client.id }}>Deployment history</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/billing">Billing</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Deployed manpower" value={String(data.active.length)} icon={<HardHat className="h-5 w-5" />} variant="primary" caption={`${data.required} required · ${data.fillRate}% filled`} compact />
          <SummaryCard title="Active projects" value={String(data.projects.filter((p) => p.status === "Active").length)} icon={<Briefcase className="h-5 w-5" />} variant="info" caption={`${data.projects.length} total`} compact />
          <SummaryCard title="Total billed" value={money(data.billed)} icon={<Receipt className="h-5 w-5" />} variant="success" caption={`${data.invoices.length} invoices`} compact />
          <SummaryCard title="Outstanding" value={money(data.outstanding)} icon={<Wallet className="h-5 w-5" />} variant={data.outstanding > 0 ? "warning" : "success"} caption={`${money(data.paid)} collected`} compact />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects & sites</TabsTrigger>
            <TabsTrigger value="manpower">Deployed manpower</TabsTrigger>
            <TabsTrigger value="invoices">Invoices & billing</TabsTrigger>
            <TabsTrigger value="ar">Receivables (AR)</TabsTrigger>
            <TabsTrigger value="commercial">Rates & contracts</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Contact & account</h2>
                <dl className="space-y-2.5 text-sm">
                  <Row label="Contact person" value={client.contactPerson} />
                  <Row label="Email" value={client.email} icon={<Mail className="h-3.5 w-3.5" />} />
                  <Row label="Phone" value={client.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                  <Row label="Address" value={client.address} icon={<MapPin className="h-3.5 w-3.5" />} />
                  <Row label="Industry" value={client.industry ?? "—"} />
                  <Row label="Contract period" value={`${client.contractStart ?? "—"} → ${client.contractEnd ?? "—"}`} />
                  <Row label="Client since" value={client.createdAt.slice(0, 10)} />
                </dl>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Deployment snapshot</h2>
                {data.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects yet for this client.</p>
                ) : (
                  <div className="space-y-3">
                    {data.projects.map((p) => {
                      const count = data.active.filter((a) => a.projectId === p.id).length;
                      const pct = p.requiredWorkers ? Math.min(100, Math.round((count / p.requiredWorkers) * 100)) : 0;
                      return (
                        <div key={p.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground">{count}/{p.requiredWorkers || 0}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Sites</TableHead>
                    <TableHead>Deployed / required</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.projects.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">No projects.</TableCell></TableRow>
                  ) : data.projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.code}</div></TableCell>
                      <TableCell>{p.location}</TableCell>
                      <TableCell className="text-xs">{p.startDate ?? "—"} → {p.endDate ?? "—"}</TableCell>
                      <TableCell>{data.sites.filter((s) => s.projectId === p.id).length}</TableCell>
                      <TableCell>{data.active.filter((a) => a.projectId === p.id).length} / {p.requiredWorkers || 0}</TableCell>
                      <TableCell><StatusBadge variant={p.status === "Active" ? "success" : p.status === "Completed" ? "info" : "warning"} label={p.status} dot /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="manpower" className="space-y-3">
            <div className="flex justify-end">
              <ExportButton
                rows={data.active.map((a) => {
                  const emp = data.employees.find((e) => e.id === a.employeeId);
                  return {
                    "P-File No": emp?.employeeCode ?? "",
                    Worker: emp?.name ?? "",
                    Designation: emp?.trade ?? "",
                    Project: data.projects.find((p) => p.id === a.projectId)?.name ?? "",
                    Site: data.sites.find((s) => s.id === a.siteId)?.name ?? "",
                    Start: a.startDate,
                    "Days on job": daysSince(a.startDate) ?? "",
                    Status: a.status,
                  };
                })}
                baseName={`client-${client.code}-manpower`}
                sheetName="Manpower"
              />
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.active.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">No deployed workers.</TableCell></TableRow>
                  ) : data.active.map((a) => {
                    const emp = data.employees.find((e) => e.id === a.employeeId);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          {emp ? (
                            <Link to="/workforce/$slug" params={{ slug: employeeSlugById(emp.id) }} className="font-medium text-primary hover:underline">{emp.name}</Link>
                          ) : "—"}
                          <div className="text-xs text-muted-foreground">{emp?.employeeCode} · {emp?.trade}</div>
                        </TableCell>
                        <TableCell>{data.projects.find((p) => p.id === a.projectId)?.name ?? "—"}</TableCell>
                        <TableCell>{data.sites.find((s) => s.id === a.siteId)?.name ?? "—"}</TableCell>
                        <TableCell>{a.startDate}</TableCell>
                        <TableCell>{daysSince(a.startDate) ?? "—"}d</TableCell>
                        <TableCell><StatusBadge variant={a.status === "Active" ? "success" : "info"} label={a.status} dot /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Search invoice no…" value={invSearch} onChange={(e) => setInvSearch(e.target.value)} className="h-9 w-56" />
                <select value={invStatus} onChange={(e) => setInvStatus(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="all">All status</option>
                  {["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"].map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <ExportButton
                rows={data.invoices.map((i) => ({
                  "Invoice No": i.invoiceNo, Project: data.projects.find((p) => p.id === i.projectId)?.name ?? "",
                  Issued: i.issueDate, Due: i.dueDate, Period: `${i.periodStart} - ${i.periodEnd}`,
                  Subtotal: i.subtotal, GST: i.gstAmount, Total: i.total, Paid: i.amountPaid, Balance: invoiceBalance(i), Status: i.status,
                }))}
                baseName={`client-${client.code}-invoices`}
                sheetName="Invoices"
              />
            </div>
            <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead><TableHead>Project</TableHead><TableHead>Issued / due</TableHead>
                    <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const rows = data.invoices.filter((i) =>
                      (invStatus === "all" || i.status === invStatus) &&
                      i.invoiceNo.toLowerCase().includes(invSearch.trim().toLowerCase()));
                    if (rows.length === 0) return <TableRow><TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">No invoices for this client.</TableCell></TableRow>;
                    return rows.map((i) => {
                      const bal = invoiceBalance(i);
                      const od = bal > 0 ? daysOverdue(i, today) : 0;
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.invoiceNo}<div className="text-xs text-muted-foreground">{i.periodStart} → {i.periodEnd}</div></TableCell>
                          <TableCell className="text-sm">{data.projects.find((p) => p.id === i.projectId)?.name ?? "—"}</TableCell>
                          <TableCell className="text-xs">{i.issueDate}<div className={od > 0 ? "text-destructive" : "text-muted-foreground"}>Due {i.dueDate}{od > 0 ? ` · ${od}d overdue` : ""}</div></TableCell>
                          <TableCell className="text-right">{money2(i.total)}</TableCell>
                          <TableCell className="text-right">{money2(i.amountPaid)}</TableCell>
                          <TableCell className="text-right font-medium">{money2(bal)}</TableCell>
                          <TableCell><StatusBadge variant={invVariant(od > 0 && i.status !== "Paid" ? "Overdue" : i.status)} label={od > 0 && i.status === "Sent" ? "Overdue" : i.status} dot /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {bal > 0 && (
                                <Button size="sm" variant="outline" onClick={() => { setPayFor(i); setPayAmount(String(bal)); }}>
                                  <CreditCard className="mr-1 h-3.5 w-3.5" /> Record payment
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" title="Download PDF"
                                onClick={() => void downloadInvoicePdf(i, { company: getCompanies().find((c) => c.id === i.companyId), clientName: client.name }).then(() => toast.success("Invoice PDF downloaded"))}>
                                <FileDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" /> Quotations</h2>
              {data.quotations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quotations for this client.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.quotations.map((q) => (
                    <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                      <span><span className="font-medium">{q.quoteNo}</span> · {q.title}</span>
                      <span className="text-xs text-muted-foreground">{q.quoteDate} · {money2(q.total)} · {q.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ar" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard title="Outstanding" value={money(data.ar.outstanding)} icon={<Wallet className="h-5 w-5" />} variant="warning" caption={`${data.ar.openCount} open invoices`} compact />
              <SummaryCard title="Overdue" value={money(data.ar.overdue)} icon={<AlertTriangle className="h-5 w-5" />} variant={data.ar.overdue > 0 ? "destructive" : "success"} caption={`${data.ar.overdueCount} past due date`} compact />
              <SummaryCard title="Collected" value={money(data.ar.collected)} icon={<Receipt className="h-5 w-5" />} variant="success" caption={`of ${money(data.ar.billed)} billed`} compact />
              <SummaryCard title="Avg days to pay" value={data.ar.avgDaysToPay == null ? "—" : `${data.ar.avgDaysToPay}d`} icon={<CreditCard className="h-5 w-5" />} variant="info" caption="Issue date → last receipt" compact />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Aging (days past due)</h2>
                <div className="space-y-2">
                  {AGING_BUCKETS.map((b) => {
                    const v = data.ar.buckets[b];
                    const pct = data.ar.outstanding ? Math.round((v / data.ar.outstanding) * 100) : 0;
                    return (
                      <div key={b} className="space-y-1">
                        <div className="flex justify-between text-xs"><span>{b === "Current" ? "Not yet due" : `${b} days`}</span><span className="font-medium">{money2(v)}</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className={b === "Current" ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-destructive"} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Payment history</h2>
                {data.receipts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment receipts recorded.</p>
                ) : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                    {data.receipts.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                        <span><span className="font-medium">{r.receiptNo}</span> · {data.invoices.find((i) => i.id === r.invoiceId)?.invoiceNo ?? "On account"}</span>
                        <span className="text-xs text-muted-foreground">{r.receivedOn} · {r.paymentMode}{r.referenceNo ? ` · ${r.referenceNo}` : ""} · <span className="font-medium text-foreground">{money2(r.amount)}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Statement of account</h2>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const entries = [
                      ...data.invoices.filter((i) => i.status !== "Draft" && i.status !== "Cancelled").map((i) => ({ d: i.issueDate, ref: `Invoice ${i.invoiceNo}`, dr: i.total, cr: 0 })),
                      ...data.receipts.map((r) => ({ d: r.receivedOn, ref: `Receipt ${r.receiptNo}`, dr: 0, cr: r.amount })),
                    ].sort((a, b) => a.d.localeCompare(b.d));
                    if (entries.length === 0) return <TableRow><TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">No transactions yet.</TableCell></TableRow>;
                    let bal = 0;
                    return entries.map((e, idx) => {
                      bal += e.dr - e.cr;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{e.d}</TableCell><TableCell>{e.ref}</TableCell>
                          <TableCell className="text-right">{e.dr ? money2(e.dr) : "—"}</TableCell>
                          <TableCell className="text-right">{e.cr ? money2(e.cr) : "—"}</TableCell>
                          <TableCell className="text-right font-medium">{money2(bal)}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="commercial" className="space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Rate agreements</h2>
              {data.rates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rate card set. Add one in Rate Agreements.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Designation</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Normal</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rates.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.trade}</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell>{money(r.normalRate)}</TableCell>
                        <TableCell>{money(r.otRate)}</TableCell>
                        <TableCell className="text-xs">{r.effectiveFrom} → {r.effectiveTo ?? "open"}</TableCell>
                        <TableCell><StatusBadge variant={r.status === "Active" ? "success" : "ghost"} label={r.status} dot /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Billing contracts</h2>
              {data.contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No auto-billing contract for this client.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.contracts.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                      <span className="font-medium">{c.title ?? c.id}</span>
                      <span className="text-xs text-muted-foreground">{c.billingCycle} · {c.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4" /> Billed revenue (last 6 months)</h2>
                {data.months.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.months.map(([m, v]) => (
                      <div key={m} className="space-y-1">
                        <div className="flex justify-between text-xs"><span>{m}</span><span className="font-medium">{money(v)}</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((v / data.maxMonth) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Manpower mix by designation</h2>
                {data.active.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deployed workers.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(
                      data.active.reduce<Record<string, number>>((acc, a) => {
                        const t = data.employees.find((e) => e.id === a.employeeId)?.trade || "Unspecified";
                        acc[t] = (acc[t] ?? 0) + 1;
                        return acc;
                      }, {}),
                    )
                      .sort((a, b) => b[1] - a[1])
                      .map(([t, n]) => (
                        <span key={t} className="rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium">{t} · {n}</span>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard title="Avg revenue / worker" value={money(data.active.length ? Math.round(data.billed / data.active.length) : 0)} icon={<Wallet className="h-5 w-5" />} variant="info" caption="Billed ÷ deployed" compact />
              <SummaryCard title="Collection rate" value={`${data.billed ? Math.round((data.paid / data.billed) * 100) : 0}%`} icon={<Receipt className="h-5 w-5" />} variant="success" caption="Paid vs billed" compact />
              <SummaryCard title="Fill rate" value={`${data.fillRate}%`} icon={<HardHat className="h-5 w-5" />} variant={data.fillRate >= 90 ? "success" : "warning"} caption="Deployed vs required" compact />
            </div>
          </TabsContent>
        </Tabs>
        <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Record payment · {payFor?.invoiceNo}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="pay-amt">Amount received</Label>
              <Input id="pay-amt" type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              {payFor && <p className="text-xs text-muted-foreground">Balance: {money2(invoiceBalance(payFor))}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
              <Button onClick={() => {
                const amt = Number(payAmount);
                if (!payFor || !(amt > 0)) { toast.error("Enter a valid amount"); return; }
                if (amt > invoiceBalance(payFor) + 0.001) { toast.error("Amount is more than the balance"); return; }
                recordInvoicePayment(payFor.id, amt);
                toast.success(`Payment of ${money2(amt)} recorded`);
                setPayFor(null);
              }}>Save payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</dt>
      <dd className="text-right text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
