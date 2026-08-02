import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  FileText,
  Wand2,
  Printer,
  FileDown,
  Trash2,
  DollarSign,
  Clock,
  CheckCircle2,
  Percent,
  Banknote,
  Repeat,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ExportButton } from "@/components/data-io";
import { BillingOverview } from "@/components/billing-overview";
import { downloadInvoicePdf } from "@/lib/pdf";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClients,
  getProjects,
  getInvoices,
  addInvoice,
  updateInvoice,
  deleteInvoice,
  recordInvoicePayment,
  buildInvoiceLines,
  computeInvoiceTotals,
  getRateAgreements,
  addRateAgreement,
  deleteRateAgreement,
  getContracts,
  addContract,
  updateContract,
  deleteContract,
  contractsDue,
  runContractBilling,
  firstRunDate,
  getCurrentCompany,
  getCompanies,
} from "@/lib/store";
import type {
  BillingCycle, BillingSource, ClientContract,
  Invoice, InvoiceLine, InvoiceStatus, RateUnit, RateAgreement
} from "@/lib/types";

const GST_DEFAULT = 9;
const statuses: InvoiceStatus[] = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];
const units: RateUnit[] = ["Hourly", "Daily", "Monthly"];
const cycles: BillingCycle[] = ["Weekly", "Fortnightly", "Monthly"];

