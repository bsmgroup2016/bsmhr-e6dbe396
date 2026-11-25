import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Download, Eye, Pencil, Ban, CreditCard, RefreshCw, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { loadDormBilling, mutateDormBilling, setupDormBilling } from "@/lib/dormitory-billing.functions";
import { billingDate, monthlyRentEstimate, rentBalance, rentInvoiceSchema, validatePaymentAmount, type RentInvoice } from "@/core/dormitory-billing";
import { getCompanies, getEmployees, getAllocations, getCurrentUser } from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { Dormitory } from "@/lib/types";
const currency = (value: number) => new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(value);
const blank = () => ({ dormitoryId: "", companyId: "", invoiceNo: "", month: billingDate().slice(0, 7), invoiceDate: billingDate(), dueDate: billingDate(), totalAmount: 0, remarks: "" });
export function DormitoryBilling({ dormitories, companyId }: { dormitories: Dormitory[]; companyId: string | null }) {
  const load = useServerFn(loadDormBilling);
  const mutate = useServerFn(mutateDormBilling);
  const setup = useServerFn(setupDormBilling);
  const query = useQuery({ queryKey: ["dormitory-billing", getCurrentUser()?.id ?? "signed-out", companyId], queryFn: () => load(), staleTime: 0 });
  const [dormFilter, setDormFilter] = useState("all");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [form, setForm] = useState(blank);
  const [selected, setSelected] = useState<RentInvoice | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState({ requestId: "", paidOn: billingDate(), amount: 0, method: "Bank transfer" as "Bank transfer" | "PayNow" | "Cash" | "Cheque" | "Other", reference: "", remarks: "" });
  const [busy, setBusy] = useState(false);
  const companies = getCompanies().filter((c) => !companyId || c.id === companyId);
  const invoices = (query.data?.invoices ?? []).filter((i) => (!companyId || i.company_id === companyId) && dormitories.some((d) => d.id === i.dormitory_id));
  const payments = query.data?.payments ?? [];
  const dormName = (id: string) => dormitories.find((d) => d.id === id)?.name ?? "Dormitory";
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "Company";
  const today = billingDate();
  const filtered = invoices.filter((i) => (dormFilter === "all" || i.dormitory_id === dormFilter) && (!month || i.month === month) && (status === "all" || rentBalance(i, payments, today).status === status) && `${i.invoice_no} ${dormName(i.dormitory_id)} ${companyName(i.company_id)}`.toLowerCase().includes(search.toLowerCase()));
  const totals = filtered.filter((i) => !i.voided).reduce((s, i) => { const b = rentBalance(i, payments, today); return { invoiced: s.invoiced + Number(i.total_amount), paid: s.paid + b.paid, balance: s.balance + b.outstanding, overdue: s.overdue + (b.status === "Overdue" ? b.outstanding : 0) }; }, { invoiced: 0, paid: 0, balance: 0, overdue: 0 });
  const active = selected ? invoices.find((i) => i.id === selected.id) ?? selected : null;
  const activeBalance = active ? rentBalance(active, payments, today) : null;
  async function operation(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await work(); await query.refetch({ throwOnError: true }); toast.success(success); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save. Refresh and retry"); return false; }
    finally { setBusy(false); }
  }
  function estimate() {
    const ids = new Set(getEmployees().filter((e) => e.companyId === form.companyId).map((e) => e.id));
    return monthlyRentEstimate(getAllocations(), form.dormitoryId, form.month, ids);
  }
  function openInvoice(i?: RentInvoice) {
    setEditId(i?.id);
    setForm(i ? { dormitoryId: i.dormitory_id, companyId: i.company_id, invoiceNo: i.invoice_no, month: i.month, invoiceDate: i.invoice_date, dueDate: i.due_date, totalAmount: Number(i.total_amount), remarks: i.remarks } : { ...blank(), companyId: companyId ?? "", invoiceNo: `DORM-${today.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}` });
    setOpen(true);
  }
  async function saveInvoice() {
    const parsed = rentInvoiceSchema.safeParse({ ...form, ...(editId ? { id: editId } : {}) });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Review invoice details");
    if (await operation(() => mutate({ data: { action: editId ? "update" : "create", payload: parsed.data } }), "Invoice saved")) setOpen(false);
  }
  async function savePayment() {
    if (!active || !activeBalance) return;
    try { validatePaymentAmount(payment.amount, activeBalance.outstanding); }
    catch (e) { return toast.error(e instanceof Error ? e.message : "Invalid payment"); }
    if (payment.paidOn > today) return toast.error("Payment date cannot be in the future");
    if (await operation(() => mutate({ data: { action: "payment", payload: { ...payment, id: active.id } } }), "Payment recorded")) setPaymentOpen(false);
  }
  function openPayment(i: RentInvoice) {
    setSelected(i); setPayment({ requestId: crypto.randomUUID(), paidOn: today, amount: rentBalance(i, payments, today).outstanding, method: "Bank transfer", reference: "", remarks: "" }); setPaymentOpen(true);
  }
  async function pdf(i: RentInvoice) {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF(); const b = rentBalance(i, payments, today);
    doc.setFontSize(18); doc.text("DORMITORY RENT INVOICE", 14, 20);
    doc.setFontSize(10);
    const lines = [companyName(i.company_id), `Dormitory: ${dormName(i.dormitory_id)}`, `Invoice: ${i.invoice_no}`, `Rent month: ${i.month}`, `Issued: ${i.invoice_date}   Due: ${i.due_date}`, `Status: ${b.status}`];
    let y = 30;
    for (const line of lines) { const wrapped = doc.splitTextToSize(line, 180); doc.text(wrapped, 14, y); y += wrapped.length * 5 + 2; }
    autoTable(doc, { startY: y + 4, head: [["Rent total (SGD)", "Paid (SGD)", "Outstanding (SGD)"]], body: [[Number(i.total_amount).toFixed(2), b.paid.toFixed(2), b.outstanding.toFixed(2)]] });
    autoTable(doc, { startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12, head: [["Payment date", "Method", "Reference", "Amount (SGD)"]], body: payments.filter((p) => p.invoice_id === i.id).map((p) => [p.paid_on, p.method, p.reference, Number(p.amount).toFixed(2)]) });
    if (i.remarks) { const end = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY; autoTable(doc, { startY: end + 10, head: [["Remarks"]], body: [[i.remarks]] }); }
    doc.save(`${i.invoice_no.replace(/[^a-z0-9_-]/gi, "_")}.pdf`);
  }
  if (query.isPending) return <p className="py-8 text-muted-foreground">Loading rent invoices…</p>;
  if (query.isError) return <div className="space-y-3 py-6"><p role="alert" className="text-destructive">{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-2 size-4" />Retry</Button></div>;
  if (!query.data?.ready) return <div className="space-y-3 py-6"><h2 className="font-semibold">Dormitory billing is not enabled</h2>{query.data?.admin ? <Button disabled={busy} onClick={() => { if (window.confirm("Enable dormitory invoices and payment tracking in your existing database?")) void operation(() => setup(), "Dormitory billing enabled"); }}><Receipt className="mr-2 size-4" />{busy ? "Enabling…" : "Enable billing"}</Button> : <p className="text-muted-foreground">Ask your administrator to enable dormitory billing.</p>}</div>;
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4 border-b pb-5 lg:grid-cols-4">{([["Invoiced", totals.invoiced, "text-foreground"], ["Paid", totals.paid, "text-success"], ["Outstanding", totals.balance, "text-warning"], ["Overdue", totals.overdue, "text-destructive"]] as const).map(([label, value, color]) => <div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold ${color}`}>{currency(value)}</p></div>)}</div>
    <div className="flex flex-wrap items-center gap-2">
      <Input className="w-full sm:w-56" aria-label="Search invoices" placeholder="Invoice, dormitory or company" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Select value={dormFilter} onValueChange={setDormFilter}><SelectTrigger className="w-48" aria-label="Filter dormitory"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All dormitories</SelectItem>{dormitories.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
      <Input className="w-40" type="month" aria-label="Rent month filter" value={month} onChange={(e) => setMonth(e.target.value)} />
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36" aria-label="Filter invoice status"><SelectValue /></SelectTrigger><SelectContent>{["all", "Unpaid", "Partial", "Paid", "Overdue", "Void"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}</SelectContent></Select>
      <Button variant="ghost" onClick={() => { setDormFilter("all"); setMonth(""); setStatus("all"); setSearch(""); }}>Clear</Button>
      <div className="ml-auto flex gap-2"><Button variant="outline" size="sm" aria-label="Refresh invoices" disabled={busy} onClick={() => void query.refetch()}><RefreshCw className="size-4" /></Button><Button variant="outline" size="sm" disabled={!filtered.length} onClick={() => void exportRows(filtered.map((i) => { const b = rentBalance(i, payments, today); return { Invoice: i.invoice_no, Company: companyName(i.company_id), Dormitory: dormName(i.dormitory_id), Month: i.month, Issued: i.invoice_date, Due: i.due_date, Total: Number(i.total_amount), Paid: b.paid, Outstanding: b.outstanding, Status: b.status }; }), "dormitory-rent", "Invoices")}><Download className="mr-2 size-4" />Excel</Button><Button size="sm" onClick={() => openInvoice()}><Plus className="mr-2 size-4" />Create invoice</Button></div>
    </div>
    <Table className="min-w-[1050px] whitespace-nowrap"><TableHeader><TableRow>{["Invoice / Company", "Dormitory", "Rent month", "Due date", "Total", "Paid", "Outstanding", "Status", "Actions"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{!filtered.length ? <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">No rent invoices found</TableCell></TableRow> : filtered.map((i) => { const b = rentBalance(i, payments, today); return <TableRow key={i.id}><TableCell><span className="font-medium">{i.invoice_no}</span><p className="max-w-48 truncate text-xs text-muted-foreground">{companyName(i.company_id)}</p></TableCell><TableCell>{dormName(i.dormitory_id)}</TableCell><TableCell>{i.month}</TableCell><TableCell>{i.due_date}</TableCell><TableCell>{currency(Number(i.total_amount))}</TableCell><TableCell className="text-success">{currency(b.paid)}</TableCell><TableCell className="font-medium">{currency(b.outstanding)}</TableCell><TableCell><StatusBadge label={b.status} variant={b.status === "Paid" ? "success" : b.status === "Overdue" ? "destructive" : b.status === "Void" ? "ghost" : "warning"} /></TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" title="Invoice details" aria-label={`View ${i.invoice_no}`} onClick={() => setSelected(i)}><Eye className="size-4" /></Button><Button variant="ghost" size="icon" title="Record payment" aria-label={`Pay ${i.invoice_no}`} disabled={i.voided || b.outstanding === 0 || busy} onClick={() => openPayment(i)}><CreditCard className="size-4" /></Button><Button variant="ghost" size="icon" title="Edit invoice" aria-label={`Edit ${i.invoice_no}`} disabled={i.voided || b.paid > 0 || busy} onClick={() => openInvoice(i)}><Pencil className="size-4" /></Button></div></TableCell></TableRow>; })}</TableBody></Table>
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editId ? "Edit rent invoice" : "Create rent invoice"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="rent-company">Company</Label><Select value={form.companyId} disabled={!!editId} onValueChange={(v) => setForm({ ...form, companyId: v, dormitoryId: "" })}><SelectTrigger id="rent-company"><SelectValue placeholder="Select company" /></SelectTrigger><SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="rent-dorm">Dormitory</Label><Select value={form.dormitoryId} disabled={!!editId} onValueChange={(v) => setForm({ ...form, dormitoryId: v })}><SelectTrigger id="rent-dorm"><SelectValue placeholder="Select dormitory" /></SelectTrigger><SelectContent>{dormitories.filter((d) => !d.companyId || d.companyId === form.companyId).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="rent-number">Invoice number</Label><Input id="rent-number" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></div>
      <div><Label htmlFor="rent-month">Rent month</Label><Input id="rent-month" type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} /></div>
      <div><Label htmlFor="rent-issued">Invoice date</Label><Input id="rent-issued" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></div>
      <div><Label htmlFor="rent-due">Due date</Label><Input id="rent-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
      <div className="sm:col-span-2"><Label htmlFor="rent-total">Total rent (SGD)</Label><div className="flex flex-wrap gap-2"><Input id="rent-total" className="min-w-32 flex-1" type="number" min="0.01" step="0.01" value={form.totalAmount || ""} onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) })} /><Button variant="outline" disabled={!form.companyId || !form.dormitoryId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.month)} onClick={() => { const est = estimate(); setForm({ ...form, totalAmount: est.total }); toast.info(`${est.beds} allocations · full monthly rent ${currency(est.total)}; review partial-month amounts`); }}>Use allocation rent</Button></div><p className="mt-1 text-xs text-muted-foreground">Full-month rent estimate; no automatic proration or salary deduction.</p></div>
      <div className="sm:col-span-2"><Label htmlFor="rent-remarks">Remarks</Label><Textarea id="rent-remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
    </div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void saveInvoice()}>{busy ? "Saving…" : "Save invoice"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!active && !paymentOpen} onOpenChange={(v) => { if (!v && !busy) setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{active?.invoice_no}</DialogTitle></DialogHeader>{active && activeBalance && <><p>{dormName(active.dormitory_id)} · {active.month}</p><p className="text-sm text-muted-foreground">{companyName(active.company_id)} · Due {active.due_date}</p><div className="grid grid-cols-3 gap-3 border-y py-4">{[["Total", Number(active.total_amount)], ["Paid", activeBalance.paid], ["Outstanding", activeBalance.outstanding]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{currency(Number(value))}</p></div>)}</div>{active.remarks && <p className="whitespace-pre-wrap text-sm">{active.remarks}</p>}<h3 className="font-medium">Payment history</h3><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method / Reference</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{payments.filter((p) => p.invoice_id === active.id).map((p) => <TableRow key={p.id}><TableCell>{p.paid_on}</TableCell><TableCell>{p.method}<p className="text-xs text-muted-foreground">{p.reference || "—"}</p>{p.remarks && <p className="text-xs">{p.remarks}</p>}</TableCell><TableCell>{currency(Number(p.amount))}</TableCell></TableRow>)}{!payments.some((p) => p.invoice_id === active.id) && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No payments recorded</TableCell></TableRow>}</TableBody></Table><DialogFooter className="flex-wrap"><Button variant="outline" onClick={() => void pdf(active)}><Download className="mr-2 size-4" />PDF</Button><Button variant="outline" disabled={busy || active.voided || activeBalance.paid > 0} onClick={() => { if (window.confirm(`Void ${active.invoice_no}? This keeps the invoice history.`)) void operation(() => mutate({ data: { action: "void", payload: { id: active.id } } }), "Invoice voided"); }}><Ban className="mr-2 size-4" />Void</Button><Button disabled={busy || active.voided || activeBalance.outstanding === 0} onClick={() => openPayment(active)}><CreditCard className="mr-2 size-4" />Record payment</Button></DialogFooter></>}</DialogContent></Dialog>
    <Dialog open={paymentOpen} onOpenChange={(v) => { if (!busy) setPaymentOpen(v); }}><DialogContent><DialogHeader><DialogTitle>Record payment — {active?.invoice_no}</DialogTitle></DialogHeader><p className="font-medium">Outstanding: {currency(activeBalance?.outstanding ?? 0)}</p><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="rent-paid-on">Payment date</Label><Input id="rent-paid-on" type="date" max={today} value={payment.paidOn} onChange={(e) => setPayment({ ...payment, paidOn: e.target.value })} /></div><div><Label htmlFor="rent-payment-amount">Amount (SGD)</Label><Input id="rent-payment-amount" type="number" min="0.01" step="0.01" max={activeBalance?.outstanding} value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })} /></div><div><Label htmlFor="rent-method">Payment method</Label><Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v as typeof payment.method })}><SelectTrigger id="rent-method"><SelectValue /></SelectTrigger><SelectContent>{["Bank transfer", "PayNow", "Cash", "Cheque", "Other"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="rent-reference">Payment reference</Label><Input id="rent-reference" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} /></div><div className="sm:col-span-2"><Label htmlFor="rent-payment-notes">Remarks</Label><Textarea id="rent-payment-notes" value={payment.remarks} onChange={(e) => setPayment({ ...payment, remarks: e.target.value })} /></div></div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setPaymentOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void savePayment()}>{busy ? "Saving…" : "Save payment"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
