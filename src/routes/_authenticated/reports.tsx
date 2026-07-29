import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from "react";
import { createFileRoute } from "tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  Users,
  Briefcase,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Download,
  Calendar,
  ClipboardList,
  ShieldCheck,
  GraduationCap,
  HardHat,
  Package,
  BedDouble,
  Truck,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExportButton } from "@/components/data-io";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getEmployees,
  getProjects,
  getSites,
  getAssignments,
  getDocuments,
  getPayroll,
  getAttendance,
  getLeaveRequests,
  getInvoices,
  getExpenses,
  getLeads,
  getCandidates,
  getIncidents,
  getTrainings,
  getAssets,
  getIssuances,
  getDormitories,
  getAllocations,
  getVehicles,
  getTrips,
  getInventory,
  workforceByStatus,
  workforceByPassType,
  deploymentCoverage,
  passExpirySummary,
  attendanceSummary,
  leaveSummary,
  payrollTrendSummary,
  financeTrend,
  expenseByCategory,
  recruitmentFunnel,
  crmPipeline,
  safetySummary,
  trainingCompliance,
  fleetAvailability,
  dormitoryOccupancy,
  assetSummary,
} from "@/lib/store";
import { exportSheets, timestampedName } from "@/lib/xlsx";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return d.toISOString().slice(0, 7);
}).reverse();

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — BSM Workforce & Operations" },
      { name: "description", content: "Workforce, compliance, financial and operational analytics." },
      { property: "og:title", content: "Reports & Analytics — BSM Workforce & Operations" },
      { property: "og:description", content: "Workforce, compliance, financial and operational analytics." },
    ],
  }),
  component: ReportsPage,
});

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [month, setMonth] = useState(months[months.length - 1]);

  const employees = useMemo(() => getEmployees(), []);
  const projects = useMemo(() => getProjects(), []);
  const sites = useMemo(() => getSites(), []);
  const assignments = useMemo(() => getAssignments(), []);
  const documents = useMemo(() => getDocuments(), []);
  const payroll = useMemo(() => getPayroll(), []);
  const attendance = useMemo(() => getAttendance(), []);
  const leaveRequests = useMemo(() => getLeaveRequests(), []);
  const invoices = useMemo(() => getInvoices(), []);
  const expenses = useMemo(() => getExpenses(), []);
  const leads = useMemo(() => getLeads(), []);
  const candidates = useMemo(() => getCandidates(), []);
  const incidents = useMemo(() => getIncidents(), []);
  const trainings = useMemo(() => getTrainings(), []);
  const assets = useMemo(() => getAssets(), []);
  const issuances = useMemo(() => getIssuances(), []);
  const dormitories = useMemo(() => getDormitories(), []);
  const allocations = useMemo(() => getAllocations(), []);
  const vehicles = useMemo(() => getVehicles(), []);
  const trips = useMemo(() => getTrips(), []);
  const inventory = useMemo(() => getInventory(), []);

  const activeCount = employees.filter((e) => e.status === "Active" || e.status === "Deployed").length;
  const deployedCount = employees.filter((e) => e.status === "Deployed").length;
  const passExpiry = passExpirySummary();
  const totalPayroll = payroll.reduce((s, p) => s + p.netPay, 0);
  const totalInvoices = invoices.reduce((s, i) => s + i.total, 0);
  const totalReceipts = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalPaidExpenses = expenses.filter((e) => e.status === "Paid").reduce((s, e) => s + e.amount + e.gstAmount, 0);
  const attendanceCounts = attendanceSummary(month);

  const statusData = useMemo(() => workforceByStatus(), []);
  const passData = useMemo(() => workforceByPassType(), []);
  const coverageData = useMemo(() => deploymentCoverage(), []);
  const leaveData = useMemo(() => leaveSummary(), []);
  const payrollTrendData = useMemo(() => payrollTrendSummary(), []);
  const financeData = useMemo(() => financeTrend(), []);
  const expenseData = useMemo(() => expenseByCategory(), []);
  const recruitmentData = useMemo(() => recruitmentFunnel(), []);
  const crmData = useMemo(() => crmPipeline(), []);
  const safetyData = useMemo(() => safetySummary(), []);
  const trainingData = useMemo(() => trainingCompliance(), []);
  const fleetData = useMemo(() => fleetAvailability(), []);
  const dormData = useMemo(() => dormitoryOccupancy(), []);
  const assetData = useMemo(() => assetSummary(), []);

  async function exportFullPack() {
    await exportSheets(
      [
        { name: "Workforce", rows: employees.map((e) => ({ "Employee Code": e.employeeCode, Name: e.name, FIN: e.fin, "Pass Type": e.passType, "Pass Expiry": e.passExpiry, Trade: e.trade, Status: e.status, Site: e.site ?? "" })) },
        { name: "Deployment", rows: coverageData.map((s) => ({ Site: s.site, Required: s.required, Assigned: s.assigned, Gap: s.gap })) },
        { name: "Pass Expiry", rows: passExpiry.expiringList.map((e) => ({ "Employee Code": e.employeeCode, Name: e.name, "Pass Type": e.passType, "Pass Expiry": e.passExpiry })) },
        { name: "Attendance", rows: attendance.map((a) => ({ Date: a.date, "Employee ID": a.employeeId, Status: a.status, Hours: a.hoursWorked, OT: a.overtimeHours })) },
        { name: "Leave", rows: leaveRequests.map((l) => ({ Type: l.type, From: l.startDate, To: l.endDate, Days: l.days, Status: l.status })) },
        { name: "Payroll", rows: payroll.map((p) => ({ Month: p.month, "Employee ID": p.employeeId, "Basic Salary": p.basicSalary, OT: p.overtimePay, Levies: p.levies, CPF: p.cpfEmployee, "Net Pay": p.netPay })) },
        { name: "Finance", rows: financeData.map((f) => ({ Month: f.month, Revenue: f.revenue, Cost: f.cost, Profit: f.profit })) },
        { name: "Expenses", rows: expenseData.map((e) => ({ Category: e.category, Amount: e.amount, Count: e.count })) },
        { name: "Safety", rows: incidents.map((i) => ({ Date: i.incidentDate, Severity: i.severity, Type: i.incidentType, "MOM Reported": i.momReported ? "Yes" : "No", Status: i.status })) },
        { name: "Training", rows: trainings.map((t) => ({ "Employee ID": t.employeeId, "Course ID": t.courseId, "Completion": t.completionDate, "Expiry": t.expiryDate, Status: t.status })) },
        { name: "Assets", rows: assets.map((a) => ({ Code: a.assetCode, Name: a.name, Category: a.category, Quantity: a.quantity, "Unit Cost": a.unitCost, Status: a.status })) },
        { name: "Dormitories", rows: dormitories.map((d, i) => ({ Name: d.name, Capacity: d.capacity, Occupied: dormData[i]?.occupied ?? 0, Vacant: dormData[i]?.vacant ?? 0 })) },
        { name: "Vehicles", rows: vehicles.map((v) => ({ Plate: v.plateNo, Type: v.type, "Make/Model": v.makeModel, Status: v.status })) },
      ],
      timestampedName("bsm_analytics_pack", "xlsx"),
    );
  }

  const formatMonth = (m: string) => {
    const [year, mon] = m.split("-");
    return `${year}-${mon}`;
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground">Workforce, compliance, financial and operational insights.</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <Button size="sm" onClick={exportFullPack}>
              <Download className="mr-1 h-4 w-4" />
              Export full pack
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Active workers" value={activeCount.toString()} icon={<Users className="h-5 w-5" />} variant="primary" caption={`${deployedCount} deployed on sites`} />
          <SummaryCard title="Pass alerts" value={(passExpiry.expired + passExpiry.expiringSoon).toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" caption={`${passExpiry.expired} expired`} />
          <SummaryCard title="Total payroll" value={`S$${totalPayroll.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant="info" caption="All months" />
          <SummaryCard title="Net profit" value={`S$${(totalInvoices - totalPaidExpenses).toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} variant="success" caption={`S$${totalReceipts.toLocaleString()} received`} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background"><TrendingUp className="mr-1 h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="workforce" className="data-[state=active]:bg-background"><Users className="mr-1 h-4 w-4" />Workforce</TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-background"><Calendar className="mr-1 h-4 w-4" />Attendance & Leave</TabsTrigger>
            <TabsTrigger value="finance" className="data-[state=active]:bg-background"><DollarSign className="mr-1 h-4 w-4" />Finance</TabsTrigger>
            <TabsTrigger value="compliance" className="data-[state=active]:bg-background"><ShieldCheck className="mr-1 h-4 w-4" />Compliance & Safety</TabsTrigger>
            <TabsTrigger value="operations" className="data-[state=active]:bg-background"><Truck className="mr-1 h-4 w-4" />Operations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Workforce by status</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label>
                        {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Payroll trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={payrollTrendData}>
                      <defs>
                        <linearGradient id="net" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="net" stroke="#3b82f6" fill="url(#net)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Finance: revenue vs cost</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financeData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="#10b981" />
                      <Bar dataKey="cost" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">CRM pipeline weighted value</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={crmData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="stage" angle={-20} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="weighted" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workforce" className="space-y-4 mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Deployment coverage</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coverageData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="site" angle={-20} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="required" fill="#f59e0b" />
                      <Bar dataKey="assigned" fill="#3b82f6" />
                      <Bar dataKey="gap" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Pass type distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={passData} dataKey="count" nameKey="passType" cx="50%" cy="50%" outerRadius={80} label>
                        {passData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium">Pass expiry alerts</h3>
                <ExportButton rows={passExpiry.expiringList.map((e) => ({ "Employee Code": e.employeeCode, Name: e.name, "Pass Type": e.passType, "Pass Expiry": e.passExpiry }))} baseName="pass_expiry_alert" sheetName="Pass Expiry" label="Export" />
              </div>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Employee</TableHead><TableHead>Pass Type</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {passExpiry.expiringList.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name} ({e.employeeCode})</TableCell>
                        <TableCell>{e.passType}</TableCell>
                        <TableCell>{e.passExpiry}</TableCell>
                        <TableCell>
                          <StatusBadge variant={new Date(e.passExpiry) < new Date() ? "destructive" : "warning"} label={new Date(e.passExpiry) < new Date() ? "Expired" : "Expiring soon"} dot />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m) => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard title="Present" value={attendanceCounts.present.toString()} icon={<Users className="h-5 w-5" />} variant="success" />
              <SummaryCard title="Absent" value={attendanceCounts.absent.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" />
              <SummaryCard title="On leave" value={attendanceCounts.onLeave.toString()} icon={<Calendar className="h-5 w-5" />} variant="info" />
              <SummaryCard title="MC" value={attendanceCounts.mc.toString()} icon={<ClipboardList className="h-5 w-5" />} variant="warning" />
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium mb-4">Leave summary</h3>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Leave Type</TableHead><TableHead>Requested</TableHead><TableHead>Approved</TableHead><TableHead>Rejected</TableHead><TableHead>Total Days</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveData.map((row) => (
                      <TableRow key={row.type}>
                        <TableCell className="font-medium">{row.type}</TableCell>
                        <TableCell>{row.requested}</TableCell>
                        <TableCell>{row.approved}</TableCell>
                        <TableCell>{row.rejected}</TableCell>
                        <TableCell>{row.days}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="finance" className="space-y-4 mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Revenue vs cost vs profit</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={financeData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" />
                      <Line type="monotone" dataKey="cost" stroke="#ef4444" />
                      <Line type="monotone" dataKey="profit" stroke="#3b82f6" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Expenses by category</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseData} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label>
                        {expenseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium mb-4">Expense breakdown</h3>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Category</TableHead><TableHead>Amount</TableHead><TableHead>Count</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseData.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell>S$ {row.amount.toLocaleString()}</TableCell>
                        <TableCell>{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard title="Total incidents" value={safetyData.total.toString()} icon={<HardHat className="h-5 w-5" />} variant="destructive" caption={`${safetyData.momReported} MOM reported`} />
              <SummaryCard title="Training valid" value={trainingData.valid.toString()} icon={<GraduationCap className="h-5 w-5" />} variant="success" caption={`${trainingData.expiringSoon} expiring soon`} />
              <SummaryCard title="Expiring docs" value={documents.filter((d) => d.status === "Expiring Soon").length.toString()} icon={<ClipboardList className="h-5 w-5" />} variant="warning" />
              <SummaryCard title="Expired docs" value={documents.filter((d) => d.status === "Expired").length.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Incidents by severity</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(safetyData.bySeverity).map(([severity, count]) => ({ severity, count }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="severity" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Training compliance</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "Valid", value: trainingData.valid }, { name: "Expiring", value: trainingData.expiringSoon }, { name: "Expired", value: trainingData.expired }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard title="Fleet available" value={fleetData.available.toString()} icon={<Truck className="h-5 w-5" />} variant="success" caption={`${fleetData.total} total vehicles`} />
              <SummaryCard title="In workshop" value={fleetData.inWorkshop.toString()} icon={<HardHat className="h-5 w-5" />} variant="warning" />
              <SummaryCard title="Dorm occupancy" value={`${dormData.reduce((s, d) => s + d.occupied, 0)} / ${dormData.reduce((s, d) => s + d.totalBeds, 0)}`} icon={<BedDouble className="h-5 w-5" />} variant="info" caption="beds occupied" />
              <SummaryCard title="Asset value" value={`S$${assetData.value.toLocaleString()}`} icon={<Package className="h-5 w-5" />} variant="primary" caption={`${assetData.issued} issued`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Recruitment funnel</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recruitmentData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-medium mb-4">Dormitory occupancy</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dormData.map((d, i) => ({ name: dormitories[i]?.name ?? "", occupied: d.occupied, vacant: d.vacant }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="occupied" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="vacant" stackId="a" fill="#e2e8f0" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
