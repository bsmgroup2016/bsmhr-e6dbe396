import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  FileText,
  TrendingUp,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import type { Client, ClientContract, Invoice } from "@/lib/types";

const money = (n: number) =>
  `$${Math.round(n).toLocaleString("en-SG")}`;

const moneyFull = (n: number) =>
  `$${n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

const CHART = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Panel({
  title,
  caption,
  action,
  children,
  className = "",
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-card/70 p-4 shadow-sm backdrop-blur-sm ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {caption && (
            <p className="text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-medium text-foreground">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function BillingOverview({
  invoices,
  clients,
  contracts,
  onOpenInvoice,
}: {
  invoices: Invoice[];
  clients: Client[];
  contracts: ClientContract[];
  onOpenInvoice?: (inv: Invoice) => void;
}) {
  const live = useMemo(
    () => invoices.filter((i) => i.status !== "Cancelled"),
    [invoices],
  );

  const clientName = (id: string) =>
    clients.find((c) => c.id === id)?.name ?? "—";

  /* ---------- cashflow trend: last 6 months ---------- */
  const trend = useMemo(() => {
    const months: { key: string; label: string; billed: number; collected: number }[] = [];
    const now = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleString("en-SG", { month: "short" }),
        billed: 0,
        collected: 0,
      });
    }
    for (const inv of live) {
      const m = months.find((x) => x.key === (inv.issueDate ?? "").slice(0, 7));
      if (!m) continue;
      m.billed += inv.total;
      m.collected += inv.amountPaid;
    }
    return months;
  }, [live]);

  /* ---------- AR aging ---------- */
  const aging = useMemo(() => {
    const buckets = [
      { label: "Current", amount: 0, count: 0 },
      { label: "1–30 d", amount: 0, count: 0 },
      { label: "31–60 d", amount: 0, count: 0 },
      { label: "60+ d", amount: 0, count: 0 },
    ];
    const t = today();
    for (const inv of live) {
      const bal = inv.total - inv.amountPaid;
      if (bal <= 0.01) continue;
      const late = inv.dueDate ? daysBetween(inv.dueDate, t) : 0;
      const b =
        late <= 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : buckets[3];
      b.amount += bal;
      b.count += 1;
    }
    return buckets;
  }, [live]);

  const totalOutstanding = aging.reduce((s, b) => s + b.amount, 0);
  const overdueAmount = aging.slice(1).reduce((s, b) => s + b.amount, 0);

  /* ---------- status split ---------- */
  const statusSplit = useMemo(() => {
    const order = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue"];
    const map = new Map<string, number>();
    const t = today();
    for (const inv of live) {
      const isOverdue =
        inv.status !== "Paid" && inv.dueDate && inv.dueDate < t;
      const key = isOverdue ? "Overdue" : inv.status;
      map.set(key, (map.get(key) ?? 0) + inv.total);
    }
    return order
      .filter((k) => (map.get(k) ?? 0) > 0)
      .map((k) => ({ name: k, value: map.get(k) ?? 0 }));
  }, [live]);

  /* ---------- top clients ---------- */
  const topClients = useMemo(() => {
    const map = new Map<string, { billed: number; balance: number }>();
    for (const inv of live) {
      const e = map.get(inv.clientId) ?? { billed: 0, balance: 0 };
      e.billed += inv.total;
      e.balance += inv.total - inv.amountPaid;
      map.set(inv.clientId, e);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, name: clientName(id), ...v }))
      .sort((a, b) => b.billed - a.billed)
      .slice(0, 6);
  }, [live, clients]);

  const maxBilled = topClients[0]?.billed ?? 1;

  /* ---------- attention list ---------- */
  const attention = useMemo(() => {
    const t = today();
    return live
      .filter((i) => i.total - i.amountPaid > 0.01)
      .map((i) => ({ inv: i, late: i.dueDate ? daysBetween(i.dueDate, t) : 0 }))
      .sort((a, b) => b.late - a.late)
      .slice(0, 6);
  }, [live]);

  /* ---------- upcoming contract billing ---------- */
  const upcoming = useMemo(
    () =>
      contracts
        .filter((c) => c.status === "Active" && c.nextInvoiceOn)
        .sort((a, b) => (a.nextInvoiceOn ?? "").localeCompare(b.nextInvoiceOn ?? ""))
        .slice(0, 5),
    [contracts],
  );

  const billedTotal = live.reduce((s, i) => s + i.total, 0);
  const collected = live.reduce((s, i) => s + i.amountPaid, 0);
  const collectRate = billedTotal > 0 ? (collected / billedTotal) * 100 : 0;
  const avgDaysToPay = useMemo(() => {
    const paid = live.filter((i) => i.status === "Paid" && i.issueDate && i.updatedAt);
    if (paid.length === 0) return null;
    const sum = paid.reduce(
      (s, i) => s + Math.max(0, daysBetween(i.issueDate, i.updatedAt.slice(0, 10))),
      0,
    );
    return Math.round(sum / paid.length);
  }, [live]);

  return (
    <div className="space-y-4">
      {/* headline strip */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-gradient-to-br from-primary/15 via-card/70 to-card/70 p-5 shadow-sm backdrop-blur-sm lg:col-span-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="h-4 w-4" /> Total receivables
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {moneyFull(totalOutstanding)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            of which{" "}
            <span className="font-medium text-destructive">{money(overdueAmount)}</span>{" "}
            overdue
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Collection rate</span>
              <span className="font-medium text-foreground">
                {collectRate.toFixed(0)}%
              </span>
            </div>
            <Progress value={collectRate} className="h-2" />
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span>Avg. days to pay</span>
              <span className="font-medium text-foreground">
                {avgDaysToPay === null ? "—" : `${avgDaysToPay} d`}
              </span>
            </div>
          </div>
        </div>

        <Panel
          title="Cashflow — billed vs collected"
          caption="Last 6 months"
          className="lg:col-span-2"
          action={
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
              <TrendingUp className="h-3.5 w-3.5" />
              {money(trend[trend.length - 1]?.billed ?? 0)} this month
            </span>
          }
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip content={<ChartTip />} />
                <Area
                  type="monotone"
                  dataKey="billed"
                  name="Billed"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#gBilled)"
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Collected"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  fill="url(#gCollected)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* aging + status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Receivables ageing" caption="By due date" className="lg:col-span-2">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                <Bar dataKey="amount" name="Outstanding" radius={[6, 6, 0, 0]}>
                  {aging.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        idx === 0
                          ? "var(--chart-2)"
                          : idx === 1
                            ? "var(--chart-4)"
                            : idx === 2
                              ? "var(--warning)"
                              : "var(--destructive)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {aging.map((b) => (
              <div key={b.label} className="rounded-lg border bg-background/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">{b.label}</div>
                <div className="text-sm font-semibold text-foreground">{money(b.amount)}</div>
                <div className="text-xs text-muted-foreground">{b.count} invoice</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Invoice status" caption="Split by value">
          {statusSplit.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No data yet</p>
          ) : (
            <>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusSplit}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={44}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {statusSplit.map((_, i) => (
                        <Cell key={i} fill={CHART[i % CHART.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {statusSplit.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: CHART[i % CHART.length] }}
                      />
                      {s.name}
                    </span>
                    <span className="font-medium text-foreground">{money(s.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      {/* clients + attention + upcoming */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Top clients" caption="Billed value">
          {topClients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
          ) : (
            <ul className="space-y-3">
              {topClients.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2 font-medium text-foreground">{c.name}</span>
                    <span className="shrink-0 text-muted-foreground">{money(c.billed)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(c.billed / maxBilled) * 100}%` }}
                    />
                  </div>
                  {c.balance > 0.01 && (
                    <div className="mt-1 text-xs text-warning">
                      {money(c.balance)} outstanding
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Needs attention" caption="Most overdue invoices">
          {attention.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              All invoices are up to date
            </p>
          ) : (
            <ul className="divide-y">
              {attention.map(({ inv, late }) => (
                <li
                  key={inv.id}
                  className="flex cursor-pointer items-center justify-between gap-2 py-2 transition-colors hover:bg-muted/40"
                  onClick={() => onOpenInvoice?.(inv)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {inv.invoiceNo}
                      {late > 0 && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {clientName(inv.clientId)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {money(inv.total - inv.amountPaid)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {late > 0 ? `${late} d overdue` : `due ${inv.dueDate}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming contract billing" caption="Auto-invoice schedule">
          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No schedule
            </p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {c.contractNo}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {clientName(c.clientId)} · {c.billingCycle}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge variant="info" label={c.nextInvoiceOn ?? "—"} />
                    <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {c.billingSource}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Change the schedule from the Contracts tab
          </div>
        </Panel>
      </div>
    </div>
  );
}
