import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Wallet, TrendingUp, TrendingDown, Receipt, Plus, Trash2, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getExpenses, getReceipts, getInvoices, getClients, getProjects, getCurrentCompany,
  addExpense, deleteExpense, markExpensePaid, addReceipt, deleteReceipt,
  financeSummary, financeTrend, expenseCategories, paymentModes,
} from "@/lib/store";
import { exportRows, timestampedName } from "@/lib/xlsx";
import type { Expense, PaymentReceipt } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — BSM Workforce & Operations" },
      { name: "description", content: "Expenses, levy payments, client collections and monthly profit summary." },
      { property: "og:title", content: "Finance — BSM Workforce & Operations" },
      { property: "og:description", content: "Expenses, levy payments, client collections and monthly profit summary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const sgd = (n: number) => `S$${n.toLocaleString("en-SG", { maximumFractionDigits: 0 })}`;

const emptyExpense = {
  expenseDate: today(),
  category: "Levy" as Expense["category"],
  description: "",
  vendor: "",
  projectId: "",
  amount: 0,
  gstAmount: 0,
  paymentMode: "Bank Transfer" as Expense["paymentMode"],
  referenceNo: "",
  status: "Pending" as Expense["status"],
  remarks: "",
};

const emptyReceipt = {
  invoiceId: "",
  clientId: "",
  receiptNo: "",
  receivedOn: today(),
  amount: 0,
  paymentMode: "Bank Transfer" as PaymentReceipt["paymentMode"],
  referenceNo: "",
  remarks: "",
};

function expenseVariant(status: Expense["status"]) {
  if (status === "Paid") return "success" as const;
  if (status === "Rejected") return "destructive" as const;
  if (status === "Approved") return "default" as const;
  return "warning" as const;
}

export default function FinancePage() {
  const companyId = getCurrentCompany();
  const [expenses, setExpenses] = useState(getExpenses());
  const [receipts, setReceipts] = useState(getReceipts());
  const [invoices, setInvoices] = useState(getInvoices());
  const [clients] = useState(getClients());
  const [projects] = useState(getProjects());
  const [month, setMonth] = useState(thisMonth());
  const [search, setSearch] = useState("");
  const [expOpen, setExpOpen] = useState(false);
  const [rcpOpen, setRcpOpen] = useState(false);
  const [expForm, setExpForm] = useState(emptyExpense);
  const [rcpForm, setRcpForm] = useState(emptyReceipt);

  function refresh() {
    setExpenses(getExpenses());
    setReceipts(getReceipts());
    setInvoices(getInvoices());
  }

  const scopedExpenses = useMemo(
    () => expenses.filter((e) => !companyId || !e.companyId || e.companyId === companyId),
    [expenses, companyId],
  );
  const scopedReceipts = useMemo(
    () => receipts.filter((r) => !companyId || !r.companyId || r.companyId === companyId),
    [receipts, companyId],
  );

  const summary = financeSummary(month, companyId || undefined);
  const trend = financeTrend(6, companyId || undefined);
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.revenue, t.cost)));

  const q = search.trim().toLowerCase();
  const filteredExpenses = scopedExpenses.filter(
    (e) => !q || e.description.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) || (e.vendor ?? "").toLowerCase().includes(q),
  );

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const invoiceNo = (id?: string) => invoices.find((i) => i.id === id)?.invoiceNo ?? "—";
  const openInvoices = invoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled");

  function saveExpense() {
    if (!expForm.description.trim()) return toast.error("Description required");
    if (!Number(expForm.amount)) return toast.error("Amount required");
    addExpense({
      ...expForm,
      projectId: expForm.projectId || undefined,
      amount: Number(expForm.amount) || 0,
      gstAmount: Number(expForm.gstAmount) || 0,
      companyId: companyId || undefined,
    });
    setExpForm({ ...emptyExpense, expenseDate: today() });
    setExpOpen(false);
    refresh();
    toast.success("Expense recorded");
  }

  function saveReceipt() {
    if (!Number(rcpForm.amount)) return toast.error("Amount required");
    const inv = invoices.find((i) => i.id === rcpForm.invoiceId);
    addReceipt({
      ...rcpForm,
      invoiceId: rcpForm.invoiceId || undefined,
      clientId: rcpForm.clientId || inv?.clientId || undefined,
      amount: Number(rcpForm.amount) || 0,
      companyId: companyId || undefined,
    });
    setRcpForm({ ...emptyReceipt, receivedOn: today() });
    setRcpOpen(false);
    refresh();
    toast.success("Payment recorded");
  }

  async function exportFinance() {
    await exportRows(
      filteredExpenses.map((e) => ({
        Date: e.expenseDate, Category: e.category, Description: e.description,
        Vendor: e.vendor ?? "", Amount: e.amount, GST: e.gstAmount,
        Mode: e.paymentMode ?? "", Reference: e.referenceNo ?? "",
        Status: e.status, "Paid On": e.paidOn ?? "",
      })),
      timestampedName("finance_expenses", "xlsx"),
      "Expenses",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Finance</h1>
            <p className="text-sm text-muted-foreground">
              Expenses, levy payments, client collections and monthly profit summary.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-[150px]"
            />
            <Button size="sm" variant="outline" onClick={exportFinance} disabled={!filteredExpenses.length}>
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Revenue (month)" value={sgd(summary.revenue)} icon={<TrendingUp className="h-5 w-5" />} caption={`${summary.invoiceCount} invoices`} />
          <SummaryCard title="Expenses (month)" value={sgd(summary.cost)} icon={<TrendingDown className="h-5 w-5" />} caption={`${summary.expenseCount} entries`} />
          <SummaryCard
            title="Profit (month)"
            value={sgd(summary.profit)}
            icon={<Wallet className="h-5 w-5" />}
            caption={`${summary.margin}% margin`}
            variant={summary.profit >= 0 ? "success" : "destructive"}
          />
          <SummaryCard title="Outstanding AR" value={sgd(summary.outstanding)} icon={<Receipt className="h-5 w-5" />} caption={`Collected ${sgd(summary.collected)}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Revenue vs Cost (6 months)</h2>
            <div className="mt-4 space-y-3">
              {trend.map((t) => (
                <div key={t.month} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t.month}</span>
                    <span className={t.profit >= 0 ? "text-emerald-600" : "text-destructive"}>{sgd(t.profit)}</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gradient-primary" style={{ width: `${(t.revenue / maxTrend) * 100}%` }} />
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-destructive/70" style={{ width: `${(t.cost / maxTrend) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Expense breakdown — {month}</h2>
            {summary.byCategory.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No expenses recorded for this month.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {summary.byCategory.map((row) => (
                  <div key={row.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{row.category}</span>
                      <span className="text-muted-foreground">{sgd(row.amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-primary"
                        style={{ width: `${(row.amount / Math.max(1, summary.cost)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="receipts">Collections</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Dialog open={expOpen} onOpenChange={setExpOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New expense</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Record expense</DialogTitle>
                    <DialogDescription>Levy, dormitory, transport, agent fees and other company costs.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={expForm.expenseDate} onChange={(e) => setExpForm({ ...expForm, expenseDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={expForm.category} onValueChange={(v) => setExpForm({ ...expForm, category: v as Expense["category"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Description</Label>
                      <Input value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="e.g. Monthly foreign worker levy" />
                    </div>
                    <div className="space-y-2">
                      <Label>Vendor / Payee</Label>
                      <Input value={expForm.vendor} onChange={(e) => setExpForm({ ...expForm, vendor: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Project (optional)</Label>
                      <Select value={expForm.projectId || "none"} onValueChange={(v) => setExpForm({ ...expForm, projectId: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (S$)</Label>
                      <Input type="number" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>GST (S$)</Label>
                      <Input type="number" value={expForm.gstAmount} onChange={(e) => setExpForm({ ...expForm, gstAmount: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment mode</Label>
                      <Select value={expForm.paymentMode} onValueChange={(v) => setExpForm({ ...expForm, paymentMode: v as Expense["paymentMode"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reference no.</Label>
                      <Input value={expForm.referenceNo} onChange={(e) => setExpForm({ ...expForm, referenceNo: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={expForm.status} onValueChange={(v) => setExpForm({ ...expForm, status: v as Expense["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["Pending", "Approved", "Paid", "Rejected"] as Expense["status"][]).map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Remarks</Label>
                      <Textarea rows={2} value={expForm.remarks} onChange={(e) => setExpForm({ ...expForm, remarks: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setExpOpen(false)}>Cancel</Button>
                    <Button onClick={saveExpense}>Save expense</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {filteredExpenses.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-6 w-6" />}
                title="No expenses yet"
                description="Record levy, dormitory, transport and other company costs to build the P&L."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap">{e.expenseDate}</TableCell>
                        <TableCell>{e.category}</TableCell>
                        <TableCell className="max-w-[240px] truncate">{e.description}</TableCell>
                        <TableCell>{e.vendor || "—"}</TableCell>
                        <TableCell className="text-right">{sgd(e.amount)}</TableCell>
                        <TableCell><StatusBadge variant={expenseVariant(e.status)} label={e.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {e.status !== "Paid" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Mark paid"
                                onClick={() => { markExpensePaid(e.id); refresh(); toast.success("Marked as paid"); }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Delete"
                              onClick={() => { deleteExpense(e.id); refresh(); toast.success("Expense deleted"); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={rcpOpen} onOpenChange={setRcpOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Record payment</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Record client payment</DialogTitle>
                    <DialogDescription>Linked invoices are updated to Partially Paid / Paid automatically.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Invoice</Label>
                      <Select
                        value={rcpForm.invoiceId || "none"}
                        onValueChange={(v) => {
                          const inv = invoices.find((i) => i.id === v);
                          setRcpForm({
                            ...rcpForm,
                            invoiceId: v === "none" ? "" : v,
                            clientId: inv?.clientId ?? "",
                            amount: inv ? Math.max(0, (inv.total || 0) - (inv.amountPaid || 0)) : rcpForm.amount,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No invoice (ad-hoc)</SelectItem>
                          {openInvoices.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.invoiceNo} — {clientName(i.clientId)} ({sgd((i.total || 0) - (i.amountPaid || 0))} due)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Received on</Label>
                      <Input type="date" value={rcpForm.receivedOn} onChange={(e) => setRcpForm({ ...rcpForm, receivedOn: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (S$)</Label>
                      <Input type="number" value={rcpForm.amount} onChange={(e) => setRcpForm({ ...rcpForm, amount: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select value={rcpForm.paymentMode} onValueChange={(v) => setRcpForm({ ...rcpForm, paymentMode: v as PaymentReceipt["paymentMode"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reference no.</Label>
                      <Input value={rcpForm.referenceNo} onChange={(e) => setRcpForm({ ...rcpForm, referenceNo: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRcpOpen(false)}>Cancel</Button>
                    <Button onClick={saveReceipt}>Save payment</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {scopedReceipts.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title="No collections yet"
                description="Record client payments here to track outstanding receivables."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedReceipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.receiptNo}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.receivedOn}</TableCell>
                        <TableCell>{clientName(r.clientId)}</TableCell>
                        <TableCell>{invoiceNo(r.invoiceId)}</TableCell>
                        <TableCell>{r.paymentMode}</TableCell>
                        <TableCell className="text-right">{sgd(r.amount)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete"
                            onClick={() => { deleteReceipt(r.id); refresh(); toast.success("Receipt deleted"); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
