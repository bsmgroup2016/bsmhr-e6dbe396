import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, ShieldAlert, AlertTriangle, Plus, Search, Trash2, Download, CheckCircle2, ShieldCheck } from "lucide-react";
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
  getCourses, getTrainings, getIncidents, getEmployees, getSites, getCurrentCompany,
  addCourse, deleteCourse, addTraining, updateTraining, deleteTraining,
  addIncident, updateIncident, deleteIncident,
  certificationAlerts, mandatoryTrainingGaps,
} from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { TrainingCourse, TrainingRecord, SafetyIncident } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [
      { title: "Training & Safety — BSM Workforce & Operations" },
      { name: "description", content: "Course register, worker certifications with expiry tracking and workplace safety incident log." },
      { property: "og:title", content: "Training & Safety — BSM Workforce & Operations" },
      { property: "og:description", content: "Course register, worker certifications with expiry tracking and workplace safety incident log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrainingPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const categories: TrainingCourse["category"][] = ["Safety", "Statutory", "Skill", "Induction", "Other"];
const trainingStatuses: TrainingRecord["status"][] = ["Scheduled", "Completed", "Failed", "Expired"];
const incidentTypes: SafetyIncident["incidentType"][] = [
  "Near Miss", "First Aid", "Injury", "Property Damage", "Dangerous Occurrence", "Fatality", "Other",
];
const severities: SafetyIncident["severity"][] = ["Low", "Medium", "High", "Critical"];
const incidentStatuses: SafetyIncident["status"][] = ["Open", "Under Investigation", "Closed"];

const emptyCourse = {
  code: "", name: "", category: "Safety" as TrainingCourse["category"], provider: "",
  validityMonths: 24, mandatory: true, cost: 0, remarks: "",
};

const emptyRecord = {
  courseId: "", employeeId: "", completionDate: today(), expiryDate: "", certificateNo: "",
  score: undefined as number | undefined, cost: undefined as number | undefined,
  status: "Completed" as TrainingRecord["status"], remarks: "",
};

const emptyIncident = {
  siteId: "", employeeId: "", incidentDate: today(),
  incidentType: "Near Miss" as SafetyIncident["incidentType"],
  severity: "Low" as SafetyIncident["severity"],
  description: "", actionTaken: "", momReported: false, lostDays: 0,
  status: "Open" as SafetyIncident["status"],
};

/** MOM/WSH standard course catalogue for Singapore construction & marine work. */
const WSH_STANDARD_COURSES: Array<Omit<TrainingCourse, "id" | "createdAt" | "updatedAt" | "companyId">> = [
  { code: "SOC", name: "Construction Safety Orientation Course (CSOC)", category: "Statutory", provider: "MOM ATP", validityMonths: 24, mandatory: true, cost: 0, remarks: "Required for all construction workers" },
  { code: "MSOC", name: "Marine Safety Orientation Course (MSOC)", category: "Statutory", provider: "MOM ATP", validityMonths: 24, mandatory: false, cost: 0, remarks: "Shipyard / marine sector" },
  { code: "SSIC", name: "Shipyard Safety Instruction Course (SSIC)", category: "Statutory", provider: "MOM ATP", validityMonths: 24, mandatory: false, cost: 0, remarks: "Shipyard entry pass" },
  { code: "WAH", name: "Work at Height Course for Workers", category: "Safety", provider: "MOM ATP", validityMonths: 24, mandatory: true, cost: 0, remarks: "WSH (WAH) Regulations" },
  { code: "WAH-S", name: "Work at Height Course for Supervisors", category: "Safety", provider: "MOM ATP", validityMonths: 24, mandatory: false, cost: 0, remarks: "Supervisors only" },
  { code: "CSE", name: "Confined Space Entry / Safety Assessor", category: "Safety", provider: "MOM ATP", validityMonths: 24, mandatory: false, cost: 0, remarks: "Confined space works" },
  { code: "MSE", name: "Metal Scaffold Erector Course", category: "Skill", provider: "MOM ATP", validityMonths: 24, mandatory: false, cost: 0, remarks: "Scaffold erection" },
  { code: "SSLO", name: "Supervise Safe Lifting Operations", category: "Safety", provider: "MOM ATP", validityMonths: 24, mandatory: false, cost: 0, remarks: "Lifting supervisor" },
  { code: "RSS", name: "Rigger & Signalman Course", category: "Skill", provider: "MOM ATP", validityMonths: 24, mandatory: false, cost: 0, remarks: "Lifting crew" },
  { code: "FIRSTAID", name: "Occupational First Aid Course", category: "Safety", provider: "MOM ATP", validityMonths: 36, mandatory: false, cost: 0, remarks: "1 first-aider per 100 workers" },
  { code: "SITE-IND", name: "Site Induction & Toolbox Briefing", category: "Induction", provider: "In-house", validityMonths: 12, mandatory: true, cost: 0, remarks: "Before deployment" },
];

export default function TrainingPage() {
  const companyId = getCurrentCompany();
  const [courses, setCourses] = useState(getCourses());
  const [records, setRecords] = useState(getTrainings());
  const [incidents, setIncidents] = useState(getIncidents());
  const [employees] = useState(getEmployees());
  const [sites] = useState(getSites());
  const [search, setSearch] = useState("");
  const [courseOpen, setCourseOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [incidentForm, setIncidentForm] = useState(emptyIncident);

  function refresh() {
    setCourses(getCourses());
    setRecords(getTrainings());
    setIncidents(getIncidents());
  }

  const scopedCourses = useMemo(
    () => courses.filter((c) => !companyId || !c.companyId || c.companyId === companyId),
    [courses, companyId],
  );
  const companyEmployees = employees.filter((e) => !companyId || e.companyId === companyId);
  const empIds = new Set(companyEmployees.map((e) => e.id));
  const scopedRecords = records.filter((r) => empIds.size === 0 || empIds.has(r.employeeId));
  const scopedIncidents = incidents.filter((i) => !companyId || !i.companyId || i.companyId === companyId);

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";
  const empName = (id?: string) => employees.find((e) => e.id === id)?.name ?? "—";
  const empCode = (id?: string) => employees.find((e) => e.id === id)?.employeeCode ?? "";
  const siteName = (id?: string) => sites.find((s) => s.id === id)?.name ?? "—";

  const alerts = certificationAlerts().filter((a) => empIds.size === 0 || empIds.has(a.training.employeeId));
  const gaps = mandatoryTrainingGaps(companyId || undefined);
  const openIncidents = scopedIncidents.filter((i) => i.status !== "Closed");

  const q = search.trim().toLowerCase();
  const filteredRecords = scopedRecords.filter(
    (r) => !q || courseName(r.courseId).toLowerCase().includes(q) ||
      empName(r.employeeId).toLowerCase().includes(q) || empCode(r.employeeId).toLowerCase().includes(q),
  );

  function saveCourse() {
    if (!courseForm.name.trim()) return toast.error("Course name required");
    addCourse({
      ...courseForm,
      code: courseForm.code.trim() || `CRS-${String(courses.length + 1).padStart(3, "0")}`,
      companyId: companyId || undefined,
    });
    setCourseForm(emptyCourse);
    setCourseOpen(false);
    refresh();
    toast.success("Course added");
  }

  function seedWshCourses() {
    const existing = new Set(courses.map((c) => (c.code ?? "").toUpperCase()));
    const missing = WSH_STANDARD_COURSES.filter((c) => !existing.has((c.code ?? "").toUpperCase()));
    if (!missing.length) return toast.info("All WSH standard courses already exist");
    for (const c of missing) addCourse({ ...c, companyId: companyId || undefined });
    refresh();
    toast.success(`${missing.length} WSH standard courses added`);
  }

  function saveRecord() {
    if (!recordForm.courseId || !recordForm.employeeId) return toast.error("Course and worker required");
    addTraining({
      ...recordForm,
      completionDate: recordForm.completionDate || undefined,
      expiryDate: recordForm.expiryDate || undefined,
      certificateNo: recordForm.certificateNo || undefined,
    });
    setRecordForm(emptyRecord);
    setRecordOpen(false);
    refresh();
    toast.success("Training record saved");
  }

  function saveIncident() {
    if (!incidentForm.description.trim()) return toast.error("Description required");
    addIncident({
      ...incidentForm,
      companyId: companyId || undefined,
      siteId: incidentForm.siteId || undefined,
      employeeId: incidentForm.employeeId || undefined,
      actionTaken: incidentForm.actionTaken || undefined,
    });
    setIncidentForm(emptyIncident);
    setIncidentOpen(false);
    refresh();
    toast.success("Incident reported");
  }

  function handleExport() {
    void exportRows(
      filteredRecords.map((r) => ({
        Worker: empName(r.employeeId),
        "Employee code": empCode(r.employeeId),
        Course: courseName(r.courseId),
        "Certificate no": r.certificateNo ?? "",
        Completed: r.completionDate ?? "",
        Expiry: r.expiryDate ?? "",
        Status: r.status,
      })),
      "training-records", "Training",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Training &amp; Safety</h1>
            <p className="text-sm text-muted-foreground">Course register, certification expiry tracking and workplace incident log.</p>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={handleExport} disabled={filteredRecords.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Courses" value={scopedCourses.length.toString()} icon={<GraduationCap className="h-5 w-5" />} variant="primary" caption={`${scopedCourses.filter((c) => c.mandatory).length} mandatory`} />
          <SummaryCard title="Certifications" value={scopedRecords.filter((r) => r.status === "Completed").length.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="Completed records" />
          <SummaryCard title="Expiring soon" value={alerts.length.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant={alerts.length ? "warning" : "default"} caption="Within 60 days" />
          <SummaryCard title="Open incidents" value={openIncidents.length.toString()} icon={<ShieldAlert className="h-5 w-5" />} variant={openIncidents.length ? "warning" : "default"} caption={`${gaps.length} mandatory gaps`} />
        </div>

        {alerts.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-medium text-muted-foreground">Certification expiry</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {alerts.slice(0, 12).map((a) => (
                <div key={a.training.id} className="rounded-lg border px-3 py-2 text-xs">
                  <span className="font-medium">{empName(a.training.employeeId)}</span>{" "}
                  <span className="text-muted-foreground">{courseName(a.training.courseId)} · {a.date}</span>{" "}
                  <StatusBadge variant={a.expired ? "destructive" : "warning"} label={a.expired ? "Expired" : "Due soon"} dot />
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="records">
          <TabsList>
            <TabsTrigger value="records">Certifications</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="incidents">Safety incidents</TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search worker or course..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={scopedCourses.length === 0}>
                      <Plus className="mr-1 h-4 w-4" /> Add record
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Training record</DialogTitle>
                      <DialogDescription>Expiry is auto-calculated from course validity when left blank.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label>Course</Label>
                        <Select value={recordForm.courseId} onValueChange={(v) => setRecordForm({ ...recordForm, courseId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                          <SelectContent>
                            {scopedCourses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Worker</Label>
                        <Select value={recordForm.employeeId} onValueChange={(v) => setRecordForm({ ...recordForm, employeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                          <SelectContent>
                            {companyEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} — {e.employeeCode}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Completion date</Label><Input type="date" value={recordForm.completionDate} onChange={(e) => setRecordForm({ ...recordForm, completionDate: e.target.value })} /></div>
                      <div><Label>Expiry date</Label><Input type="date" value={recordForm.expiryDate} onChange={(e) => setRecordForm({ ...recordForm, expiryDate: e.target.value })} /></div>
                      <div><Label>Certificate no</Label><Input value={recordForm.certificateNo} onChange={(e) => setRecordForm({ ...recordForm, certificateNo: e.target.value })} /></div>
                      <div>
                        <Label>Status</Label>
                        <Select value={recordForm.status} onValueChange={(v) => setRecordForm({ ...recordForm, status: v as TrainingRecord["status"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {trainingStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={recordForm.remarks} onChange={(e) => setRecordForm({ ...recordForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRecordOpen(false)}>Cancel</Button>
                      <Button onClick={saveRecord}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Certificate</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<GraduationCap className="h-5 w-5" />} title="No training records" description="Add a certification to get started." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((r) => {
                        const expired = !!r.expiryDate && r.expiryDate < today();
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="font-medium">{empName(r.employeeId)}</div>
                              <div className="text-xs text-muted-foreground">{empCode(r.employeeId)}</div>
                            </TableCell>
                            <TableCell>{courseName(r.courseId)}</TableCell>
                            <TableCell>{r.certificateNo ?? "—"}</TableCell>
                            <TableCell>{r.completionDate ?? "—"}</TableCell>
                            <TableCell className={expired ? "text-destructive" : undefined}>{r.expiryDate ?? "—"}</TableCell>
                            <TableCell>
                              <StatusBadge
                                variant={expired ? "destructive" : r.status === "Completed" ? "success" : r.status === "Failed" ? "destructive" : "warning"}
                                label={expired && r.status === "Completed" ? "Expired" : r.status}
                                dot
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                {r.status === "Scheduled" && (
                                  <Button size="icon" variant="ghost" title="Mark completed" onClick={() => { updateTraining(r.id, { status: "Completed", completionDate: today() }); refresh(); }}>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteTraining(r.id); refresh(); }}>
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

          <TabsContent value="courses" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={seedWshCourses}>
                  <ShieldCheck className="mr-1 h-4 w-4" /> Add WSH standard courses
                </Button>
                <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add course</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New course</DialogTitle>
                      <DialogDescription>Register a safety, statutory or skill course.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Course code</Label><Input value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="Auto" /></div>
                      <div><Label>Name</Label><Input value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="e.g. Work at Height" /></div>
                      <div>
                        <Label>Category</Label>
                        <Select value={courseForm.category} onValueChange={(v) => setCourseForm({ ...courseForm, category: v as TrainingCourse["category"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Provider</Label><Input value={courseForm.provider} onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })} /></div>
                      <div><Label>Validity (months)</Label><Input type="number" min={0} value={courseForm.validityMonths} onChange={(e) => setCourseForm({ ...courseForm, validityMonths: Number(e.target.value) })} /></div>
                      <div><Label>Cost (S$)</Label><Input type="number" min={0} value={courseForm.cost} onChange={(e) => setCourseForm({ ...courseForm, cost: Number(e.target.value) })} /></div>
                      <div>
                        <Label>Mandatory</Label>
                        <Select value={courseForm.mandatory ? "yes" : "no"} onValueChange={(v) => setCourseForm({ ...courseForm, mandatory: v === "yes" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={courseForm.remarks} onChange={(e) => setCourseForm({ ...courseForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCourseOpen(false)}>Cancel</Button>
                      <Button onClick={saveCourse}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Mandatory</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedCourses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<GraduationCap className="h-5 w-5" />} title="No courses" description="Add your first course." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedCourses.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.code}</div>
                          </TableCell>
                          <TableCell>{c.category}</TableCell>
                          <TableCell>{c.provider ?? "—"}</TableCell>
                          <TableCell>{c.validityMonths ? `${c.validityMonths} mo` : "—"}</TableCell>
                          <TableCell>S${c.cost.toLocaleString()}</TableCell>
                          <TableCell>
                            <StatusBadge variant={c.mandatory ? "warning" : "default"} label={c.mandatory ? "Mandatory" : "Optional"} dot />
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteCourse(c.id); refresh(); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
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

          <TabsContent value="incidents" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex justify-end">
                <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Report incident</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Report incident</DialogTitle>
                      <DialogDescription>Log a near miss, injury or dangerous occurrence.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Date</Label><Input type="date" value={incidentForm.incidentDate} onChange={(e) => setIncidentForm({ ...incidentForm, incidentDate: e.target.value })} /></div>
                      <div>
                        <Label>Type</Label>
                        <Select value={incidentForm.incidentType} onValueChange={(v) => setIncidentForm({ ...incidentForm, incidentType: v as SafetyIncident["incidentType"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {incidentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Severity</Label>
                        <Select value={incidentForm.severity} onValueChange={(v) => setIncidentForm({ ...incidentForm, severity: v as SafetyIncident["severity"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {severities.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Lost days</Label><Input type="number" min={0} value={incidentForm.lostDays} onChange={(e) => setIncidentForm({ ...incidentForm, lostDays: Number(e.target.value) })} /></div>
                      <div>
                        <Label>Site</Label>
                        <Select value={incidentForm.siteId} onValueChange={(v) => setIncidentForm({ ...incidentForm, siteId: v })}>
                          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>
                            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Worker involved</Label>
                        <Select value={incidentForm.employeeId} onValueChange={(v) => setIncidentForm({ ...incidentForm, employeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>
                            {companyEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} — {e.employeeCode}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>MOM reported</Label>
                        <Select value={incidentForm.momReported ? "yes" : "no"} onValueChange={(v) => setIncidentForm({ ...incidentForm, momReported: v === "yes" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={incidentForm.status} onValueChange={(v) => setIncidentForm({ ...incidentForm, status: v as SafetyIncident["status"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {incidentStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Description</Label><Textarea value={incidentForm.description} onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Action taken</Label><Textarea value={incidentForm.actionTaken} onChange={(e) => setIncidentForm({ ...incidentForm, actionTaken: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIncidentOpen(false)}>Cancel</Button>
                      <Button onClick={saveIncident}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead>Lost days</TableHead>
                      <TableHead>MOM</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedIncidents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<ShieldAlert className="h-5 w-5" />} title="No incidents logged" description="A clean safety record so far." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedIncidents.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{i.incidentDate}</TableCell>
                          <TableCell>
                            <div className="font-medium">{i.incidentType}</div>
                            <div className="max-w-[220px] truncate text-xs text-muted-foreground">{i.description}</div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={i.severity === "Critical" || i.severity === "High" ? "destructive" : i.severity === "Medium" ? "warning" : "default"}
                              label={i.severity}
                              dot
                            />
                          </TableCell>
                          <TableCell>{siteName(i.siteId)}</TableCell>
                          <TableCell>{empName(i.employeeId)}</TableCell>
                          <TableCell>{i.lostDays}</TableCell>
                          <TableCell>{i.momReported ? "Yes" : "No"}</TableCell>
                          <TableCell>
                            <StatusBadge variant={i.status === "Closed" ? "success" : i.status === "Open" ? "warning" : "default"} label={i.status} dot />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {i.status !== "Closed" && (
                                <Button size="icon" variant="ghost" title="Close incident" onClick={() => { updateIncident(i.id, { status: "Closed" }); refresh(); }}>
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteIncident(i.id); refresh(); }}>
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