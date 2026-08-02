import { useMemo, useState } from "react";
import { BarChart3, Percent, Printer, TrendingUp, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client, Expense, Invoice, PaymentReceipt } from "@/lib/types";

const money = (n: number) =>
  `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const days = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);

type Bucket = "current" | "d30" | "d60" | "d90";

function bucketOf(dueDate: string | undefined): Bucket {
  if (!dueDate) return "current";
  const late = days(dueDate, today());
  if (late <= 0) return "current";
  if (late <= 30) return "d30";
  if (late <= 60) return "d60";
  return "d90";
}

/** QuickBooks-style report pack: A/R ageing, sales by customer, GST return, statements. */
export function BillingReports({
  invoices,
  clients,
  receipts,
  expenses,
}: {
  invoices: Invoice[];
  clients: Client[];
  receipts: PaymentReceipt[];
  expenses: Expense[];
}) {
  const [report, setReport] = useState("ageing");
  const [statementClient, setStatementClient] = useState("");
  const [gstFrom, setGstFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2, 1);
    return d.toISOString().slice(0, 10);
  });
  const [gstTo, setGstTo] = useState(today());

  const open = invoices.filter((i) => i.status !== "Cancelled" && i.total - i.amountPaid > 0.01);

  const ageing = useMemo(() => {
    const map = new Map<string, Record<Bucket, number> & { total: number }>();
    for (const inv of open) {
      const key = inv.clientId;
      const row = map.get(key) ?? { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
      const balance = Math.round((inv.total - inv.amountPaid) * 100) / 100;
      row[bucketOf(inv.dueDate)] += balance;
      row.total += balance;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([clientId, row]) => ({ clientId, name: clients.find((c) => c.id === clientId)?.name ?? "—", ...row }))
      .sort((a, b) => b.total - a.total);
  }, [open, clients]);

  const salesByClient = useMemo(() => {
    const map = new Map<string, { billed: number; collected: number; count: number }>();
    for (const inv of invoices.filter((i) => i.status !== "Cancelled")) {
      const row = map.get(inv.clientId) ?? { billed: 0, collected: 0, count: 0 };
      row.billed += inv.total;
      row.collected += inv.amountPaid;
      row.count += 1;
      map.set(inv.clientId, row);
    }
    return [...map.entries()]
      .map(([clientId, row]) => ({
        clientId,
        name: clients.find((c) => c.id === clientId)?.name ?? "—",
        ...row,
        balance: Math.round((row.billed - row.collected) * 100) / 100,
      }))
      .sort((a, b) => b.billed - a.billed);
  }, [invoices, clients]);

  const gst = useMemo(() => {
    const inRange = (d?: string) => !!d && d >= gstFrom && d <= gstTo;
    const sales = invoices.filter((i) => i.status !== "Cancelled" && inRange(i.issueDate));
    const bills = expenses.filter((e) => e.status !== "Rejected" && inRange(e.expenseDate));
    const standardSupplies = sales.reduce((s, i) => s + i.subtotal, 0);
    const outputTax = sales.reduce((s, i) => s + i.gstAmount, 0);
    const purchases = bills.reduce((s, e) => s + e.amount, 0);
    const inputTax = bills.reduce((s, e) => s + (e.gstAmount || 0), 0);
    return {
      standardSupplies,
      outputTax,
      purchases,
      inputTax,
      net: Math.round((outputTax - inputTax) * 100) / 100,
      invoiceCount: sales.length,
    };
  }, [invoices, expenses, gstFrom, gstTo]);

  const statementRows = useMemo(() => {
    if (!statementClient) return [];
    const rows: { date: string; ref: string; detail: string; charge: number; credit: number }[] = [];
    for (const inv of invoices.filter((i) => i.clientId === statementClient && i.status !== "Cancelled")) {
      rows.push({ date: inv.issueDate, ref: inv.invoiceNo, detail: `Invoice · due ${inv.dueDate}`, charge: inv.total, credit: 0 });
    }
    for (const r of receipts.filter((r) => r.clientId === statementClient)) {
      rows.push({ date: r.receivedOn, ref: r.receiptNo, detail: `Payment · ${r.paymentMode}`, charge: 0, credit: r.amount });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [statementClient, invoices, receipts]);

  let running = 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Reports</h2>
            <p className="text-sm text-muted-foreground">
              A/R ageing, sales by customer, GST return summary and customer statements.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={report} onValueChange={setReport}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ageing">A/R ageing summary</SelectItem>
                <SelectItem value="sales">Sales by customer</SelectItem>
                <SelectItem value="gst">GST return summary</SelectItem>
                <SelectItem value="statement">Customer statement</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {report === "ageing" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4 text-primary" /> Accounts receivable ageing as at {today()}
              </p>
              <ExportButton
                rows={ageing.map((r) => ({
                  Client: r.name, Current: r.current, "1-30": r.d30, "31-60": r.d60, "60+": r.d90, Total: r.total,
                }))}
                baseName="ar-ageing"
                sheetName="Ageing"
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">1-30 days</TableHead>
                    <TableHead className="text-right">31-60 days</TableHead>
                    <TableHead className="text-right">60+ days</TableHead>
                    <TableHead className="text-right">Total due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ageing.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        Nothing outstanding — every invoice is settled.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {ageing.map((r) => (
                        <TableRow key={r.clientId}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right">{money(r.current)}</TableCell>
                          <TableCell className="text-right">{money(r.d30)}</TableCell>
                          <TableCell className="text-right text-amber-500">{money(r.d60)}</TableCell>
                          <TableCell className="text-right text-destructive">{money(r.d90)}</TableCell>
                          <TableCell className="text-right font-semibold">{money(r.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-semibold">Total</TableCell>
                        {(["current", "d30", "d60", "d90"] as Bucket[]).map((b) => (
                          <TableCell key={b} className="text-right font-semibold">
                            {money(ageing.reduce((s, r) => s + r[b], 0))}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold">
                          {money(ageing.reduce((s, r) => s + r.total, 0))}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {report === "sales" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" /> Sales by customer
              </p>
              <ExportButton
                rows={salesByClient.map((r) => ({
                  Client: r.name, Invoices: r.count, Billed: r.billed, Collected: r.collected, Balance: r.balance,
                }))}
                baseName="sales-by-customer"
                sheetName="Sales"
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-40">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesByClient.map((r) => {
                    const top = salesByClient[0]?.billed || 1;
                    return (
                      <TableRow key={r.clientId}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.count}</TableCell>
                        <TableCell className="text-right font-medium">{money(r.billed)}</TableCell>
                        <TableCell className="text-right text-emerald-500">{money(r.collected)}</TableCell>
                        <TableCell className="text-right">{money(r.balance)}</TableCell>
                        <TableCell>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.billed / top) * 100}%` }} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {report === "gst" && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gstFrom">Period from</Label>
                <Input id="gstFrom" type="date" value={gstFrom} onChange={(e) => setGstFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gstTo">Period to</Label>
                <Input id="gstTo" type="date" value={gstTo} onChange={(e) => setGstTo(e.target.value)} className="w-40" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Box 1 · Standard-rated supplies", value: gst.standardSupplies },
                { label: "Box 6 · Output tax due", value: gst.outputTax },
                { label: "Box 5 · Taxable purchases", value: gst.purchases },
                { label: "Box 7 · Input tax claimed", value: gst.inputTax },
              ].map((b) => (
                <div key={b.label} className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">{b.label}</div>
                  <div className="mt-1 text-lg font-semibold">{money(b.value)}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Percent className="h-4 w-4 text-primary" /> Box 8 · Net GST {gst.net >= 0 ? "payable to IRAS" : "refundable"}
              </div>
              <div className="mt-1 text-2xl font-semibold">{money(Math.abs(gst.net))}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on {gst.invoiceCount} tax invoice(s) issued in the selected period. Review before filing GST F5.
              </p>
            </div>
          </div>
        )}

        {report === "statement" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select value={statementClient} onValueChange={setStatementClient}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Statement of account
              </p>
            </div>
            {!statementClient ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Choose a client to build their statement of account.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead className="text-right">Charge</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statementRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                          No transactions for this client yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      statementRows.map((r, idx) => {
                        running = Math.round((running + r.charge - r.credit) * 100) / 100;
                        return (
                          <TableRow key={`${r.ref}-${idx}`}>
                            <TableCell className="text-xs text-muted-foreground">{r.date}</TableCell>
                            <TableCell className="font-medium">{r.ref}</TableCell>
                            <TableCell className="text-xs">{r.detail}</TableCell>
                            <TableCell className="text-right">{r.charge ? money(r.charge) : "—"}</TableCell>
                            <TableCell className="text-right text-emerald-500">{r.credit ? money(r.credit) : "—"}</TableCell>
                            <TableCell className="text-right font-semibold">{money(running)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}