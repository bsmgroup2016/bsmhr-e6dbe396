import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes, HardHat, PackageCheck, AlertTriangle, Plus, Search, Trash2, Undo2, Download,
  CheckCircle2, Clock, Eye, RefreshCw,
} from "lucide-react";
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
  getAssets, getIssuances, getEmployees, getSites, getCurrentCompany,
  addAsset, deleteAsset, issueAsset, returnIssuance, deleteIssuance,
  assetAvailableQty, assetIssuedQty, assetAlerts, overdueIssuances, updateIssuance,
} from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { Asset, AssetIssuance } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({
    meta: [
      { title: "Assets & PPE — BSM Workforce & Operations" },
      { name: "description", content: "Asset register, PPE issuance, returns, condition log and calibration schedule." },
      { property: "og:title", content: "Assets & PPE — BSM Workforce & Operations" },
      { property: "og:description", content: "Asset register, PPE issuance, returns, condition log and calibration schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssetsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const categories: Asset["category"][] = ["PPE", "Tool", "Equipment", "Machinery", "IT", "Vehicle Part", "Other"];
const conditions: NonNullable<AssetIssuance["conditionIn"]>[] = ["New", "Good", "Fair", "Poor", "Unusable"];

const emptyAsset = {
  assetCode: "", name: "", category: "PPE" as Asset["category"], serialNo: "", brand: "",
  quantity: 1, unitCost: 0, purchaseDate: "", warrantyExpiry: "", calibrationDue: "",
  location: "", status: "Available" as Asset["status"], remarks: "",
  reissueMonths: 0, minStock: 0,
};

const emptyIssue = {
  assetId: "", employeeId: "", siteId: "", quantity: 1, issueDate: today(), dueDate: "",
  conditionOut: "Good" as AssetIssuance["conditionOut"], status: "Issued" as AssetIssuance["status"], remarks: "",
  size: "", issuedBy: "", receiptNo: "", acknowledged: false, ackDate: "",
  replacementDue: "", costRecovery: 0, deductFromSalary: false,
};

const addMonths = (dateStr: string, months: number) => {
  if (!dateStr || !months) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

export default function AssetsPage() {
  const companyId = getCurrentCompany();
  const [assets, setAssets] = useState(getAssets());
  const [issuances, setIssuances] = useState(getIssuances());
  const [employees] = useState(getEmployees());
  const [sites] = useState(getSites());
  const [search, setSearch] = useState("");
  const [assetOpen, setAssetOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [issueForm, setIssueForm] = useState(emptyIssue);
  const [statusFilter, setStatusFilter] = useState<"all" | AssetIssuance["status"] | "Overdue" | "Unacknowledged">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Asset["category"]>("all");
  const [ledgerWorker, setLedgerWorker] = useState<string | null>(null);

  function refresh() {
    setAssets(getAssets());
    setIssuances(getIssuances());
  }

  const scopedAssets = useMemo(
    () => assets.filter((a) => !companyId || !a.companyId || a.companyId === companyId),
    [assets, companyId],
  );
  const assetIds = new Set(scopedAssets.map((a) => a.id));
  const scopedIssues = issuances.filter((i) => assetIds.has(i.assetId));
  const companyEmployees = employees.filter((e) => !companyId || e.companyId === companyId);

  const assetName = (id: string) => assets.find((a) => a.id === id)?.name ?? "—";
  const assetCode = (id: string) => assets.find((a) => a.id === id)?.assetCode ?? "";
  const assetCategory = (id: string) => assets.find((a) => a.id === id)?.category;
  const assetCost = (id: string) => assets.find((a) => a.id === id)?.unitCost ?? 0;
  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? "—";
  const empCode = (id: string) => employees.find((e) => e.id === id)?.employeeCode ?? "";
  const siteName = (id?: string) => sites.find((s) => s.id === id)?.name ?? "—";

  const totalValue = scopedAssets.reduce((s, a) => s + a.quantity * a.unitCost, 0);
  const outNow = scopedIssues.filter((i) => i.status === "Issued").length;
  const alerts = assetAlerts().filter((x) => assetIds.has(x.asset.id));
  const overdue = overdueIssuances().filter((i) => assetIds.has(i.assetId));
  const dueReplacement = scopedIssues.filter(
    (i) => i.status === "Issued" && !!i.replacementDue && i.replacementDue <= today(),
  );
  const unacknowledged = scopedIssues.filter((i) => i.status === "Issued" && !i.acknowledged);
  const recovery = scopedIssues.reduce((s, i) => s + (i.costRecovery ?? 0), 0);

  const q = search.trim().toLowerCase();
  const filteredIssues = scopedIssues
    .filter(
      (i) =>
        !q ||
        assetName(i.assetId).toLowerCase().includes(q) ||
        empName(i.employeeId).toLowerCase().includes(q) ||
        empCode(i.employeeId).toLowerCase().includes(q) ||
        (i.receiptNo ?? "").toLowerCase().includes(q),
    )
    .filter((i) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "Overdue") return i.status === "Issued" && !!i.dueDate && i.dueDate < today();
      if (statusFilter === "Unacknowledged") return i.status === "Issued" && !i.acknowledged;
      return i.status === statusFilter;
    })
    .filter((i) => categoryFilter === "all" || assetCategory(i.assetId) === categoryFilter)
    .sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? ""));

  /** Per-worker PPE ledger: who has what, since when, and outstanding value. */
  const workerLedger = useMemo(() => {
    const map = new Map<string, AssetIssuance[]>();
    for (const i of scopedIssues) {
      const list = map.get(i.employeeId) ?? [];
      list.push(i);
      map.set(i.employeeId, list);
    }
    const rows = [...map.entries()].map(([employeeId, list]) => {
      const held = list.filter((i) => i.status === "Issued");
      return {
        employeeId,
        name: empName(employeeId),
        code: empCode(employeeId),
        total: list.length,
        holding: held.reduce((s, i) => s + i.quantity, 0),
        lastIssue: list.map((i) => i.issueDate).sort().reverse()[0] ?? "",
        pendingAck: held.filter((i) => !i.acknowledged).length,
        dueReplacement: held.filter((i) => !!i.replacementDue && i.replacementDue <= today()).length,
        lost: list.filter((i) => i.status === "Lost" || i.status === "Damaged").length,
        value: held.reduce((s, i) => s + i.quantity * assetCost(i.assetId), 0),
        recovery: list.reduce((s, i) => s + (i.costRecovery ?? 0), 0),
      };
    });
    const needle = q;
    return rows
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle))
      .sort((a, b) => b.holding - a.holding);
  }, [scopedIssues, q]);

  const ledgerRows = ledgerWorker
    ? scopedIssues
        .filter((i) => i.employeeId === ledgerWorker)
        .sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? ""))
    : [];

  const filteredAssets = scopedAssets.filter(
    (a) =>
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.assetCode.toLowerCase().includes(q) ||
      (a.serialNo ?? "").toLowerCase().includes(q),
  ).filter((a) => categoryFilter === "all" || a.category === categoryFilter);

  function saveAsset() {
    if (!assetForm.name.trim()) return toast.error("Asset name required");
    addAsset({
      ...assetForm,
      assetCode: assetForm.assetCode.trim() || `AST-${String(assets.length + 1).padStart(4, "0")}`,
      companyId: companyId || undefined,
    });
    setAssetForm(emptyAsset);
    setAssetOpen(false);
    refresh();
    toast.success("Asset added");
  }

  function saveIssue() {
    if (!issueForm.assetId || !issueForm.employeeId) return toast.error("Asset and worker required");
    const available = assetAvailableQty(issueForm.assetId);
    if (issueForm.quantity > available) return toast.error(`Only ${available} available in stock`);
    const asset = assets.find((a) => a.id === issueForm.assetId);
    issueAsset({
      ...issueForm,
      siteId: issueForm.siteId || undefined,
      dueDate: issueForm.dueDate || undefined,
      replacementDue:
        issueForm.replacementDue ||
        addMonths(issueForm.issueDate, asset?.reissueMonths ?? 0) ||
        undefined,
      ackDate: issueForm.acknowledged ? issueForm.ackDate || issueForm.issueDate : undefined,
      issuedBy: issueForm.issuedBy || undefined,
      receiptNo: issueForm.receiptNo || `PPE-${String(issuances.length + 1).padStart(4, "0")}`,
      size: issueForm.size || undefined,
    });
    setIssueForm(emptyIssue);
    setIssueOpen(false);
    refresh();
    toast.success("Asset issued");
  }

  function acknowledge(id: string) {
    updateIssuance(id, { acknowledged: true, ackDate: today() });
    refresh();
    toast.success("Receipt acknowledged");
  }

  function handleReturn(id: string, status: AssetIssuance["status"]) {
    returnIssuance(id, status === "Returned" ? "Good" : "Unusable", status);
    if (status !== "Returned") {
      const i = getIssuances().find((x) => x.id === id);
      if (i) updateIssuance(id, { costRecovery: i.quantity * assetCost(i.assetId), deductFromSalary: true });
    }
    refresh();
    toast.success(status === "Returned" ? "Item returned" : `Marked as ${status.toLowerCase()}`);
  }

  function handleExport() {
    void exportRows(
      filteredIssues.map((i) => ({
        Asset: assetName(i.assetId),
        "Asset code": assetCode(i.assetId),
        Category: assetCategory(i.assetId) ?? "",
        Worker: empName(i.employeeId),
        "P-File No": empCode(i.employeeId),
        Site: siteName(i.siteId),
        Qty: i.quantity,
        Size: i.size ?? "",
        "Issue date": i.issueDate,
        "Due date": i.dueDate ?? "",
        "Replacement due": i.replacementDue ?? "",
        "Return date": i.returnDate ?? "",
        "Condition out": i.conditionOut,
        "Condition in": i.conditionIn ?? "",
        "Issued by": i.issuedBy ?? "",
        "Receipt no": i.receiptNo ?? "",
        Acknowledged: i.acknowledged ? `Yes (${i.ackDate ?? ""})` : "No",
        "Cost recovery": i.costRecovery ?? 0,
        "Salary deduction": i.deductFromSalary ? "Yes" : "No",
        Status: i.status,
        Remarks: i.remarks ?? "",
      })),
      "assets-issuance", "Issuance",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Assets &amp; PPE</h1>
            <p className="text-sm text-muted-foreground">Asset register, PPE issuance, returns and calibration tracking.</p>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={handleExport} disabled={filteredIssues.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Assets" value={scopedAssets.length.toString()} icon={<Boxes className="h-5 w-5" />} variant="primary" caption={`$${totalValue.toLocaleString()} book value`} />
          <SummaryCard title="Issued out" value={outNow.toString()} icon={<HardHat className="h-5 w-5" />} variant="success" caption="Currently with workers" />
          <SummaryCard title="Overdue returns" value={overdue.length.toString()} icon={<PackageCheck className="h-5 w-5" />} variant={overdue.length ? "warning" : "default"} caption="Past due date" />
          <SummaryCard title="Service alerts" value={alerts.length.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant={alerts.length ? "warning" : "default"} caption="Warranty / calibration" />
          <SummaryCard title="Due for replacement" value={dueReplacement.length.toString()} icon={<RefreshCw className="h-5 w-5" />} variant={dueReplacement.length ? "warning" : "default"} caption="PPE past its wear cycle" />
          <SummaryCard title="Pending acknowledgement" value={unacknowledged.length.toString()} icon={<Clock className="h-5 w-5" />} variant={unacknowledged.length ? "warning" : "default"} caption="Worker sign-off missing" />
          <SummaryCard title="Cost recovery" value={`$${recovery.toLocaleString()}`} icon={<AlertTriangle className="h-5 w-5" />} variant="default" caption="Lost / damaged charged" />
        </div>

        {alerts.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-medium text-muted-foreground">Warranty &amp; calibration due</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {alerts.slice(0, 12).map((a, idx) => (
                <div key={`${a.asset.id}-${idx}`} className="rounded-lg border px-3 py-2 text-xs">
                  <span className="font-medium">{a.asset.name}</span>{" "}
                  <span className="text-muted-foreground">{a.label} · {a.date}</span>{" "}
                  <StatusBadge variant={a.expired ? "destructive" : "warning"} label={a.expired ? "Overdue" : "Due soon"} dot />
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="issuance">
          <TabsList>
            <TabsTrigger value="issuance">Issuance</TabsTrigger>
            <TabsTrigger value="workers">By worker</TabsTrigger>
            <TabsTrigger value="register">Asset register</TabsTrigger>
          </TabsList>

          <TabsContent value="issuance" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search asset, worker or receipt no..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Issued">Issued (with worker)</SelectItem>
                      <SelectItem value="Overdue">Overdue return</SelectItem>
                      <SelectItem value="Unacknowledged">Pending sign-off</SelectItem>
                      <SelectItem value="Returned">Returned</SelectItem>
                      <SelectItem value="Lost">Lost</SelectItem>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={scopedAssets.length === 0}>
                      <Plus className="mr-1 h-4 w-4" /> Issue asset
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Issue asset</DialogTitle>
                      <DialogDescription>Hand out a tool or PPE item to a worker.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label>Asset</Label>
                        <Select value={issueForm.assetId} onValueChange={(v) => setIssueForm({ ...issueForm, assetId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                          <SelectContent>
                            {scopedAssets.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name} ({assetAvailableQty(a.id)} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Worker</Label>
                        <Select value={issueForm.employeeId} onValueChange={(v) => setIssueForm({ ...issueForm, employeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                          <SelectContent>
                            {companyEmployees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.name} — {e.employeeCode}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Site</Label>
                        <Select value={issueForm.siteId} onValueChange={(v) => setIssueForm({ ...issueForm, siteId: v })}>
                          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>
                            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Quantity</Label><Input type="number" min={1} value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: Number(e.target.value) })} /></div>
                      <div><Label>Issue date</Label><Input type="date" value={issueForm.issueDate} onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })} /></div>
                      <div><Label>Return due</Label><Input type="date" value={issueForm.dueDate} onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })} /></div>
                      <div><Label>Size</Label><Input placeholder="e.g. 42 / L" value={issueForm.size} onChange={(e) => setIssueForm({ ...issueForm, size: e.target.value })} /></div>
                      <div><Label>Replacement due</Label><Input type="date" value={issueForm.replacementDue} onChange={(e) => setIssueForm({ ...issueForm, replacementDue: e.target.value })} /></div>
                      <div><Label>Issued by</Label><Input placeholder="Store keeper name" value={issueForm.issuedBy} onChange={(e) => setIssueForm({ ...issueForm, issuedBy: e.target.value })} /></div>
                      <div><Label>Receipt no</Label><Input placeholder="Auto" value={issueForm.receiptNo} onChange={(e) => setIssueForm({ ...issueForm, receiptNo: e.target.value })} /></div>
                      <div><Label>Cost recovery ($)</Label><Input type="number" value={issueForm.costRecovery} onChange={(e) => setIssueForm({ ...issueForm, costRecovery: Number(e.target.value) })} /></div>
                      <div className="flex flex-col justify-end gap-2 pb-1">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={issueForm.acknowledged} onChange={(e) => setIssueForm({ ...issueForm, acknowledged: e.target.checked })} />
                          Worker acknowledged receipt
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={issueForm.deductFromSalary} onChange={(e) => setIssueForm({ ...issueForm, deductFromSalary: e.target.checked })} />
                          Deduct cost from salary
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Condition on issue</Label>
                        <Select value={issueForm.conditionOut} onValueChange={(v) => setIssueForm({ ...issueForm, conditionOut: v as AssetIssuance["conditionOut"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {conditions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={issueForm.remarks} onChange={(e) => setIssueForm({ ...issueForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
                      <Button onClick={saveIssue}>Issue</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Replace by</TableHead>
                      <TableHead>Sign-off</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIssues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<HardHat className="h-5 w-5" />} title="No issuance records" description="Issue an asset to get started." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredIssues.map((i) => {
                        const isOverdue = i.status === "Issued" && !!i.dueDate && i.dueDate < today();
                        return (
                          <TableRow key={i.id}>
                            <TableCell>
                              <div className="font-medium">{assetName(i.assetId)}</div>
                              <div className="text-xs text-muted-foreground">{assetCode(i.assetId)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{empName(i.employeeId)}</div>
                              <div className="text-xs text-muted-foreground">{empCode(i.employeeId)}</div>
                            </TableCell>
                            <TableCell>{siteName(i.siteId)}</TableCell>
                            <TableCell>{i.quantity}</TableCell>
                            <TableCell>{i.size ?? "—"}</TableCell>
                            <TableCell>
                              <div>{i.issueDate}</div>
                              <div className="text-xs text-muted-foreground">{i.issuedBy ? `by ${i.issuedBy}` : ""}{i.receiptNo ? ` · ${i.receiptNo}` : ""}</div>
                            </TableCell>
                            <TableCell className={i.replacementDue && i.replacementDue <= today() && i.status === "Issued" ? "text-destructive" : undefined}>
                              {i.replacementDue ?? i.dueDate ?? "—"}
                            </TableCell>
                            <TableCell>
                              {i.acknowledged ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                                  <CheckCircle2 className="h-3.5 w-3.5" />{i.ackDate ?? "Signed"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />Pending
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                variant={
                                  i.status === "Returned" ? "success"
                                    : i.status === "Issued" ? (isOverdue ? "destructive" : "warning")
                                      : "destructive"
                                }
                                label={isOverdue && i.status === "Issued" ? "Overdue" : i.status}
                                dot
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                {i.status === "Issued" && !i.acknowledged && (
                                  <Button size="icon" variant="ghost" title="Mark acknowledged" onClick={() => acknowledge(i.id)}>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  </Button>
                                )}
                                {i.status === "Issued" && (
                                  <>
                                    <Button size="icon" variant="ghost" title="Mark returned" onClick={() => handleReturn(i.id, "Returned")}>
                                      <Undo2 className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" title="Mark lost" onClick={() => handleReturn(i.id, "Lost")}>
                                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    </Button>
                                  </>
                                )}
                                <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteIssuance(i.id); refresh(); }}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
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

          <TabsContent value="register" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Asset register</h2>
                <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add asset</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add asset</DialogTitle>
                      <DialogDescription>Register a tool, machine or PPE item into stock.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Asset code</Label><Input placeholder="Auto" value={assetForm.assetCode} onChange={(e) => setAssetForm({ ...assetForm, assetCode: e.target.value })} /></div>
                      <div>
                        <Label>Category</Label>
                        <Select value={assetForm.category} onValueChange={(v) => setAssetForm({ ...assetForm, category: v as Asset["category"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Name</Label><Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} /></div>
                      <div><Label>Brand</Label><Input value={assetForm.brand} onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })} /></div>
                      <div><Label>Serial no</Label><Input value={assetForm.serialNo} onChange={(e) => setAssetForm({ ...assetForm, serialNo: e.target.value })} /></div>
                      <div><Label>Quantity</Label><Input type="number" min={1} value={assetForm.quantity} onChange={(e) => setAssetForm({ ...assetForm, quantity: Number(e.target.value) })} /></div>
                      <div><Label>Unit cost ($)</Label><Input type="number" value={assetForm.unitCost} onChange={(e) => setAssetForm({ ...assetForm, unitCost: Number(e.target.value) })} /></div>
                      <div><Label>Purchase date</Label><Input type="date" value={assetForm.purchaseDate} onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })} /></div>
                      <div><Label>Warranty expiry</Label><Input type="date" value={assetForm.warrantyExpiry} onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })} /></div>
                      <div><Label>Calibration due</Label><Input type="date" value={assetForm.calibrationDue} onChange={(e) => setAssetForm({ ...assetForm, calibrationDue: e.target.value })} /></div>
                      <div><Label>Storage location</Label><Input value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={assetForm.remarks} onChange={(e) => setAssetForm({ ...assetForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAssetOpen(false)}>Cancel</Button>
                      <Button onClick={saveAsset}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Unit cost</TableHead>
                      <TableHead>Calibration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<Boxes className="h-5 w-5" />} title="No assets" description="Add your first asset to the register." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-medium">{a.name}</div>
                            <div className="text-xs text-muted-foreground">{a.assetCode}{a.serialNo ? ` · ${a.serialNo}` : ""}</div>
                          </TableCell>
                          <TableCell>{a.category}</TableCell>
                          <TableCell>
                            <span className="font-medium">{assetAvailableQty(a.id)}</span>
                            <span className="text-xs text-muted-foreground"> / {a.quantity} ({assetIssuedQty(a.id)} out)</span>
                          </TableCell>
                          <TableCell>${a.unitCost.toLocaleString()}</TableCell>
                          <TableCell>{a.calibrationDue ?? "—"}</TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={a.status === "Available" ? "success" : a.status === "Issued" ? "warning" : "destructive"}
                              label={a.status}
                              dot
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteAsset(a.id); refresh(); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
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
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
