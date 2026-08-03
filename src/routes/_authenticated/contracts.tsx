import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Plus,
  Search,
  Handshake,
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  getClients,
  getRateAgreements,
  addRateAgreement,
  deleteRateAgreement,
  getContracts,
  addContract,
  deleteContract,
  getProjects,
  getCurrentCompany,
} from "@/lib/store";
import type {
  RateAgreement,
  ClientContract,
  RateUnit,
  BillingCycle,
  BillingSource,
} from "@/lib/types";

const GST_DEFAULT = 9;
const units: RateUnit[] = ["Hourly", "Daily", "Monthly"];
const cycles: BillingCycle[] = ["Weekly", "Fortnightly", "Monthly"];

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({
    meta: [
      { title: "Service Contracts & Rate Agreements | BSM Engineering" },
      {
        name: "description",
        content: "Manage client-wise rate agreements, per-designation charge-out rates, and automated service contracts.",
      },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  const [rates, setRates] = useState<RateAgreement[]>([]);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);

  const clients = getClients();
  const projects = getProjects();
  const companyId = getCurrentCompany();

  async function refresh() {
    setLoading(true);
    try {
      const [rt, ct] = await Promise.all([getRateAgreements(), getContracts()]);
      setRates(rt);
      setContracts(ct);
    } catch (error) {
      console.error("Failed to load contracts:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filteredRates = rates.filter((r) => {
    const client = clients.find((c) => c.id === r.clientId);
    const q = search.toLowerCase();
    return (
      client?.name.toLowerCase().includes(q) ||
      r.trade.toLowerCase().includes(q)
    );
  });

  const filteredContracts = contracts.filter((c) => {
    const client = clients.find((cl) => cl.id === c.clientId);
    const q = search.toLowerCase();
    const matchesCompany = !companyId || !c.companyId || c.companyId === companyId;
    return (
      matchesCompany &&
      (client?.name.toLowerCase().includes(q) ||
        c.contractNo.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q))
    );
  });

  function handleAddRate(form: FormData) {
    addRateAgreement({
      clientId: form.get("clientId") as string,
      projectId:
        ((form.get("projectId") as string) || "all") === "all"
          ? undefined
          : (form.get("projectId") as string),
      trade: (form.get("trade") as string) || "All",
      unit: form.get("unit") as RateUnit,
      normalRate: Number(form.get("normalRate") ?? 0),
      otRate: Number(form.get("otRate") ?? 0),
      effectiveFrom: form.get("effectiveFrom") as string,
      status: "Active",
    });
    setIsRateOpen(false);
    refresh();
    toast.success("Rate agreement added successfully");
  }

  function handleAddContract(form: FormData) {
    addContract({
      companyId: companyId || undefined,
      clientId: form.get("clientId") as string,
      projectId:
        ((form.get("projectId") as string) || "all") === "all"
          ? undefined
          : (form.get("projectId") as string),
      contractNo: (form.get("contractNo") as string) || `CT-${Date.now().toString().slice(-6)}`,
      title: (form.get("title") as string) || "",
      startDate: form.get("startDate") as string,
      billingCycle: form.get("billingCycle") as BillingCycle,
      billingDay: Number(form.get("billingDay") ?? 1),
      billingSource: form.get("billingSource") as BillingSource,
      gstRate: Number(form.get("gstRate") ?? GST_DEFAULT),
      autoInvoice: true,
      status: "Active",
    });
    setIsContractOpen(false);
    refresh();
    toast.success("Service contract established");
  }

  const money = (n: number) =>
    `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2 })}`;

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Contracts & Rate Agreements
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage client-wise service contracts and designation charge-out rates.
            </p>
          </div>
          <div className="flex gap-2">
             <Dialog open={isContractOpen} onOpenChange={setIsContractOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Handshake className="mr-2 h-4 w-4" />
                  New Contract
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Service Contract</DialogTitle>
                  <DialogDescription>
                    Set up automated billing for a client based on a fixed schedule or timesheets.
                  </DialogDescription>
                </DialogHeader>
                <form action={handleAddContract} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select name="clientId" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Project (Optional)</Label>
                      <Select name="projectId" defaultValue="all">
                        <SelectTrigger>
                          <SelectValue placeholder="All projects" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Projects</SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Contract Title</Label>
                    <Input name="title" placeholder="e.g. Manpower Supply Agreement 2024" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input name="startDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Cycle</Label>
                      <Select name="billingCycle" defaultValue="Monthly">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {cycles.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Billing Source</Label>
                      <Select name="billingSource" defaultValue="Timesheet">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Timesheet">Timesheet / Attendance</SelectItem>
                          <SelectItem value="Fixed">Fixed Monthly Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                     <div className="space-y-2">
                      <Label>GST Rate (%)</Label>
                      <Input name="gstRate" type="number" defaultValue={GST_DEFAULT} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create Contract</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isRateOpen} onOpenChange={setIsRateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Rate Agreement</DialogTitle>
                  <DialogDescription>
                    Define the charge-out rate for a specific designation/trade for a client.
                  </DialogDescription>
                </DialogHeader>
                <form action={handleAddRate} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select name="clientId" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Designation / Trade</Label>
                      <Input name="trade" placeholder="e.g. Electrician, Driver" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select name="unit" defaultValue="Daily">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Effective From</Label>
                      <Input name="effectiveFrom" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Normal Rate ($)</Label>
                      <Input name="normalRate" type="number" step="0.01" placeholder="0.00" required />
                    </div>
                    <div className="space-y-2">
                      <Label>OT Rate ($/hr)</Label>
                      <Input name="otRate" type="number" step="0.01" placeholder="0.00" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Rate Agreement</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search client or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 shadow-sm"
          />
        </div>

        <Tabs defaultValue="rates" className="mt-6">
          <TabsList>
            <TabsTrigger value="rates">Designation Rates</TabsTrigger>
            <TabsTrigger value="contracts">Service Contracts</TabsTrigger>
          </TabsList>

          <TabsContent value="rates" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Rate Type</TableHead>
                    <TableHead className="text-right">Normal Rate</TableHead>
                    <TableHead className="text-right">OT Rate</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No rate agreements found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRates.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {clients.find((c) => c.id === r.clientId)?.name ?? "Unknown Client"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal capitalize">
                            {r.trade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.unit}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {money(r.normalRate)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 font-medium">
                          {r.otRate ? money(r.otRate) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {r.effectiveFrom}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              deleteRateAgreement(r.id);
                              refresh();
                              toast.info("Rate agreement removed");
                            }}
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
          </TabsContent>

          <TabsContent value="contracts" className="mt-4 space-y-4">
             <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No service contracts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs font-bold uppercase">
                          {c.contractNo}
                        </TableCell>
                        <TableCell>
                           {clients.find((cl) => cl.id === c.clientId)?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {c.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {c.billingSource}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.billingCycle}</TableCell>
                        <TableCell className="text-sm">
                           <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {c.nextInvoiceOn}
                          </div>
                        </TableCell>
                        <TableCell>
                           <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                           <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              deleteContract(c.id);
                              refresh();
                              toast.info("Contract terminated");
                            }}
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
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
