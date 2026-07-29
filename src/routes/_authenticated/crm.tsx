import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeDollarSign, Target, CalendarClock, TrendingUp, Plus, Search, Trash2, Download, CheckCircle2, UserPlus,
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
  getLeads, getActivities, getClients, getCurrentCompany,
  addLead, updateLead, deleteLead, setLeadStage, convertLeadToClient,
  addActivity, updateActivity, deleteActivity, crmPipeline, dueFollowUps, leadStages,
} from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { Lead, CrmActivity } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "Client CRM — BSM Workforce & Operations" },
      { name: "description", content: "Leads, opportunity pipeline and client follow-ups for manpower supply." },
      { property: "og:title", content: "Client CRM — BSM Workforce & Operations" },
      { property: "og:description", content: "Leads, opportunity pipeline and client follow-ups for manpower supply." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const sources: Lead["source"][] = ["Referral", "Cold Call", "Website", "Existing Client", "Tender", "Other"];
const activityTypes: CrmActivity["activityType"][] = ["Call", "Email", "Meeting", "Site Visit", "Quotation", "Note"];
const sgd = (n: number) => `S$${n.toLocaleString("en-SG", { maximumFractionDigits: 0 })}`;

const emptyLead = {
  companyName: "", contactPerson: "", phone: "", email: "", industry: "", trade: "",
  headcountNeeded: 0, monthlyValue: 0, source: "Referral" as Lead["source"],
  stage: "New" as Lead["stage"], probability: 10, expectedCloseDate: "", ownerName: "", remarks: "",
};

const emptyActivity = {
  leadId: "", activityDate: today(), activityType: "Call" as CrmActivity["activityType"],
  subject: "", notes: "", followUpDate: "", done: false,
};

function stageVariant(stage: Lead["stage"]) {
  if (stage === "Won") return "success" as const;
  if (stage === "Lost") return "destructive" as const;
  if (stage === "New" || stage === "Contacted") return "default" as const;
  return "warning" as const;
}

export default function CrmPage() {
  const companyId = getCurrentCompany();
  const [leads, setLeads] = useState(getLeads());
  const [activities, setActivities] = useState(getActivities());
  const [clients, setClients] = useState(getClients());
  const [search, setSearch] = useState("");
  const [leadOpen, setLeadOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [actForm, setActForm] = useState(emptyActivity);

  function refresh() {
    setLeads(getLeads());
    setActivities(getActivities());
    setClients(getClients());
  }

  const scopedLeads = useMemo(
    () => leads.filter((l) => !companyId || !l.companyId || l.companyId === companyId),
    [leads, companyId],
  );
  const scopedActs = useMemo(
    () => activities.filter((a) => !companyId || !a.companyId || a.companyId === companyId),
    [activities, companyId],
  );

  const pipeline = crmPipeline(companyId || undefined);
  const followUps = dueFollowUps(companyId || undefined);
  const openLeads = scopedLeads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const won = scopedLeads.filter((l) => l.stage === "Won");
  const lost = scopedLeads.filter((l) => l.stage === "Lost");
  const openValue = openLeads.reduce((s, l) => s + (l.monthlyValue || 0), 0);
  const weighted = openLeads.reduce((s, l) => s + (l.monthlyValue || 0) * (l.probability || 0) / 100, 0);
  const winRate = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
  const maxValue = Math.max(1, ...pipeline.map((p) => p.value));

  const q = search.trim().toLowerCase();
  const filteredLeads = scopedLeads.filter(
    (l) => !q || l.companyName.toLowerCase().includes(q) ||
      (l.contactPerson ?? "").toLowerCase().includes(q) || (l.trade ?? "").toLowerCase().includes(q),
  );

  const leadName = (id?: string) => leads.find((l) => l.id === id)?.companyName ?? "—";

  function saveLead() {
    if (!leadForm.companyName.trim()) return toast.error("Company name required");
    addLead({
      ...leadForm,
      headcountNeeded: Number(leadForm.headcountNeeded) || undefined,
      monthlyValue: Number(leadForm.monthlyValue) || 0,
      probability: Number(leadForm.probability) || 0,
      expectedCloseDate: leadForm.expectedCloseDate || undefined,
      companyId: companyId || undefined,
    });
    setLeadForm(emptyLead);
    setLeadOpen(false);
    refresh();
    toast.success("Lead added");
  }

  function saveActivity() {
    if (!actForm.subject.trim()) return toast.error("Subject required");
    addActivity({
      ...actForm,
      leadId: actForm.leadId || undefined,
      followUpDate: actForm.followUpDate || undefined,
      companyId: companyId || undefined,
    });
    setActForm({ ...emptyActivity, activityDate: today() });
    setActOpen(false);
    refresh();
    toast.success("Activity logged");
  }

  function convert(lead: Lead) {
    const client = convertLeadToClient(lead.id);
    refresh();
    if (client) toast.success(`${client.name} client হিসেবে যোগ হয়েছে`);
    else toast.error("Already converted");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Client CRM</h1>
            <p className="text-sm text-muted-foreground">Leads, opportunity pipeline, quotations and follow-up reminders.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 sm:mt-0"
            disabled={filteredLeads.length === 0}
            onClick={() =>
              exportRows(
                filteredLeads.map((l) => ({
                  Company: l.companyName, Contact: l.contactPerson ?? "", Phone: l.phone ?? "",
                  Trade: l.trade ?? "", Headcount: l.headcountNeeded ?? "", MonthlyValue: l.monthlyValue,
                  Source: l.source, Stage: l.stage, Probability: l.probability,
                  ExpectedClose: l.expectedCloseDate ?? "", Owner: l.ownerName ?? "",
                })),
                "crm-leads",
              )
            }
          >
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Open leads" value={String(openLeads.length)} icon={<Target className="h-5 w-5" />} variant="primary" caption={`${sgd(openValue)} / month`} />
        <SummaryCard title="Weighted pipeline" value={sgd(Math.round(weighted))} icon={<TrendingUp className="h-5 w-5" />} variant="info" caption="Probability adjusted" />
        <SummaryCard title="Win rate" value={`${winRate}%`} icon={<BadgeDollarSign className="h-5 w-5" />} variant="success" caption={`${won.length} won · ${lost.length} lost`} />
        <SummaryCard title="Follow-ups due" value={String(followUps.length)} icon={<CalendarClock className="h-5 w-5" />} variant={followUps.length ? "warning" : "default"} caption="Today or overdue" />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Opportunity pipeline</h3>
        <div className="space-y-3">
          {pipeline.map((p) => (
            <div key={p.stage} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-muted-foreground">{p.stage}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                  style={{ width: `${Math.round((p.value / maxValue) * 100)}%` }}
                />
              </div>
              <span className="w-16 text-right tabular-nums">{p.count}</span>
              <span className="w-28 text-right tabular-nums text-muted-foreground">{sgd(p.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">Leads &amp; Opportunities</TabsTrigger>
          <TabsTrigger value="activities">Activities &amp; Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search company, contact, trade…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 size-4" /> New lead</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>New lead</DialogTitle>
                  <DialogDescription>Prospective client enquiry for manpower supply.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Company name *</Label>
                    <Input value={leadForm.companyName} onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact person</Label>
                    <Input value={leadForm.contactPerson} onChange={(e) => setLeadForm({ ...leadForm, contactPerson: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input value={leadForm.industry} onChange={(e) => setLeadForm({ ...leadForm, industry: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Trade required</Label>
                    <Input value={leadForm.trade} onChange={(e) => setLeadForm({ ...leadForm, trade: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Headcount needed</Label>
                    <Input type="number" value={leadForm.headcountNeeded} onChange={(e) => setLeadForm({ ...leadForm, headcountNeeded: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly value (S$)</Label>
                    <Input type="number" value={leadForm.monthlyValue} onChange={(e) => setLeadForm({ ...leadForm, monthlyValue: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select value={leadForm.source} onValueChange={(v) => setLeadForm({ ...leadForm, source: v as Lead["source"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={leadForm.stage} onValueChange={(v) => setLeadForm({ ...leadForm, stage: v as Lead["stage"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{leadStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expected close</Label>
                    <Input type="date" value={leadForm.expectedCloseDate} onChange={(e) => setLeadForm({ ...leadForm, expectedCloseDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Input value={leadForm.ownerName} onChange={(e) => setLeadForm({ ...leadForm, ownerName: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Remarks</Label>
                    <Textarea value={leadForm.remarks} onChange={(e) => setLeadForm({ ...leadForm, remarks: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLeadOpen(false)}>Cancel</Button>
                  <Button onClick={saveLead}>Save lead</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {filteredLeads.length === 0 ? (
            <EmptyState icon={<Target className="h-5 w-5" />} title="No leads yet" description="Add your first prospective client enquiry." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Trade / HC</TableHead>
                    <TableHead className="text-right">Monthly value</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Prob.</TableHead>
                    <TableHead>Close</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.companyName}</div>
                        <div className="text-xs text-muted-foreground">{l.source}{l.ownerName ? ` · ${l.ownerName}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{l.contactPerson || "—"}</div>
                        <div className="text-xs text-muted-foreground">{l.phone || l.email || ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">{l.trade || "—"}{l.headcountNeeded ? ` · ${l.headcountNeeded} pax` : ""}</TableCell>
                      <TableCell className="text-right tabular-nums">{sgd(l.monthlyValue)}</TableCell>
                      <TableCell>
                        <Select value={l.stage} onValueChange={(v) => { setLeadStage(l.id, v as Lead["stage"]); refresh(); }}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>{leadStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.probability}%</TableCell>
                      <TableCell className="text-sm">{l.expectedCloseDate ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {l.stage === "Won" && !l.clientId && (
                            <Button size="sm" variant="outline" onClick={() => convert(l)}>
                              <UserPlus className="mr-1 size-3.5" /> To client
                            </Button>
                          )}
                          {l.clientId && <StatusBadge variant="success" label="Client" />}
                          <Button size="icon" variant="ghost" onClick={() => { deleteLead(l.id); refresh(); }}>
                            <Trash2 className="size-4 text-destructive" />
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

        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={actOpen} onOpenChange={setActOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 size-4" /> Log activity</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Log activity</DialogTitle>
                  <DialogDescription>Call, meeting, site visit or quotation record.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Lead</Label>
                    <Select value={actForm.leadId} onValueChange={(v) => setActForm({ ...actForm, leadId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                      <SelectContent>
                        {scopedLeads.map((l) => <SelectItem key={l.id} value={l.id}>{l.companyName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={actForm.activityType} onValueChange={(v) => setActForm({ ...actForm, activityType: v as CrmActivity["activityType"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{activityTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={actForm.activityDate} onChange={(e) => setActForm({ ...actForm, activityDate: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Subject *</Label>
                    <Input value={actForm.subject} onChange={(e) => setActForm({ ...actForm, subject: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={actForm.notes} onChange={(e) => setActForm({ ...actForm, notes: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Follow-up date</Label>
                    <Input type="date" value={actForm.followUpDate} onChange={(e) => setActForm({ ...actForm, followUpDate: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setActOpen(false)}>Cancel</Button>
                  <Button onClick={saveActivity}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {scopedActs.length === 0 ? (
            <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="No activities logged" description="Track calls, meetings and quotations with clients." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopedActs.map((a) => {
                    const overdue = !a.done && a.followUpDate && a.followUpDate <= today();
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{a.activityDate}</TableCell>
                        <TableCell><StatusBadge variant="default" label={a.activityType} /></TableCell>
                        <TableCell className="text-sm">{leadName(a.leadId)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{a.subject}</div>
                          {a.notes && <div className="max-w-md truncate text-xs text-muted-foreground">{a.notes}</div>}
                        </TableCell>
                        <TableCell>
                          {a.followUpDate ? (
                            <StatusBadge variant={a.done ? "success" : overdue ? "destructive" : "warning"} label={a.done ? "Done" : a.followUpDate} />
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!a.done && (
                              <Button size="sm" variant="outline" onClick={() => { updateActivity(a.id, { done: true }); refresh(); }}>
                                <CheckCircle2 className="mr-1 size-3.5" /> Done
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { deleteActivity(a.id); refresh(); }}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