const money = (n: number) =>
  `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Invoicing — BSM Workforce & Operations" },
      { name: "description", content: "Client billing based on deployed manpower, timesheets and rate agreements." },
      { property: "og:title", content: "Billing & Invoicing — BSM Workforce & Operations" },
      { property: "og:description", content: "Client billing based on deployed manpower, timesheets and rate agreements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rates, setRates] = useState<RateAgreement[]>([]);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [inv, rt, ct] = await Promise.all([
        getInvoices(),
        getRateAgreements(),
        getContracts()
      ]);
      setInvoices(inv);
      setRates(rt);
      setContracts(ct);
    } catch (error) {
      console.error("Failed to load billing data:", error);
    } finally {
      setLoading(false);
    }
  }

  useState(() => {
    refresh();
  });

  const [clients] = useState(getClients());
  const [projects] = useState(getProjects());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [preview, setPreview] = useState<Invoice | null>(null);

  const companyId = getCurrentCompany();
  const company = getCompanies().find((c) => c.id === companyId);

  const filtered = invoices.filter((i) => {
    const client = clients.find((c) => c.id === i.clientId);
    const q = search.toLowerCase();
    const matchesCompany = !companyId || !i.companyId || i.companyId === companyId;
    const matchesSearch = !q || i.invoiceNo.toLowerCase().includes(q) || client?.name.toLowerCase().includes(q);
    return matchesCompany && matchesSearch && (statusFilter === "all" || i.status === statusFilter);
  });

  const outstanding = filtered
    .filter((i) => i.status !== "Paid" && i.status !== "Cancelled")
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const billedTotal = filtered.filter((i) => i.status !== "Cancelled").reduce((s, i) => s + i.total, 0);
  const collected = filtered.reduce((s, i) => s + i.amountPaid, 0);
  const overdueCount = filtered.filter(
    (i) => i.status !== "Paid" && i.status !== "Cancelled" && i.dueDate && i.dueDate < new Date().toISOString().slice(0, 10),
  ).length;

  const visibleContracts = contracts.filter((c) => !companyId || !c.companyId || c.companyId === companyId);
  const dueContracts = contractsDue();

  function handleGenerate(form: FormData) {
    const clientId = form.get("clientId") as string;
    const projectId = (form.get("projectId") as string) || undefined;
    const periodStart = form.get("periodStart") as string;
    const periodEnd = form.get("periodEnd") as string;
    const gstRate = Number(form.get("gstRate") ?? GST_DEFAULT);
    const lines = buildInvoiceLines(clientId, periodStart, periodEnd, projectId === "all" ? undefined : projectId);
    if (lines.length === 0) {
      toast.error("No billable timesheet data found for this period");
      return;
    }
    const issueDate = new Date().toISOString().slice(0, 10);
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const created = addInvoice({
      companyId,
      clientId,
      projectId: projectId === "all" ? undefined : projectId,
      periodStart,
      periodEnd,
      issueDate,
      dueDate: due.toISOString().slice(0, 10),
      lines,
      gstRate,
      amountPaid: 0,
      status: "Draft",
      notes: (form.get("notes") as string) || undefined,
    });
    setIsGenOpen(false);
    refresh();
    toast.success(`${created.invoiceNo} generated — ${lines.length} line(s), ${money(created.total)}`);
  }

  function handleAddRate(form: FormData) {
    addRateAgreement({
      clientId: form.get("clientId") as string,
      projectId: ((form.get("projectId") as string) || "all") === "all" ? undefined : (form.get("projectId") as string),
      trade: (form.get("trade") as string) || "All",
      unit: form.get("unit") as RateUnit,
      normalRate: Number(form.get("normalRate") ?? 0),
      otRate: Number(form.get("otRate") ?? 0),
      effectiveFrom: form.get("effectiveFrom") as string,
      effectiveTo: (form.get("effectiveTo") as string) || undefined,
      status: "Active",
      remarks: (form.get("remarks") as string) || undefined,
    });
    setIsRateOpen(false);
    refresh();
    toast.success("Rate agreement added");
  }

  function handleAddContract(form: FormData) {
    const startDate = (form.get("startDate") as string) || new Date().toISOString().slice(0, 10);
    const billingCycle = form.get("billingCycle") as BillingCycle;
    const billingDay = Number(form.get("billingDay") ?? 1);
    addContract({
      companyId: companyId || undefined,
      clientId: form.get("clientId") as string,
      projectId: ((form.get("projectId") as string) || "all") === "all" ? undefined : (form.get("projectId") as string),
      contractNo: (form.get("contractNo") as string) || `CT-${Date.now().toString().slice(-6)}`,
      title: (form.get("title") as string) || "",
      startDate,
      endDate: (form.get("endDate") as string) || undefined,
      billingCycle,
      billingDay,
      billingSource: form.get("billingSource") as BillingSource,
      fixedAmount: Number(form.get("fixedAmount") ?? 0),
      gstRate: Number(form.get("gstRate") ?? GST_DEFAULT),
      paymentTermsDays: Number(form.get("paymentTermsDays") ?? 30),
      autoInvoice: true,
      nextInvoiceOn: firstRunDate({ billingCycle, billingDay }, startDate),
      status: "Active",
      remarks: (form.get("remarks") as string) || undefined,
    });
    setIsContractOpen(false);
    refresh();
    toast.success("Contract added — auto-invoicing scheduled");
  }

  function handleRunBilling() {
    const { created, skipped } = runContractBilling();
    refresh();
    if (created.length === 0 && skipped.length === 0) {
      toast.info("No contracts are due for invoicing today");
      return;
    }
    if (created.length > 0) toast.success(`${created.length} invoice(s) generated from contracts`);
    for (const s of skipped) toast.warning(`${s.contract.contractNo}: ${s.reason}`);
  }

  function setStatus(inv: Invoice, status: InvoiceStatus) {
    updateInvoice(inv.id, { status });
    refresh();
    toast.success(`${inv.invoiceNo} → ${status}`);
  }

  function pay(inv: Invoice) {
    const remaining = inv.total - inv.amountPaid;
    recordInvoicePayment(inv.id, remaining);
    refresh();
    toast.success(`Payment of ${money(remaining)} recorded`);
  }

  const exportRows = filtered.map((i) => ({
    "Invoice No": i.invoiceNo,
    Client: clients.find((c) => c.id === i.clientId)?.name ?? "",
    Period: `${i.periodStart} → ${i.periodEnd}`,
    "Issue Date": i.issueDate,
    "Due Date": i.dueDate,
    Subtotal: i.subtotal,
    GST: i.gstAmount,
    Total: i.total,
    Paid: i.amountPaid,
    Balance: Math.round((i.total - i.amountPaid) * 100) / 100,
    Status: i.status,
  }));

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing & Invoicing</h1>
            <p className="text-sm text-muted-foreground">
              Xero বা QuickBooks এর মতো প্রফেশনাল বিলিং, রেট এগ্রিমেন্ট এবং অটো-ইনভয়েসিং সিস্টেম।
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <Button size="sm" variant="secondary" onClick={handleRunBilling}>
              <PlayCircle className="mr-1 h-4 w-4" />
              Run contract billing
              {dueContracts.length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                  {dueContracts.length}
                </span>
              )}
            </Button>
            <Dialog open={isGenOpen} onOpenChange={setIsGenOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Wand2 className="mr-1 h-4 w-4" />
                  Generate invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Generate invoice from timesheets</DialogTitle>
                  <DialogDescription>
                    Attendance in the period is priced with the client&apos;s rate agreements.
                  </DialogDescription>
                </DialogHeader>
                <GenerateForm clients={clients} projects={projects} onSubmit={handleGenerate} />
              </DialogContent>
            </Dialog>
            <ExportButton rows={exportRows} baseName="invoices" sheetName="Invoices" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Billed" value={money(billedTotal)} icon={<FileText className="h-5 w-5" />} variant="primary" caption={`${filtered.length} invoice(s)`} />
          <SummaryCard title="Collected" value={money(collected)} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="Payments received" />
          <SummaryCard title="Outstanding" value={money(outstanding)} icon={<DollarSign className="h-5 w-5" />} variant="warning" caption="Unpaid balance" />
          <SummaryCard title="Overdue" value={overdueCount.toString()} icon={<Clock className="h-5 w-5" />} variant="destructive" caption="Past due date" />
        </div>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading billing data...</p>
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
              <TabsTrigger value="rates">Rate agreements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <BillingOverview
                invoices={filtered}
                clients={clients}
                contracts={visibleContracts}
                onOpenInvoice={(inv) => setPreview(inv)}
              />
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search invoice no or client..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | "all")}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-56 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center">
                            <EmptyState
                              className="border-0 bg-transparent"
                              icon={<FileText className="h-5 w-5" />}
                              title="No invoices yet"
                              description="Add rate agreements, then generate an invoice from timesheets."
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((i) => {
                          const client = clients.find((c) => c.id === i.clientId);
                          const balance = Math.round((i.total - i.amountPaid) * 100) / 100;
                          return (
                            <TableRow key={i.id}>
                              <TableCell>
                                <div className="font-medium">{i.invoiceNo}</div>
                                <div className="text-xs text-muted-foreground">Due {i.dueDate}</div>
                              </TableCell>
                              <TableCell>{client?.name ?? "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {i.periodStart} → {i.periodEnd}
                              </TableCell>
                              <TableCell className="text-right font-medium">{money(i.total)}</TableCell>
                              <TableCell className="text-right">{money(balance)}</TableCell>
                              <TableCell>
                                <StatusBadge
                                  variant={
                                    i.status === "Paid"
                                      ? "success"
                                      : i.status === "Sent"
                                        ? "info"
                                        : i.status === "Draft"
                                          ? "default"
                                          : i.status === "Cancelled"
                                            ? "destructive"
                                            : "warning"
                                  }
                                  label={i.status}
                                  dot
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => setPreview(i)} title="View / print">
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Download PDF"
                                    onClick={() =>
                                      void downloadInvoicePdf(i, {
                                        company,
                                        clientName: client?.name,
                                      }).then(() => toast.success("Invoice PDF downloaded"))
                                    }
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </Button>
                                  {i.status === "Draft" && (
                                    <Button size="sm" variant="secondary" onClick={() => setStatus(i, "Sent")}>
                                      Send
                                    </Button>
                                  )}
                                  {i.status !== "Paid" && i.status !== "Cancelled" && i.status !== "Draft" && (
                                    <Button size="sm" variant="secondary" onClick={() => pay(i)}>
                                      <Banknote className="mr-1 h-4 w-4" />
                                      Paid
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      deleteInvoice(i.id);
                                      refresh();
                                      toast.success("Invoice deleted");
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contracts" className="mt-4">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-medium">Client contracts</h2>
                    <p className="text-sm text-muted-foreground">
                      Recurring service agreements. Due contracts are invoiced automatically when you run billing.
                    </p>
                  </div>
                  <Dialog open={isContractOpen} onOpenChange={setIsContractOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-1 h-4 w-4" />
                        Add contract
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add client contract</DialogTitle>
                        <DialogDescription>
                          Sets the billing cycle, GST and payment terms used for auto-generated invoices.
                        </DialogDescription>
                      </DialogHeader>
                      <ContractForm clients={clients} projects={projects} onSubmit={handleAddContract} />
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Next invoice</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-40 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleContracts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-28 text-center">
                            <EmptyState
                              className="border-0 bg-transparent"
                              icon={<Repeat className="h-5 w-5" />}
                              title="No contracts yet"
                              description="Add a client contract to schedule recurring invoices."
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleContracts.map((c) => {
                          const due = !!c.nextInvoiceOn && c.nextInvoiceOn <= new Date().toISOString().slice(0, 10);
                          return (
                            <TableRow key={c.id}>
                              <TableCell>
                                <div className="font-medium">{c.contractNo}</div>
                                <div className="text-xs text-muted-foreground">{c.title || "—"}</div>
                              </TableCell>
                              <TableCell>{clients.find((cl) => cl.id === c.clientId)?.name ?? "—"}</TableCell>
                              <TableCell>
                                <div>{c.billingCycle}</div>
                                <div className="text-xs text-muted-foreground">
                                  {c.startDate || "—"} → {c.endDate || "open"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {c.billingSource === "Fixed" ? `Fixed ${money(c.fixedAmount)}` : "Timesheet"}
                              </TableCell>
                              <TableCell>
                                <div className={due ? "font-medium text-destructive" : ""}>
                                  {c.nextInvoiceOn || "—"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {c.lastInvoicedOn ? `Last ${c.lastInvoicedOn}` : "Not invoiced yet"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  variant={
                                    c.status === "Active" ? "success" : (c.status as string) === "Draft" ? "info" : "destructive"
                                  }
                                  label={c.autoInvoice ? c.status : `${c.status} (manual)`}
                                  dot
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      updateContract(c.id, { autoInvoice: !c.autoInvoice });
                                      refresh();
                                      toast.success(c.autoInvoice ? "Auto-invoicing paused" : "Auto-invoicing resumed");
                                    }}
                                  >
                                    {c.autoInvoice ? "Pause" : "Resume"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      deleteContract(c.id);
                                      refresh();
                                      toast.success("Contract deleted");
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rates" className="mt-4">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-medium">Rate agreements</h2>
                    <p className="text-sm text-muted-foreground">
                      Charge-out rates per client, project and trade. Use trade &quot;All&quot; as a fallback.
                    </p>
                  </div>
                  <Dialog open={isRateOpen} onOpenChange={setIsRateOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-1 h-4 w-4" />
                        Add rate
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add rate agreement</DialogTitle>
                        <DialogDescription>Used to price timesheets during invoice generation.</DialogDescription>
                      </DialogHeader>
                      <RateForm clients={clients} projects={projects} onSubmit={handleAddRate} />
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Normal</TableHead>
                        <TableHead className="text-right">OT / hr</TableHead>
                        <TableHead>Effective</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-28 text-center">
                            <EmptyState
                              className="border-0 bg-transparent"
                              icon={<Percent className="h-5 w-5" />}
                              title="No rate agreements"
                              description="Add a charge-out rate to enable invoice generation."
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        rates.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{clients.find((c) => c.id === r.clientId)?.name ?? "—"}</TableCell>
                            <TableCell>{projects.find((p) => p.id === r.projectId)?.name ?? "All projects"}</TableCell>
                            <TableCell>{r.trade}</TableCell>
                            <TableCell>{r.unit}</TableCell>
                            <TableCell className="text-right">{money(r.normalRate)}</TableCell>
                            <TableCell className="text-right">{money(r.otRate)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.effectiveFrom} → {r.effectiveTo || "open"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  deleteRateAgreement(r.id);
                                  refresh();
                                  toast.success("Rate deleted");
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
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
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice {preview?.invoiceNo}</DialogTitle>
            <DialogDescription>Tax invoice preview</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{company?.name ?? "Company"}</div>
                  <div className="text-muted-foreground">{company?.uen}</div>
                  <div className="text-muted-foreground">{company?.address}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{clients.find((c) => c.id === preview.clientId)?.name}</div>
                  <div className="text-muted-foreground">
                    {preview.periodStart} → {preview.periodEnd}
                  </div>
                  <div className="text-muted-foreground">Due {preview.dueDate}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">OT hrs</TableHead>
                      <TableHead className="text-right">OT Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.lines.map((l: InvoiceLine, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{l.description}</TableCell>
                        <TableCell className="text-right">
                          {l.quantity} {l.unit === "Hourly" ? "hr" : l.unit === "Daily" ? "day" : "mth"}
                        </TableCell>
                        <TableCell className="text-right">{money(l.rate)}</TableCell>
                        <TableCell className="text-right">{l.otQuantity || 0}</TableCell>
                        <TableCell className="text-right">{l.otRate ? money(l.otRate) : "—"}</TableCell>
                        <TableCell className="text-right">{money(l.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="ml-auto w-full max-w-xs space-y-1">
                <Row label="Subtotal" value={money(preview.subtotal)} />
                <Row label={`GST ${preview.gstRate}%`} value={money(preview.gstAmount)} />
                <Row label="Total" value={money(preview.total)} bold />
                <Row label="Paid" value={money(preview.amountPaid)} />
                <Row label="Balance" value={money(preview.total - preview.amountPaid)} bold />
              </div>

              {preview.notes && <p className="text-muted-foreground">{preview.notes}</p>}

              <DialogFooter>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
                <Button
                  onClick={() =>
                    void downloadInvoicePdf(preview, {
                      company,
                      clientName: clients.find((c) => c.id === preview.clientId)?.name,
                    }).then(() => toast.success("Invoice PDF downloaded"))
                  }
                >
                  <FileDown className="mr-1 h-4 w-4" />
                  Download PDF
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function GenerateForm({
  clients,
  projects,
  onSubmit,
}: {
  clients: ReturnType<typeof getClients>;
  projects: ReturnType<typeof getProjects>;
  onSubmit: (data: FormData) => void;
}) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState("all");
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));
  const [gstRate, setGstRate] = useState(GST_DEFAULT);

  const previewLines = clientId
    ? buildInvoiceLines(clientId, periodStart, periodEnd, projectId === "all" ? undefined : projectId)
    : [];
  const totals = computeInvoiceTotals(previewLines, gstRate);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="projectId" value={projectId} />

      <div className="space-y-1">
        <Label>Client</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Project</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects
              .filter((p) => p.clientId === clientId)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="periodStart">From</Label>
          <Input id="periodStart" name="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="periodEnd">To</Label>
          <Input id="periodEnd" name="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gstRate">GST %</Label>
          <Input id="gstRate" name="gstRate" type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Billable workers</span>
          <span className="font-medium">{previewLines.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{money(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total incl. GST</span>
          <span className="font-semibold">{money(totals.total)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Optional" />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={previewLines.length === 0}>
          Generate invoice
        </Button>
      </DialogFooter>
    </form>
  );
}

function ContractForm({
  clients,
  projects,
  onSubmit,
}: {
  clients: ReturnType<typeof getClients>;
  projects: ReturnType<typeof getProjects>;
  onSubmit: (data: FormData) => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState("all");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("Monthly");
  const [billingSource, setBillingSource] = useState<BillingSource>("Timesheet");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="billingCycle" value={billingCycle} />
      <input type="hidden" name="billingSource" value={billingSource} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="contractNo">Contract no</Label>
          <Input id="contractNo" name="contractNo" placeholder="CT-2026-001" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" placeholder="Manpower supply — Tuas site" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Client</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Project</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects
              .filter((p) => p.clientId === clientId)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
        <div className="space-y-1">
          <Label>Billing cycle</Label>
          <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="billingDay">Invoice day of month</Label>
          <Input id="billingDay" name="billingDay" type="number" min={1} max={28} defaultValue={1} />
        </div>
        <div className="space-y-1">
          <Label>Billing source</Label>
          <Select value={billingSource} onValueChange={(v) => setBillingSource(v as BillingSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Timesheet">Timesheet + rate agreements</SelectItem>
              <SelectItem value="Fixed">Fixed amount per cycle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fixedAmount">Fixed amount ($)</Label>
          <Input
            id="fixedAmount"
            name="fixedAmount"
            type="number"
            step="0.01"
            defaultValue={0}
            disabled={billingSource !== "Fixed"}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gstRate">GST %</Label>
          <Input id="gstRate" name="gstRate" type="number" step="0.1" defaultValue={GST_DEFAULT} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="paymentTermsDays">Payment terms (days)</Label>
          <Input id="paymentTermsDays" name="paymentTermsDays" type="number" defaultValue={30} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea id="remarks" name="remarks" rows={2} placeholder="Optional" />
      </div>

      <DialogFooter>
        <Button type="submit">Save contract</Button>
      </DialogFooter>
    </form>
  );
}

function RateForm({
  clients,
  projects,
  onSubmit,
}: {
  clients: ReturnType<typeof getClients>;
  projects: ReturnType<typeof getProjects>;
  onSubmit: (data: FormData) => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState("all");
  const [unit, setUnit] = useState<RateUnit>("Hourly");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="unit" value={unit} />

      <div className="space-y-1">
        <Label>Client</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Project</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects
              .filter((p) => p.clientId === clientId)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="trade">Designation</Label>
          <Input id="trade" name="trade" placeholder="e.g. Welder or All" defaultValue="All" />
        </div>
        <div className="space-y-1">
          <Label>Unit</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as RateUnit)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="normalRate">Normal rate ($)</Label>
          <Input id="normalRate" name="normalRate" type="number" step="0.01" defaultValue={0} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="otRate">OT rate / hr ($)</Label>
          <Input id="otRate" name="otRate" type="number" step="0.01" defaultValue={0} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="effectiveFrom">Effective from</Label>
          <Input
            id="effectiveFrom"
            name="effectiveFrom"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="effectiveTo">Effective to</Label>
          <Input id="effectiveTo" name="effectiveTo" type="date" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea id="remarks" name="remarks" rows={2} placeholder="Optional" />
      </div>

      <DialogFooter>
        <Button type="submit">Save rate</Button>
      </DialogFooter>
    </form>
  );
}
