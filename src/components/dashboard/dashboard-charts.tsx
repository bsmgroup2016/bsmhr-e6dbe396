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
  primary: "oklch(0.53 0.225 277)",
  success: "oklch(0.6 0.15 158)",
  warning: "oklch(0.74 0.15 72)",
  info: "oklch(0.6 0.14 232)",
  destructive: "oklch(0.58 0.22 22)",
  muted: "oklch(0.7 0.02 277)",
};

const PIE_COLORS = [C.primary, C.info, C.success, C.warning, C.destructive, C.muted];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13,
  boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.25)",
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
    <div className={`rounded-2xl border bg-card p-5 shadow-sm ${className ?? ""}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
      </div>
      <div className="h-[260px] w-full">{children}</div>
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
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Wage trend" caption="Gross vs paid · last 6 months" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.wageTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="grossFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.primary} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="paidFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.success} stopOpacity={0.3} />
                <stop offset="100%" stopColor={C.success} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickFormatter={sgdShort} tickLine={false} axisLine={false} fontSize={11} width={44} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => `S$${Math.round(v).toLocaleString("en-SG")}`}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="gross"
              name="Gross wages"
              stroke={C.primary}
              strokeWidth={2.4}
              fill="url(#grossFill)"
            />
            <Area
              type="monotone"
              dataKey="paid"
              name="Net paid"
              stroke={C.success}
              strokeWidth={2.4}
              fill="url(#paidFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Workforce by pass type" caption="Current headcount">
        <ResponsiveContainer width="100%" height="100%">
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
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Attendance trend" caption="Last 7 days" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.attendance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barSize={22}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Present" stackId="a" fill={C.success} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Leave" stackId="a" fill={C.info} />
            <Bar dataKey="Absent" stackId="a" fill={C.warning} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Projects by status" caption="All projects">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.projectMix}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            barSize={18}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={78}
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