import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileSignature, Plus, Search, Trash2, Send, CheckCircle2, XCircle,
  Download, ArrowRightLeft, Copy, FileText,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getClients, getProjects, getCurrentCompany, getQuotations, addQuotation,
  updateQuotation, deleteQuotation, convertQuotationToContract,
  computeQuotationTotals, nextQuoteNo, subscribe, getCompany,
} from "@/lib/store";
import { exportRows, timestampedName } from "@/lib/xlsx";
import { downloadQuotationPdf } from "@/lib/pdf";
import type { Quotation, QuotationLine, QuotationStatus, RateUnit } from "@/lib/types";
import { useEffect } from "react";

const units: RateUnit[] = ["Hourly", "Daily", "Monthly"];
const statuses: QuotationStatus[] = ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Converted"];

const statusTone: Record<QuotationStatus, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-primary/15 text-primary",
  Accepted: "bg-emerald-500/15 text-emerald-500",
  Rejected: "bg-destructive/15 text-destructive",
  Expired: "bg-amber-500/15 text-amber-500",
  Converted: "bg-sky-500/15 text-sky-500",
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2 })}`;
const lineId = () => Math.random().toString(36).slice(2, 10);

type DraftLine = Omit<QuotationLine, "amount">;

const emptyLine = (): DraftLine => ({
  id: lineId(),
  designation: "",
  description: "",
  headcount: 1,
  unit: "Hourly",
  normalRate: 0,
  otRate: 0,
  unitsPerPeriod: 208,
});

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({
    meta: [
      { title: "Quotation Management | BSM Engineering" },
      {
        name: "description",
        content:
          "Prepare, send and track manpower supply quotations, then convert accepted quotes into rate agreements and service contracts.",
      },
      { property: "og:title", content: "Quotation Management | BSM Engineering" },
      {
        property: "og:description",
        content: "Client quotations with GST, validity tracking and one-click conversion to contracts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuotationsPage,
});

function QuotationsPage() {
  const [, force] = useState(0);
  useEffect(() => {
    const unsub = subscribe(() => force((v) => v + 1));
    return () => {
      unsub();
    };
  }, []);

  const clients = getClients();
  const projects = getProjects();
  const companyId = getCurrentCompany();
  const quotations = getQuotations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuotationStatus>("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Quotation | null>(null);

  // form state
  const [quoteNo, setQuoteNo] = useState("");
  const [clientMode, setClientMode] = useState<"new" | "existing">("new");
  const [clientId, setClientId] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");
  const [prospectContact, setProspectContact] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [prospectAddress, setProspectAddress] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [title, setTitle] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [quoteDate, setQuoteDate] = useState(today());
  const [validUntil, setValidUntil] = useState("");
  const [gstRate, setGstRate] = useState(9);
  const [discount, setDiscount] = useState(0);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [terms, setTerms] = useState(
    "Rates exclude accommodation and transport unless stated. Overtime billed at 1.5x normal rate. Quotation valid for 30 days.",
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  function resetForm() {
    setQuoteNo(nextQuoteNo());
    setClientMode("new");
    setClientId("");
    setProspectCompany("");
    setProspectContact("");
    setProspectEmail("");
    setProspectPhone("");
    setProspectAddress("");
    setProjectId("all");
    setTitle("");
    setContactPerson("");
    setQuoteDate(today());
    const v = new Date();
    v.setDate(v.getDate() + 30);
    setValidUntil(v.toISOString().slice(0, 10));
    setGstRate(9);
    setDiscount(0);
    setPaymentTermsDays(30);
    setNotes("");
    setLines([emptyLine()]);
  }

  const priced: QuotationLine[] = lines.map((l) => ({
    ...l,
    amount: Math.round(l.headcount * l.unitsPerPeriod * l.normalRate * 100) / 100,
  }));
  const totals = computeQuotationTotals(priced, gstRate, discount);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotations.filter((quote) => {
      const clientName = quote.clientId
        ? clients.find((c) => c.id === quote.clientId)?.name ?? ""
        : quote.prospectCompany ?? quote.prospectContact ?? "";
      const matchesCompany = !companyId || !quote.companyId || quote.companyId === companyId;
      const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
      const matchesSearch =
        !q ||
        quote.quoteNo.toLowerCase().includes(q) ||
        quote.title.toLowerCase().includes(q) ||
        clientName.toLowerCase().includes(q) ||
        (quote.prospectEmail ?? "").toLowerCase().includes(q) ||
        (quote.prospectPhone ?? "").toLowerCase().includes(q);
      return matchesCompany && matchesStatus && matchesSearch;
    });
  }, [quotations, clients, companyId, statusFilter, search]);

  const kpi = useMemo(() => {
    const open = filtered.filter((q) => q.status === "Sent");
    const won = filtered.filter((q) => q.status === "Accepted" || q.status === "Converted");
    const decided = won.length + filtered.filter((q) => q.status === "Rejected").length;
    return {
      total: filtered.length,
      pipeline: open.reduce((s, q) => s + q.total, 0),
      won: won.reduce((s, q) => s + q.total, 0),
      winRate: decided ? Math.round((won.length / decided) * 100) : 0,
      expiringSoon: filtered.filter(
        (q) => q.status === "Sent" && q.validUntil && q.validUntil >= today() &&
          q.validUntil <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      ).length,
    };
  }, [filtered]);

  /** Existing client name, or the prospect details captured on the quote. */
  function clientLabel(q: Quotation) {
    if (q.clientId) return clients.find((c) => c.id === q.clientId)?.name ?? "-";
    return q.prospectCompany || q.prospectContact || "New prospect";
  }

  function save() {
    if (clientMode === "existing" && !clientId) return toast.error("Select a client");
    if (clientMode === "new" && !prospectCompany.trim() && !prospectContact.trim()) {
      return toast.error("Enter the company or contact name of the prospect");
    }
    if (!priced.some((l) => l.designation && l.normalRate > 0)) {
      return toast.error("Add at least one designation with a rate");
    }
    addQuotation({
      quoteNo: quoteNo.trim() || undefined,
      companyId: companyId || undefined,
      clientId: clientMode === "existing" ? clientId : undefined,
      prospectCompany: clientMode === "new" ? prospectCompany.trim() || undefined : undefined,
      prospectContact: clientMode === "new" ? prospectContact.trim() || undefined : undefined,
      prospectEmail: clientMode === "new" ? prospectEmail.trim() || undefined : undefined,
      prospectPhone: clientMode === "new" ? prospectPhone.trim() || undefined : undefined,
      prospectAddress: clientMode === "new" ? prospectAddress.trim() || undefined : undefined,
      projectId: projectId === "all" ? undefined : projectId,
      title: title.trim() || "Manpower supply quotation",
      contactPerson: contactPerson.trim() || undefined,
      quoteDate,
      validUntil: validUntil || undefined,
      lines: priced.filter((l) => l.designation),
      discount,
      gstRate,
      status: "Draft",
      paymentTermsDays,
      terms,
      notes: notes.trim() || undefined,
    });
    setOpen(false);
    toast.success("Quotation created");
  }

  function setStatus(quote: Quotation, status: QuotationStatus) {
    updateQuotation(quote.id, {
      status,
      sentOn: status === "Sent" ? today() : quote.sentOn,
      decidedOn: status === "Accepted" || status === "Rejected" ? today() : quote.decidedOn,
    });
    toast.success(`${quote.quoteNo} marked ${status}`);
  }

  function convert(quote: Quotation) {
    const res = convertQuotationToContract(quote.id);
    toast.success(`Converted — ${res.rates} rate agreement(s) and 1 service contract created`);
  }

  function duplicate(quote: Quotation) {
    addQuotation({
      ...quote,
      quoteNo: undefined,
      status: "Draft",
      sentOn: undefined,
      decidedOn: undefined,
      convertedContractId: undefined,
      quoteDate: today(),
    });
    toast.success("Quotation duplicated as a new draft");
  }

  async function exportExcel() {
    return exportExcelRows();
  }

  async function downloadPdf(quote: Quotation) {
    const company = companyId ? getCompany(companyId) : undefined;
    await downloadQuotationPdf(quote, {
      company: company
        ? {
            name: company.legalName || company.name,
            uen: company.uen,
            address: [company.address, company.phone, company.email].filter(Boolean).join(" · "),
          }
        : undefined,
      clientName: quote.clientId ? clients.find((c) => c.id === quote.clientId)?.name : undefined,
      projectName: quote.projectId ? projects.find((p) => p.id === quote.projectId)?.name : undefined,
    });
    toast.success(`${quote.quoteNo} PDF downloaded`);
  }

  async function exportExcelRows() {
    await exportRows(
      filtered.map((q) => ({
        "Quote No": q.quoteNo,
        Client: clientLabel(q),
        "Contact": q.prospectContact ?? q.contactPerson ?? "",
        "Email": q.prospectEmail ?? "",
        "Phone": q.prospectPhone ?? "",
        Title: q.title,
        "Quote Date": q.quoteDate,
        "Valid Until": q.validUntil ?? "-",
        Headcount: q.lines.reduce((s, l) => s + l.headcount, 0),
        Subtotal: q.subtotal,
        GST: q.gstAmount,
        Total: q.total,
        Status: q.status,
      })),
      timestampedName("quotations", "xlsx"),
      "Quotations",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Quotation Management</h1>
            <p className="text-sm text-muted-foreground">
              Prepare client quotations, track validity and convert accepted quotes into rates and contracts.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New Quotation
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total quotations" value={String(kpi.total)} hint={`${kpi.expiringSoon} expiring in 7 days`} />
          <KpiCard label="Open pipeline" value={money(kpi.pipeline)} hint="Sent, awaiting decision" />
          <KpiCard label="Won value" value={money(kpi.won)} hint="Accepted & converted" />
          <KpiCard label="Win rate" value={`${kpi.winRate}%`} hint="Accepted vs decided" />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSignature className="h-4 w-4" /> Quotations
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 sm:w-64"
                  placeholder="Search quote no, client, title"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote No</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Headcount</TableHead>
                  <TableHead className="text-right">Total (incl. GST)</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No quotations yet. Create your first client quotation.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer" onClick={() => setDetail(q)}>
                    <TableCell className="font-medium">{q.quoteNo}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{clientLabel(q)}</span>
                        {!q.clientId && (
                          <span className="text-xs text-muted-foreground">
                            Prospect{q.prospectEmail ? ` · ${q.prospectEmail}` : ""}
                            {q.prospectPhone ? ` · ${q.prospectPhone}` : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{q.title}</TableCell>
                    <TableCell className="text-right">{q.lines.reduce((s, l) => s + l.headcount, 0)}</TableCell>
                    <TableCell className="text-right font-medium">{money(q.total)}</TableCell>
                    <TableCell>{q.validUntil ?? "-"}</TableCell>
                    <TableCell>
                      <Badge className={statusTone[q.status]} variant="secondary">{q.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {q.status === "Draft" && (
                          <Button size="icon" variant="ghost" title="Mark as sent" onClick={() => setStatus(q, "Sent")}>
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {q.status === "Sent" && (
                          <>
                            <Button size="icon" variant="ghost" title="Accept" onClick={() => setStatus(q, "Accepted")}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Reject" onClick={() => setStatus(q, "Rejected")}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {q.status === "Accepted" && (
                          <Button size="icon" variant="ghost" title="Convert to contract & rates" onClick={() => convert(q)}>
                            <ArrowRightLeft className="h-4 w-4 text-sky-500" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Duplicate" onClick={() => duplicate(q)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete"
                          onClick={() => {
                            deleteQuotation(q.id);
                            toast.success("Quotation deleted");
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New quotation</DialogTitle>
            <DialogDescription>Quote manpower per designation with hourly, daily or monthly rates.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quote number</Label>
              <Input value={quoteNo} onChange={(e) => setQuoteNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Quote for</Label>
              <Select value={clientMode} onValueChange={(v) => setClientMode(v as "new" | "existing")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New prospect (not a client yet)</SelectItem>
                  <SelectItem value="existing">Existing client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {clientMode === "existing" ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Company name</Label>
                  <Input
                    value={prospectCompany}
                    onChange={(e) => setProspectCompany(e.target.value)}
                    placeholder="e.g. Sembawang Marine Pte Ltd"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact person</Label>
                  <Input
                    value={prospectContact}
                    onChange={(e) => setProspectContact(e.target.value)}
                    placeholder="Mr. Tan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    placeholder="name@company.com.sg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone / WhatsApp</Label>
                  <Input
                    value={prospectPhone}
                    onChange={(e) => setProspectPhone(e.target.value)}
                    placeholder="+65 9xxx xxxx"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address (optional)</Label>
                  <Input
                    value={prospectAddress}
                    onChange={(e) => setProspectAddress(e.target.value)}
                    placeholder="Billing / site address"
                  />
                </div>
                <p className="sm:col-span-2 -mt-2 text-xs text-muted-foreground">
                  No client record is created now. When the quotation is accepted and converted,
                  this prospect is automatically added to the Client Directory with rates and a contract.
                </p>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Project / site (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects
                    .filter((p) => !clientId || p.clientId === clientId)
                    .map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Attention to</Label>
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact person" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject / scope</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Supply of general workers & scaffolders" />
            </div>
            <div className="space-y-1.5">
              <Label>Quote date</Label>
              <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valid until</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Quoted manpower</Label>
              <Button size="sm" variant="outline" onClick={() => setLines((l) => [...l, emptyLine()])}>
                <Plus className="mr-2 h-4 w-4" /> Add line
              </Button>
            </div>

            {lines.map((line, idx) => (
              <div key={line.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-xs">Designation</Label>
                  <Input
                    value={line.designation}
                    placeholder="General Worker"
                    onChange={(e) =>
                      setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, designation: e.target.value } : l)))
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Rate type</Label>
                  <Select
                    value={line.unit}
                    onValueChange={(v) =>
                      setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unit: v as RateUnit } : l)))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs">Pax</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.headcount}
                    onChange={(e) =>
                      setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, headcount: Number(e.target.value) } : l)))
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Normal rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.normalRate}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((l, i) =>
                          i === idx
                            ? { ...l, normalRate: Number(e.target.value), otRate: Number(e.target.value) * 1.5 }
                            : l,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">OT rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.otRate}
                    onChange={(e) =>
                      setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, otRate: Number(e.target.value) } : l)))
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs">Units</Label>
                  <Input
                    type="number"
                    value={line.unitsPerPeriod}
                    onChange={(e) =>
                      setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, unitsPerPeriod: Number(e.target.value) } : l)))
                    }
                  />
                </div>
                <div className="flex items-end justify-between gap-2 sm:col-span-12">
                  <p className="text-xs text-muted-foreground">
                    Line amount: <span className="font-medium text-foreground">{money(priced[idx]?.amount ?? 0)}</span>
                    {" · "}units = billable {line.unit.toLowerCase()} periods per person
                  </p>
                  {lines.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Discount ($)</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>GST (%)</Label>
              <Input type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment terms (days)</Label>
              <Input
                type="number"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Terms & conditions</Label>
            <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Internal notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST {gstRate}%</span><span>{money(totals.gstAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>Total</span><span>{money(totals.total)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save quotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.quoteNo}
                  <Badge className={statusTone[detail.status]} variant="secondary">{detail.status}</Badge>
                </DialogTitle>
                <DialogDescription>
                  {clientLabel(detail)} · {detail.title}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Attention to" value={detail.contactPerson ?? "-"} />
                <Info label="Quote date" value={detail.quoteDate || "-"} />
                <Info label="Valid until" value={detail.validUntil ?? "-"} />
                <Info label="Payment terms" value={`${detail.paymentTermsDays} days`} />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-right">Pax</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.designation}</TableCell>
                      <TableCell className="text-right">{l.headcount}</TableCell>
                      <TableCell className="text-right">{money(l.normalRate)}/{l.unit === "Hourly" ? "hr" : l.unit === "Daily" ? "day" : "mth"}</TableCell>
                      <TableCell className="text-right">{money(l.otRate)}</TableCell>
                      <TableCell className="text-right font-medium">{money(l.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(detail.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST {detail.gstRate}%</span><span>{money(detail.gstAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span><span>{money(detail.total)}</span>
                </div>
              </div>

              {detail.terms && (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{detail.terms}</p>
              )}

              <DialogFooter>
                {detail.status === "Draft" && (
                  <Button onClick={() => { setStatus(detail, "Sent"); setDetail(null); }}>Mark as sent</Button>
                )}
                {detail.status === "Sent" && (
                  <>
                    <Button variant="outline" onClick={() => { setStatus(detail, "Rejected"); setDetail(null); }}>
                      Rejected
                    </Button>
                    <Button onClick={() => { setStatus(detail, "Accepted"); setDetail(null); }}>Accepted</Button>
                  </>
                )}
                {detail.status === "Accepted" && (
                  <Button onClick={() => { convert(detail); setDetail(null); }}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" /> Convert to contract & rates
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
