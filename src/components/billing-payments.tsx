import { useMemo, useState } from "react";
import { Banknote, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";
import { ExportButton } from "@/components/data-io";
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
import type {
  Client,
  Expense,
  ExpenseCategory,
  Invoice,
  PaymentMode,
  PaymentReceipt,
} from "@/lib/types";

const modes: PaymentMode[] = ["Bank Transfer", "GIRO", "Cheque", "Cash", "PayNow", "Other"];
const categories: ExpenseCategory[] = [
  "Levy",
  "Salary",
  "Dormitory",
  "Transport",
  "Insurance",
  "Medical",
  "PPE & Assets",
  "Training",
  "Agent Fee",
  "Office",
  "Government Fee",
  "Other",
];

const money = (n: number) =>
  `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

/** QuickBooks-style "Payments received" register. */
export function PaymentsReceived({
  receipts,
  invoices,
  clients,
  onAdd,
  onDelete,
}: {
  receipts: PaymentReceipt[];
  invoices: Invoice[];
  clients: Client[];
  onAdd: (input: {
    clientId?: string;
    invoiceId?: string;
    receivedOn: string;
    amount: number;
    paymentMode: PaymentMode;
    referenceNo?: string;
    remarks?: string;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("Bank Transfer");
  const [receivedOn, setReceivedOn] = useState(today());
  const [reference, setReference] = useState("");

  const openInvoices = invoices.filter(
    (i) => i.status !== "Paid" && i.status !== "Cancelled" && i.total - i.amountPaid > 0.01,
  );
  const selected = openInvoices.find((i) => i.id === invoiceId);

  const monthTotal = receipts
    .filter((r) => r.receivedOn?.slice(0, 7) === today().slice(0, 7))
    .reduce((s, r) => s + r.amount, 0);
  const allTotal = receipts.reduce((s, r) => s + r.amount, 0);
  const undeposited = receipts
    .filter((r) => r.paymentMode === "Cash" || r.paymentMode === "Cheque")
    .reduce((s, r) => s + r.amount, 0);

  function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    onAdd({
      invoiceId: invoiceId || undefined,
      clientId: selected?.clientId,
      receivedOn,
      amount: Math.round(value * 100) / 100,
      paymentMode: mode,
      referenceNo: reference || undefined,
    });
    setOpen(false);
    setInvoiceId("");
    setAmount("");
    setReference("");
  }

  const rows = receipts.map((r) => ({
    Receipt: r.receiptNo,
    Date: r.receivedOn,
    Client: clients.find((c) => c.id === r.clientId)?.name ?? "",
    Invoice: invoices.find((i) => i.id === r.invoiceId)?.invoiceNo ?? "",
    Method: r.paymentMode,
    Reference: r.referenceNo ?? "",
    Amount: r.amount,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Received this month"
          value={money(monthTotal)}
          icon={<Banknote className="h-5 w-5" />}
          variant="success"
          caption="Deposits recorded"
        />
        <SummaryCard
          title="All payments"
          value={money(allTotal)}
          icon={<Wallet className="h-5 w-5" />}
          variant="primary"
          caption={`${receipts.length} receipt(s)`}
        />
        <SummaryCard
          title="Cash & cheque"
          value={money(undeposited)}
          icon={<Receipt className="h-5 w-5" />}
          variant="warning"
          caption="Verify bank deposit"
        />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Payments received</h2>
            <p className="text-sm text-muted-foreground">
              Every receipt is matched to an invoice and updates its balance automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton rows={rows} baseName="payments-received" sheetName="Payments" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Receive payment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Receive payment</DialogTitle>
                  <DialogDescription>
                    Apply a customer payment to an open invoice.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Open invoice</Label>
                    <Select
                      value={invoiceId}
                      onValueChange={(v) => {
                        setInvoiceId(v);
                        const inv = openInvoices.find((i) => i.id === v);
                        if (inv)
                          setAmount(
                            (Math.round((inv.total - inv.amountPaid) * 100) / 100).toFixed(2),
                          );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {openInvoices.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.invoiceNo} · {clients.find((c) => c.id === i.clientId)?.name ?? "—"}{" "}
                            · {money(Math.round((i.total - i.amountPaid) * 100) / 100)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="rcpAmount">Amount</Label>
                      <Input
                        id="rcpAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rcpDate">Payment date</Label>
                      <Input
                        id="rcpDate"
                        type="date"
                        value={receivedOn}
                        onChange={(e) => setReceivedOn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Method</Label>
                      <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {modes.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rcpRef">Reference</Label>
                      <Input
                        id="rcpRef"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Bank ref / cheque no"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={submit}>
                    Save payment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <EmptyState
                      className="border-0 bg-transparent"
                      icon={<Banknote className="h-5 w-5" />}
                      title="No payments recorded"
                      description="Use Receive payment to apply a customer deposit to an open invoice."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.receiptNo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.receivedOn}</TableCell>
                    <TableCell>{clients.find((c) => c.id === r.clientId)?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {invoices.find((i) => i.id === r.invoiceId)?.invoiceNo ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="info" label={r.paymentMode} />
                      {r.referenceNo && (
                        <div className="mt-0.5 text-xs text-muted-foreground">{r.referenceNo}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-500">
                      {money(r.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Delete receipt"
                        onClick={() => onDelete(r.id)}
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
    </div>
  );
}

/** QuickBooks-style "Expenses / Bills" register (accounts payable). */
export function BillsAndExpenses({
  expenses,
  onAdd,
  onPay,
  onDelete,
}: {
  expenses: Expense[];
  onAdd: (input: Omit<Expense, "id" | "createdAt" | "updatedAt">) => void;
  onPay: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Expense["status"]>("all");

  const visible = useMemo(
    () => expenses.filter((e) => filter === "all" || e.status === filter),
    [expenses, filter],
  );
  const unpaid = expenses
    .filter((e) => e.status === "Pending" || e.status === "Approved")
    .reduce((s, e) => s + e.amount, 0);
  const paid = expenses.filter((e) => e.status === "Paid").reduce((s, e) => s + e.amount, 0);
  const inputGst = expenses
    .filter((e) => e.status !== "Rejected")
    .reduce((s, e) => s + (e.gstAmount || 0), 0);

  function submit(form: FormData) {
    const amount = Number(form.get("amount") ?? 0);
    if (amount <= 0) {
      toast.error("Enter a bill amount");
      return;
    }
    onAdd({
      expenseDate: (form.get("expenseDate") as string) || today(),
      category: form.get("category") as ExpenseCategory,
      description: (form.get("description") as string) || "Bill",
      vendor: (form.get("vendor") as string) || undefined,
      amount,
      gstAmount: Number(form.get("gstAmount") ?? 0),
      paymentMode: (form.get("paymentMode") as PaymentMode) || undefined,
      referenceNo: (form.get("referenceNo") as string) || undefined,
      status: "Pending",
    });
    setOpen(false);
  }

  const rows = visible.map((e) => ({
    Date: e.expenseDate,
    Vendor: e.vendor ?? "",
    Category: e.category,
    Description: e.description,
    Amount: e.amount,
    GST: e.gstAmount,
    Status: e.status,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Unpaid bills"
          value={money(unpaid)}
          icon={<Receipt className="h-5 w-5" />}
          variant="warning"
          caption="Accounts payable"
        />
        <SummaryCard
          title="Paid"
          value={money(paid)}
          icon={<Wallet className="h-5 w-5" />}
          variant="success"
          caption="Settled this period"
        />
        <SummaryCard
          title="Input GST claimable"
          value={money(inputGst)}
          icon={<Banknote className="h-5 w-5" />}
          variant="primary"
          caption="Feeds the GST return"
        />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Bills & expenses</h2>
            <p className="text-sm text-muted-foreground">
              Supplier bills, levy payments and operating costs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {(["Pending", "Approved", "Paid", "Rejected"] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton rows={rows} baseName="bills-expenses" sheetName="Bills" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Add bill
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add bill / expense</DialogTitle>
                  <DialogDescription>
                    Record a supplier bill so payables and GST stay accurate.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(new FormData(e.currentTarget));
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="expenseDate">Bill date</Label>
                      <Input
                        id="expenseDate"
                        name="expenseDate"
                        type="date"
                        defaultValue={today()}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vendor">Vendor</Label>
                      <Input id="vendor" name="vendor" placeholder="Supplier name" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      name="description"
                      placeholder="e.g. Foreign worker levy — August"
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select name="category" defaultValue="Other">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Payment method</Label>
                      <Select name="paymentMode" defaultValue="Bank Transfer">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {modes.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Amount</Label>
                      <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gstAmount">GST</Label>
                      <Input
                        id="gstAmount"
                        name="gstAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="referenceNo">Reference</Label>
                    <Input id="referenceNo" name="referenceNo" placeholder="Invoice / PO number" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" size="sm">
                      Save bill
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <EmptyState
                      className="border-0 bg-transparent"
                      icon={<Receipt className="h-5 w-5" />}
                      title="No bills recorded"
                      description="Add supplier bills to track payables and claimable input GST."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground">{e.expenseDate}</TableCell>
                    <TableCell>{e.vendor ?? "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{e.description}</TableCell>
                    <TableCell className="text-xs">{e.category}</TableCell>
                    <TableCell className="text-right font-medium">
                      {money(e.amount)}
                      {e.gstAmount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          GST {money(e.gstAmount)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={
                          e.status === "Paid"
                            ? "success"
                            : e.status === "Rejected"
                              ? "destructive"
                              : "warning"
                        }
                        label={e.status}
                        dot
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {e.status !== "Paid" && (
                          <Button size="sm" variant="secondary" onClick={() => onPay(e.id)}>
                            Mark paid
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => onDelete(e.id)}>
                          <Trash2 className="h-4 w-4" />
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
  );
}
