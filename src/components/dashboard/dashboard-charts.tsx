import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const C = {
  primary: "var(--chart-1)",
  success: "var(--success)",
  warning: "var(--warning)",
  info: "var(--info)",
  destructive: "var(--destructive)",
  muted: "var(--muted-foreground)",
};

const PIE_COLORS = ["var(--dashboard-teal)", "var(--dashboard-blue)", "var(--dashboard-coral)", "var(--dashboard-rose)", C.success, C.warning];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13,
  boxShadow: "var(--shadow-card)",
};

function ChartCard({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-lg border border-border bg-card p-5 shadow-card ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {caption ? <span className="text-sm text-muted-foreground">{caption}</span> : null}
      </div>
      <div className="h-[240px] w-full">{children}</div>
    </div>
  );
}

export interface DashboardChartData {
  wageTrend: { month: string; gross: number; paid: number }[];
  attendance: { day: string; Present: number; Absent: number; Leave: number }[];
  passMix: { name: string; value: number }[];
  projectMix: { name: string; value: number }[];
}

export function DashboardCharts({ data }: { data: DashboardChartData }) {
  const sgdShort = (n: number) =>
    n >= 1000 ? `${Math.round(n / 100) / 10}k` : `${Math.round(n)}`;

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Attendance trend" caption="Last 7 days" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.attendance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={44} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="Present" fill={C.success} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Leave" fill={C.info} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Absent" fill={C.destructive} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Attendance overview" caption="Recorded · last 7 days">
        {data.attendance.some((d) => d.Present + d.Leave + d.Absent > 0) ? (
          <ResponsiveContainer width="100%" height="100%"><PieChart>
            <Pie data={[{name:"Present",value:data.attendance.reduce((n,d)=>n+d.Present,0)},{name:"Leave",value:data.attendance.reduce((n,d)=>n+d.Leave,0)},{name:"Absent",value:data.attendance.reduce((n,d)=>n+d.Absent,0)}]} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={5} cornerRadius={5} stroke="var(--card)">
              <Cell fill="var(--success)" /><Cell fill="var(--dashboard-coral)" /><Cell fill="var(--destructive)" />
            </Pie><Tooltip contentStyle={tooltipStyle}/><Legend iconType="circle" wrapperStyle={{fontSize:12}} />
          </PieChart></ResponsiveContainer>
        ) : <div className="flex h-full flex-col items-center justify-center gap-3"><div className="size-28 rounded-full border-[18px] border-muted"/><p className="text-sm text-muted-foreground">No attendance recorded in the last 7 days</p></div>}
      </ChartCard>
      <ChartCard title="Workforce by pass type" caption="Current headcount">
        {data.passMix.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No workforce records available</div> : <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.passMix}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={3}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.passMix.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>}
      </ChartCard>

      <ChartCard title="Payroll trend" caption="Last 6 months" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.wageTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs><linearGradient id="dashboard-wages" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--dashboard-blue)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--dashboard-blue)" stopOpacity={0.01} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickFormatter={sgdShort} tickLine={false} axisLine={false} fontSize={12} width={48} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${Math.round(v).toLocaleString("en-SG")}`} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="gross" name="Gross wages" stroke="var(--dashboard-blue)" fill="url(#dashboard-wages)" strokeWidth={3} />
            <Area type="monotone" dataKey="paid" name="Net paid" stroke="var(--dashboard-teal)" fill="transparent" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Projects by status" caption="All projects" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.projectMix}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            barSize={18}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={84}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
            <Bar dataKey="value" name="Projects" radius={[0, 6, 6, 0]}>
              {data.projectMix.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}