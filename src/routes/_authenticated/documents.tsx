import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  FileText,
  Calendar,
  AlertTriangle,
  Download,
  FileUp,
  User,
  RefreshCw,
  BadgeCheck,
  ScanLine,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getDocuments, getEmployees, addDocument, updateDocument, deleteDocument, getCurrentCompany } from "@/lib/store";
import { computeDocumentStatus, daysUntil, DEFAULT_REMINDER_DAYS } from "@/lib/compliance";
import { openR2File, downloadR2FilesAsZip } from "@/lib/r2";
import { extractPassportData } from "@/lib/ocr";
import { FileUpload } from "@/components/file-upload";
import type { EmployeeDocument, DocumentType, DocumentStatus } from "@/lib/types";

function mapComplianceToDocStatus(status: string): DocumentStatus {
  if (status === "critical") return "Expiring Soon";
  if (status === "expired") return "Expired";
  if (status === "warning") return "Expiring Soon";
  if (status === "ok") return "Valid";
  return status as DocumentStatus;
}

const documentTypes: DocumentType[] = [
  "Passport", "Work Permit", "S Pass", "Employment Pass", "IC", "Safety Certificate", "P-File", "Medical Report", "Insurance", "Other",
];
const documentStatuses: DocumentStatus[] = ["Valid", "Expiring Soon", "Expired", "Pending", "Superseded"];

