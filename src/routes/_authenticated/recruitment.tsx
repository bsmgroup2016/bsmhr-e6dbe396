import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, Briefcase, CalendarClock, CheckCircle2, Plus, Search, Trash2, Download, ArrowRight } from "lucide-react";
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
  getRequisitions, getCandidates, getClients, getSites, getCurrentCompany,
  addRequisition, updateRequisition, deleteRequisition,
  addCandidate, updateCandidate, deleteCandidate,
  advanceCandidate, convertCandidateToEmployee, recruitmentFunnel, candidateStages,
} from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { JobRequisition, Candidate, PassType } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({
    meta: [
      { title: "Recruitment — BSM Workforce & Operations" },
      { name: "description", content: "Candidate pipeline, interview scheduling and onboarding for new hires." },
      { property: "og:title", content: "Recruitment — BSM Workforce & Operations" },
      { property: "og:description", content: "Candidate pipeline, interview scheduling and onboarding for new hires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecruitmentPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const reqStatuses: JobRequisition["status"][] = ["Open", "On Hold", "Filled", "Cancelled"];
const passTypes: PassType[] = ["Work Permit", "S Pass", "Employment Pass", "Singaporean/PR"];
const sources: Candidate["source"][] = ["Agent", "Referral", "Walk-in", "Job Portal", "Direct", "Other"];
const allStages: Candidate["stage"][] = [...candidateStages, "Rejected", "Withdrawn"];

const emptyReq = {
  code: "", title: "", trade: "", clientId: "", siteId: "", headcount: 1,
  passType: "Work Permit" as PassType, budgetSalary: 0, targetDate: "",
  status: "Open" as JobRequisition["status"], remarks: "",
};

const emptyCand = {
  requisitionId: "", name: "", nationality: "", phone: "", email: "", passportNumber: "",
  trade: "", experienceYears: 0, expectedSalary: 0,
  source: "Agent" as Candidate["source"], agentName: "",
  stage: "Applied" as Candidate["stage"], interviewDate: "", joinDate: "", remarks: "",
};

function stageVariant(stage: Candidate["stage"]) {
  if (stage === "Hired") return "success" as const;
  if (stage === "Rejected" || stage === "Withdrawn") return "destructive" as const;
  if (stage === "Applied" || stage === "Screening") return "default" as const;
  return "warning" as const;
}

export default function RecruitmentPage() {
  const companyId = getCurrentCompany();
  const [requisitions, setRequisitions] = useState(getRequisitions());
  const [candidates, setCandidates] = useState(getCandidates());
  const [clients] = useState(getClients());
  const [sites] = useState(getSites());
  const [search, setSearch] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [candOpen, setCandOpen] = useState(false);
  const [reqForm, setReqForm] = useState(emptyReq);
  const [candForm, setCandForm] = useState(emptyCand);

  function refresh() {
    setRequisitions(getRequisitions());
    setCandidates(getCandidates());
  }

  const scopedReqs = useMemo(
    () => requisitions.filter((r) => !companyId || !r.companyId || r.companyId === companyId),
    [requisitions, companyId],
  );
  const scopedCands = useMemo(
    () => candidates.filter((c) => !companyId || !c.companyId || c.companyId === companyId),
    [candidates, companyId],
  );

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const siteName = (id?: string) => sites.find((s) => s.id === id)?.name ?? "—";
  const reqTitle = (id?: string) => requisitions.find((r) => r.id === id)?.title ?? "—";

  const funnel = recruitmentFunnel(companyId || undefined);
  const openReqs = scopedReqs.filter((r) => r.status === "Open");
  const openHeadcount = openReqs.reduce((sum, r) => sum + r.headcount, 0);
  const interviews = scopedCands.filter((c) => c.interviewDate && c.interviewDate >= today() && c.stage !== "Hired");
  const hired = scopedCands.filter((c) => c.stage === "Hired");
  const active = scopedCands.filter((c) => !["Hired", "Rejected", "Withdrawn"].includes(c.stage));

  const q = search.trim().toLowerCase();
  const filteredCands = scopedCands.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || (c.trade ?? "").toLowerCase().includes(q) ||
      (c.agentName ?? "").toLowerCase().includes(q) || (c.nationality ?? "").toLowerCase().includes(q),
  );

  function saveReq() {
    if (!reqForm.title.trim()) return toast.error("Job title required");
    addRequisition({
      ...reqForm,
      code: reqForm.code.trim() || `REQ-${String(requisitions.length + 1).padStart(3, "0")}`,
      clientId: reqForm.clientId || undefined,
      siteId: reqForm.siteId || undefined,
      targetDate: reqForm.targetDate || undefined,
      companyId: companyId || undefined,
    });
    setReqForm(emptyReq);
    setReqOpen(false);
    refresh();
    toast.success("Requisition created");
  }

  function saveCand() {
    if (!candForm.name.trim()) return toast.error("Candidate name required");
    addCandidate({
      ...candForm,
      requisitionId: candForm.requisitionId || undefined,
      interviewDate: candForm.interviewDate || undefined,
      joinDate: candForm.joinDate || undefined,
      companyId: companyId || undefined,
    });
    setCandForm(emptyCand);
    setCandOpen(false);
    refresh();
    toast.success("Candidate added");
  }

  function handleHire(c: Candidate) {
    const emp = convertCandidateToEmployee(c.id);
    refresh();
    if (emp) toast.success(`${c.name} converted to employee ${emp.employeeCode}`);
    else toast.error("Already converted");
  }

  function handleExport() {
    void exportRows(
      filteredCands.map((c) => ({
        Name: c.name,
        Nationality: c.nationality ?? "",
        Trade: c.trade ?? "",
        Requisition: reqTitle(c.requisitionId),
        Source: c.source,
        Agent: c.agentName ?? "",
        Stage: c.stage,
        Interview: c.interviewDate ?? "",
        "Expected salary": c.expectedSalary ?? 0,
      })),
      "candidates", "Recruitment",
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Recruitment</h1>
            <p className="text-sm text-muted-foreground">Job requisitions, candidate pipeline and onboarding hand-off.</p>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={handleExport} disabled={filteredCands.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Open requisitions" value={openReqs.length.toString()} icon={<Briefcase className="h-5 w-5" />} variant="primary" caption={`${openHeadcount} positions needed`} />
          <SummaryCard title="Active candidates" value={active.length.toString()} icon={<UserPlus className="h-5 w-5" />} variant="default" caption="In pipeline" />
          <SummaryCard title="Upcoming interviews" value={interviews.length.toString()} icon={<CalendarClock className="h-5 w-5" />} variant={interviews.length ? "warning" : "default"} caption="Scheduled ahead" />
          <SummaryCard title="Hired" value={hired.length.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="Converted to employees" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">Hiring funnel</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {funnel.map((f) => (
              <div key={f.stage} className="rounded-lg border px-3 py-2 text-xs">
                <span className="text-muted-foreground">{f.stage}</span>{" "}
                <span className="font-semibold text-foreground">{f.count}</span>
              </div>
            ))}
          </div>
        </div>

        <Tabs defaultValue="candidates">
          <TabsList>
            <TabsTrigger value="candidates">Candidates</TabsTrigger>
            <TabsTrigger value="requisitions">Job requisitions</TabsTrigger>
          </TabsList>

          <TabsContent value="candidates" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search candidate, trade or agent..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Dialog open={candOpen} onOpenChange={setCandOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add candidate</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New candidate</DialogTitle>
                      <DialogDescription>Track applicants through the hiring pipeline.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2"><Label>Full name</Label><Input value={candForm.name} onChange={(e) => setCandForm({ ...candForm, name: e.target.value })} /></div>
                      <div><Label>Nationality</Label><Input value={candForm.nationality} onChange={(e) => setCandForm({ ...candForm, nationality: e.target.value })} /></div>
                      <div><Label>Trade</Label><Input value={candForm.trade} onChange={(e) => setCandForm({ ...candForm, trade: e.target.value })} /></div>
                      <div><Label>Phone</Label><Input value={candForm.phone} onChange={(e) => setCandForm({ ...candForm, phone: e.target.value })} /></div>
                      <div><Label>Email</Label><Input type="email" value={candForm.email} onChange={(e) => setCandForm({ ...candForm, email: e.target.value })} /></div>
                      <div><Label>Passport no</Label><Input value={candForm.passportNumber} onChange={(e) => setCandForm({ ...candForm, passportNumber: e.target.value })} /></div>
                      <div><Label>Experience (years)</Label><Input type="number" value={candForm.experienceYears} onChange={(e) => setCandForm({ ...candForm, experienceYears: Number(e.target.value) })} /></div>
                      <div><Label>Expected salary (S$)</Label><Input type="number" value={candForm.expectedSalary} onChange={(e) => setCandForm({ ...candForm, expectedSalary: Number(e.target.value) })} /></div>
                      <div>
                        <Label>Source</Label>
                        <Select value={candForm.source} onValueChange={(v) => setCandForm({ ...candForm, source: v as Candidate["source"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Agent / referrer</Label><Input value={candForm.agentName} onChange={(e) => setCandForm({ ...candForm, agentName: e.target.value })} /></div>
                      <div className="sm:col-span-2">
                        <Label>Requisition</Label>
                        <Select value={candForm.requisitionId} onValueChange={(v) => setCandForm({ ...candForm, requisitionId: v })}>
                          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>{scopedReqs.map((r) => <SelectItem key={r.id} value={r.id}>{r.code} — {r.title}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Interview date</Label><Input type="date" value={candForm.interviewDate} onChange={(e) => setCandForm({ ...candForm, interviewDate: e.target.value })} /></div>
                      <div><Label>Target join date</Label><Input type="date" value={candForm.joinDate} onChange={(e) => setCandForm({ ...candForm, joinDate: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={candForm.remarks} onChange={(e) => setCandForm({ ...candForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCandOpen(false)}>Cancel</Button>
                      <Button onClick={saveCand}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Requisition</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Interview</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="w-52 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCands.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<UserPlus className="h-5 w-5" />} title="No candidates" description="Add an applicant to start the pipeline." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCands.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.nationality || "—"} · {c.phone || "no phone"}</div>
                          </TableCell>
                          <TableCell>{c.trade || "—"}</TableCell>
                          <TableCell className="text-sm">{reqTitle(c.requisitionId)}</TableCell>
                          <TableCell className="text-sm">
                            {c.source}
                            {c.agentName ? <div className="text-xs text-muted-foreground">{c.agentName}</div> : null}
                          </TableCell>
                          <TableCell>{c.interviewDate ?? "—"}</TableCell>
                          <TableCell>
                            <Select value={c.stage} onValueChange={(v) => { updateCandidate(c.id, { stage: v as Candidate["stage"] }); refresh(); }}>
                              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>{allStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                            <div className="mt-1"><StatusBadge variant={stageVariant(c.stage)} label={c.employeeId ? "Onboarded" : c.stage} dot /></div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Next stage" onClick={() => { advanceCandidate(c.id); refresh(); }} disabled={!!c.employeeId}>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleHire(c)} disabled={!!c.employeeId}>
                                Hire
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { deleteCandidate(c.id); refresh(); toast.success("Candidate removed"); }}>
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

          <TabsContent value="requisitions" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Manpower requests</h2>
                <Dialog open={reqOpen} onOpenChange={setReqOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New requisition</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Job requisition</DialogTitle>
                      <DialogDescription>Headcount request raised for a client or internal site.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Code</Label><Input placeholder="Auto" value={reqForm.code} onChange={(e) => setReqForm({ ...reqForm, code: e.target.value })} /></div>
                      <div><Label>Job title</Label><Input value={reqForm.title} onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })} /></div>
                      <div><Label>Trade</Label><Input value={reqForm.trade} onChange={(e) => setReqForm({ ...reqForm, trade: e.target.value })} /></div>
                      <div><Label>Headcount</Label><Input type="number" min={1} value={reqForm.headcount} onChange={(e) => setReqForm({ ...reqForm, headcount: Number(e.target.value) })} /></div>
                      <div>
                        <Label>Client</Label>
                        <Select value={reqForm.clientId} onValueChange={(v) => setReqForm({ ...reqForm, clientId: v })}>
                          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Site</Label>
                        <Select value={reqForm.siteId} onValueChange={(v) => setReqForm({ ...reqForm, siteId: v })}>
                          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Pass type</Label>
                        <Select value={reqForm.passType} onValueChange={(v) => setReqForm({ ...reqForm, passType: v as PassType })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{passTypes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Budget salary (S$)</Label><Input type="number" value={reqForm.budgetSalary} onChange={(e) => setReqForm({ ...reqForm, budgetSalary: Number(e.target.value) })} /></div>
                      <div><Label>Target date</Label><Input type="date" value={reqForm.targetDate} onChange={(e) => setReqForm({ ...reqForm, targetDate: e.target.value })} /></div>
                      <div>
                        <Label>Status</Label>
                        <Select value={reqForm.status} onValueChange={(v) => setReqForm({ ...reqForm, status: v as JobRequisition["status"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{reqStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={reqForm.remarks} onChange={(e) => setReqForm({ ...reqForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setReqOpen(false)}>Cancel</Button>
                      <Button onClick={saveReq}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requisition</TableHead>
                      <TableHead>Client / Site</TableHead>
                      <TableHead>Headcount</TableHead>
                      <TableHead>Applicants</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedReqs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<Briefcase className="h-5 w-5" />} title="No requisitions" description="Raise a manpower request to begin hiring." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedReqs.map((r) => {
                        const applicants = scopedCands.filter((c) => c.requisitionId === r.id);
                        const filled = applicants.filter((c) => c.stage === "Hired").length;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="font-medium">{r.title}</div>
                              <div className="text-xs text-muted-foreground">{r.code} · {r.trade || "—"}</div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {clientName(r.clientId)}
                              <div className="text-xs text-muted-foreground">{siteName(r.siteId)}</div>
                            </TableCell>
                            <TableCell>{filled}/{r.headcount}</TableCell>
                            <TableCell>{applicants.length}</TableCell>
                            <TableCell>{r.targetDate ?? "—"}</TableCell>
                            <TableCell>
                              <Select value={r.status} onValueChange={(v) => { updateRequisition(r.id, { status: v as JobRequisition["status"] }); refresh(); }}>
                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>{reqStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => { deleteRequisition(r.id); refresh(); toast.success("Requisition deleted"); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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
        </Tabs>
      </div>
    </AppShell>
  );
}