export const Route = createFileRoute("/_authenticated/documents")({
  validateSearch: (search: Record<string, unknown>) => ({ employee: typeof search.employee === "string" ? search.employee : undefined }),
  head: () => ({
    meta: [
      { title: "Documents — BSM Workforce & Operations" },
      { name: "description", content: "Track employee documents, pass expiry, and compliance." },
      { property: "og:title", content: "Documents — BSM Workforce & Operations" },
      { property: "og:description", content: "Track employee documents, pass expiry, and compliance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

function readDocForm(formData: FormData) {
  const expiryDate = (formData.get("expiryDate") as string) || undefined;
  const reminderDays = Number(formData.get("reminderDays") || DEFAULT_REMINDER_DAYS);
  return {
    employeeId: formData.get("employeeId") as string,
    type: formData.get("type") as DocumentType,
    name: formData.get("name") as string,
    fileUrl: (formData.get("fileUrl") as string) || undefined,
    issueDate: (formData.get("issueDate") as string) || undefined,
    expiryDate,
    docNumber: (formData.get("docNumber") as string) || undefined,
    issuingAuthority: (formData.get("issuingAuthority") as string) || undefined,
    remarks: (formData.get("remarks") as string) || undefined,
    reminderDays,
    status: (computeDocumentStatus(expiryDate, reminderDays) as DocumentStatus),
  };
}

export default function DocumentsPage() {
  const companyId = getCurrentCompany();
  const [allDocuments, setDocuments] = useState(getDocuments());
  const [allEmployees] = useState(getEmployees());
  const employees = companyId ? allEmployees.filter((e) => !e.companyId || e.companyId === companyId) : allEmployees;
  const employeeIds = new Set(employees.map((e) => e.id));
  const documents = allDocuments.filter((d) => employeeIds.has(d.employeeId));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const requestedEmployee = Route.useSearch().employee;
  const [employeeFilter, setEmployeeFilter] = useState<string>(requestedEmployee ?? "all");
  useEffect(() => { setEmployeeFilter(requestedEmployee ?? "all"); }, [requestedEmployee]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EmployeeDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<EmployeeDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocument | null>(null);
  const [renewSource, setRenewSource] = useState<EmployeeDocument | null>(null);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zipping, setZipping] = useState(false);

  const filtered = documents.filter((d) => {
    const q = search.toLowerCase();
    const emp = employees.find((e) => e.id === d.employeeId);
    const matchesSearch =
      d.name.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      emp?.name.toLowerCase().includes(q) ||
      emp?.employeeCode.toLowerCase().includes(q);
    if (!showSuperseded && d.status === "Superseded" && statusFilter !== "Superseded") return false;
    return (
      matchesSearch &&
      (typeFilter === "all" || d.type === typeFilter) &&
      (statusFilter === "all" || d.status === statusFilter) &&
      (employeeFilter === "all" || d.employeeId === employeeFilter)
    );
  });

  const validCount = documents.filter((d) => d.status === "Valid").length;
  const expiringCount = documents.filter((d) => d.status === "Expiring Soon").length;
  const expiredCount = documents.filter((d) => d.status === "Expired").length;

  const selectionMode = showSuperseded || statusFilter === "Superseded";
  const supersededRows = filtered.filter((d) => d.status === "Superseded");
  const selectableIds = supersededRows.filter((d) => d.fileUrl).map((d) => d.id);
  const selected = selectedIds.filter((id) => selectableIds.includes(id));
  const allSelected = selectableIds.length > 0 && selected.length === selectableIds.length;

  function toggleRow(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : selectableIds);
  }

  async function handleBulkDownload() {
    const docs = supersededRows.filter((d) => selected.includes(d.id) && d.fileUrl);
    if (docs.length === 0) return;
    setZipping(true);
    const toastId = toast.loading(`Preparing ${docs.length} old versions…`);
    try {
      const { added, failed } = await downloadR2FilesAsZip(
        docs.map((d) => d.fileUrl as string),
        `superseded-documents-${new Date().toISOString().slice(0, 10)}.zip`,
      );
      if (added === 0) toast.error("No files could be downloaded", { id: toastId });
      else if (failed.length > 0) toast.warning(`${added} files zipped, ${failed.length} could not be read`, { id: toastId });
      else toast.success(`${added} old versions downloaded as ZIP`, { id: toastId });
    } catch {
      toast.error("Bulk download failed", { id: toastId });
    } finally {
      setZipping(false);
    }
  }

  function refresh() {
    setDocuments(getDocuments());
  }

  function handleCreate(formData: FormData) {
    const data = readDocForm(formData);
    addDocument({
      ...data,
      status: mapComplianceToDocStatus(data.status),
      version: 1,
      verified: false
    } as any);
    setIsCreateOpen(false);
    refresh();
  }

  function handleEdit(formData: FormData) {
    if (!editingDoc) return;
    const data = readDocForm(formData);
    updateDocument(editingDoc.id, {
      ...data,
      status: mapComplianceToDocStatus(data.status)
    } as any);
    setEditingDoc(null);
    refresh();
  }

  function handleVerify(doc: EmployeeDocument) {
    updateDocument(doc.id, {
      verified: !doc.verified,
      verifiedAt: doc.verified ? undefined : new Date().toISOString(),
    });
    refresh();
  }

  function handleRenew(doc: EmployeeDocument) {
    setRenewSource(doc);
  }

  function handleRenewSubmit(formData: FormData) {
    if (!renewSource) return;
    const data = readDocForm(formData);
    const newDoc = addDocument({
      ...data,
      status: mapComplianceToDocStatus(data.status),
      version: (renewSource.version ?? 1) + 1,
      replacesId: renewSource.id,
      verified: false,
    } as any);
    // Mark previous version superseded only after new renewal record is saved
    if (newDoc) {
      updateDocument(renewSource.id, { status: "Superseded" });
    }
    setRenewSource(null);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteDocument(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
            <p className="text-sm text-muted-foreground">Employee documents, passes, and compliance tracking.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
                <Plus className="mr-1 h-4 w-4" />
                Add document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add document</DialogTitle>
                <DialogDescription>Upload and track a document for an employee.</DialogDescription>
              </DialogHeader>
              <DocumentForm employees={employees} onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total documents" value={documents.length.toString()} icon={<FileText className="h-5 w-5" />} variant="primary" caption="All records" />
          <SummaryCard title="Valid" value={validCount.toString()} icon={<FileText className="h-5 w-5" />} variant="success" caption="Good standing" />
          <SummaryCard title="Expiring soon" value={expiringCount.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" caption="Needs attention" />
          <SummaryCard title="Expired" value={expiredCount.toString()} icon={<FileText className="h-5 w-5" />} variant="destructive" caption="Action required" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,280px)_minmax(155px,1fr)_minmax(125px,140px)_minmax(125px,140px)_auto] lg:items-center">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9" />
            </div>
              <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v)}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocumentType | "all")}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {documentTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocumentStatus | "all")}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {documentStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant={showSuperseded ? "secondary" : "outline"} size="sm" className="h-9 w-full whitespace-nowrap sm:col-span-2 lg:col-span-1 lg:w-auto" onClick={() => { setShowSuperseded((v) => !v); setSelectedIds([]); }}>
                {showSuperseded ? "Hide old versions" : "Show old versions"}
              </Button>
          </div>

          {selectionMode && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {selectableIds.length === 0
                  ? "No superseded files available to download"
                  : `${selected.length} of ${selectableIds.length} old versions selected`}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {selectableIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-8" onClick={toggleAll}>
                    {allSelected ? "Clear selection" : "Select all old versions"}
                  </Button>
                )}
                <Button size="sm" className="h-8" disabled={selected.length === 0 || zipping} onClick={handleBulkDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {zipping ? "Preparing ZIP…" : `Download ZIP (${selected.length})`}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectionMode && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        disabled={selectableIds.length === 0}
                        onCheckedChange={toggleAll}
                        aria-label="Select all old versions"
                      />
                    </TableHead>
                  )}
                  <TableHead>Employee</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectionMode ? 8 : 7} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<FileText className="h-5 w-5" />} title="No documents found" description="Add a document to track expiry." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => {
                    const emp = employees.find((e) => e.id === d.employeeId);
                    return (
                      <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingDoc(d)}>
                        {selectionMode && (
                          <TableCell onClick={(evt) => evt.stopPropagation()}>
                            <Checkbox
                              checked={selected.includes(d.id)}
                              disabled={d.status !== "Superseded" || !d.fileUrl}
                              onCheckedChange={() => toggleRow(d.id)}
                              aria-label={`Select ${d.name}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="font-medium">{emp?.name}</div>
                          <div className="text-xs text-muted-foreground">{emp?.employeeCode}</div>
                        </TableCell>
                        <TableCell>{d.name}</TableCell>
                        <TableCell className="font-mono text-xs">{d.docNumber || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {d.expiryDate || "—"}
                            {(() => {
                              const left = daysUntil(d.expiryDate);
                              if (left === null) return null;
                              return (
                                <span className={left < 0 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                                  ({left < 0 ? `${Math.abs(left)}d ago` : `${left}d`})
                                </span>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={d.status === "Valid" ? "success" : d.status === "Expiring Soon" ? "warning" : d.status === "Expired" ? "destructive" : d.status === "Superseded" ? "outline" : "info"}
                            label={d.status}
                            dot
                          />
                        </TableCell>
                        <TableCell>
                          {d.verified ? (
                            <StatusBadge variant="success" label="Verified" />
                          ) : (
                            <span className="text-xs text-muted-foreground">Unverified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(evt) => evt.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewingDoc(d)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingDoc(d)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {d.fileUrl && (
                                <DropdownMenuItem onClick={() => void openR2File(d.fileUrl!)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Open file
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleVerify(d)}>
                                <BadgeCheck className="mr-2 h-4 w-4" />
                                {d.verified ? "Remove verification" : "Mark as verified"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRenew(d)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Renew / new version
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(d)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit document</DialogTitle>
              <DialogDescription>Update document details.</DialogDescription>
            </DialogHeader>
            {editingDoc && <DocumentForm employees={employees} document={editingDoc} onSubmit={handleEdit} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!renewSource} onOpenChange={(open) => !open && setRenewSource(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Renew document</DialogTitle>
              <DialogDescription>
                The old record is kept as version {renewSource?.version ?? 1} (marked superseded). Upload the renewed copy below.
              </DialogDescription>
            </DialogHeader>
            {renewSource && (
              <DocumentForm
                employees={employees}
                document={{ ...renewSource, fileUrl: undefined, issueDate: undefined, expiryDate: undefined, status: "Valid" }}
                submitLabel="Save renewal"
                onSubmit={handleRenewSubmit}
              />
            )}
          </DialogContent>
        </Dialog>

        <Sheet open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{viewingDoc?.name}</SheetTitle>
              <SheetDescription>{viewingDoc?.type}</SheetDescription>
            </SheetHeader>
            {viewingDoc && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Employee" value={employees.find((e) => e.id === viewingDoc.employeeId)?.name || "—"} />
                  <DetailItem label="P-File No" value={employees.find((e) => e.id === viewingDoc.employeeId)?.employeeCode || "—"} />
                  <DetailItem label="Issue date" value={viewingDoc.issueDate || "—"} />
                  <DetailItem label="Expiry date" value={viewingDoc.expiryDate || "—"} />
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    variant={viewingDoc.status === "Valid" ? "success" : viewingDoc.status === "Expiring Soon" ? "warning" : viewingDoc.status === "Expired" ? "destructive" : "info"}
                    label={viewingDoc.status}
                    dot
                  />
                </div>
                <Button onClick={() => { setViewingDoc(null); setEditingDoc(viewingDoc); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit document
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete document?</DialogTitle>
              <DialogDescription>
                This will permanently remove {deleteTarget?.name}. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function DocumentForm({ employees, document, onSubmit, submitLabel }: { employees: ReturnType<typeof getEmployees>; document?: EmployeeDocument; onSubmit: (data: FormData) => void; submitLabel?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [uploadedUrl, setUploadedUrl] = useState(document?.fileUrl ?? "");
  const [scanning, setScanning] = useState(false);

  const fill = (field: string, value?: string) => {
    if (!value) return;
    const el = formRef.current?.querySelector<HTMLInputElement>(`[name="${field}"]`);
    if (el && !el.value) el.value = value;
  };

  const handleScan = async () => {
    if (!uploadedUrl) {
      toast.error("Upload the document file first");
      return;
    }
    setScanning(true);
    const result = await extractPassportData(uploadedUrl);
    setScanning(false);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    fill("docNumber", result.data.documentNumber || result.data.fin);
    fill("issueDate", result.data.issueDate);
    fill("expiryDate", result.data.expiryDate);
    fill("issuingAuthority", result.data.docKind === "Passport" ? "Immigration" : "MOM");
    fill("name", result.data.docKind && result.data.name ? `${result.data.docKind} — ${result.data.name}` : undefined);
    toast.success("Scanned — check the dates before saving");
  };

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employeeId">Employee</Label>
          <Select name="employeeId" defaultValue={document?.employeeId || employees[0]?.id}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Document type</Label>
          <Select name="type" defaultValue={document?.type || documentTypes[0]}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Document name</Label>
          <Input id="name" name="name" defaultValue={document?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={document?.status || "Valid"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {documentStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="issueDate">Issue date</Label>
          <Input id="issueDate" name="issueDate" type="date" defaultValue={document?.issueDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiryDate">Expiry date</Label>
          <Input id="expiryDate" name="expiryDate" type="date" defaultValue={document?.expiryDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="docNumber">Document / reference number</Label>
          <Input id="docNumber" name="docNumber" defaultValue={document?.docNumber} placeholder="e.g. WP No." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuingAuthority">Issuing authority</Label>
          <Input id="issuingAuthority" name="issuingAuthority" defaultValue={document?.issuingAuthority} placeholder="e.g. MOM" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reminderDays">Reminder before expiry (days)</Label>
          <Input id="reminderDays" name="reminderDays" type="number" min={1} max={365} defaultValue={document?.reminderDays ?? DEFAULT_REMINDER_DAYS} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="remarks">Remarks</Label>
          <Input id="remarks" name="remarks" defaultValue={document?.remarks} />
        </div>
      </div>
      <FileUpload
        name="fileUrl"
        label="Document file"
        folder="documents"
        defaultValue={document?.fileUrl}
        onUploaded={(url) => setUploadedUrl(url)}
      />
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
        <Button type="button" variant="outline" size="sm" onClick={() => void handleScan()} disabled={scanning || !uploadedUrl}>
          <ScanLine className={scanning ? "mr-2 h-4 w-4 animate-pulse" : "mr-2 h-4 w-4"} />
          {scanning ? "Reading…" : "Scan passport / work permit"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Reads the document number and expiry date automatically. Empty fields only — nothing you typed is overwritten.
        </span>
      </div>
      <DialogFooter>
        <Button type="submit">{submitLabel ?? (document ? "Save changes" : "Add document")}</Button>
      </DialogFooter>
    </form>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
