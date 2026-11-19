import type { Invoice } from "@/lib/billing-types";

export type AgingBucket = "Current" | "1-30" | "31-60" | "61-90" | "90+";
export const AGING_BUCKETS: AgingBucket[] = ["Current", "1-30", "31-60", "61-90", "90+"];

const DAY = 86_400_000;
const sgDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00+08:00`).getTime();

export function invoiceBalance(inv: Invoice): number {
  if (inv.status === "Cancelled" || inv.status === "Draft") return 0;
  return Math.max(0, Math.round((inv.total - inv.amountPaid) * 100) / 100);
}

/** Days past due (0 when not yet due). */
export function daysOverdue(inv: Invoice, todayIso: string): number {
  if (!inv.dueDate) return 0;
  return Math.max(0, Math.floor((sgDay(todayIso) - sgDay(inv.dueDate)) / DAY));
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export interface ReceivableSummary {
  billed: number;
  collected: number;
  outstanding: number;
  overdue: number;
  openCount: number;
  overdueCount: number;
  buckets: Record<AgingBucket, number>;
  avgDaysToPay: number | null;
}

export function summarizeReceivables(
  invoices: Invoice[],
  todayIso: string,
  paidOn: Record<string, string | undefined> = {},
): ReceivableSummary {
  const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  let billed = 0, collected = 0, outstanding = 0, overdue = 0, openCount = 0, overdueCount = 0;
  const payDays: number[] = [];
  for (const inv of invoices) {
    if (inv.status === "Cancelled" || inv.status === "Draft") continue;
    billed += inv.total;
    collected += inv.amountPaid;
    const bal = invoiceBalance(inv);
    if (bal > 0) {
      openCount++;
      outstanding += bal;
      const d = daysOverdue(inv, todayIso);
      buckets[agingBucket(d)] += bal;
      if (d > 0) { overdue += bal; overdueCount++; }
    } else {
      const p = paidOn[inv.id];
      if (p) payDays.push(Math.max(0, Math.round((sgDay(p) - sgDay(inv.issueDate)) / DAY)));
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  for (const b of AGING_BUCKETS) buckets[b] = r(buckets[b]);
  return {
    billed: r(billed), collected: r(collected), outstanding: r(outstanding), overdue: r(overdue),
    openCount, overdueCount, buckets,
    avgDaysToPay: payDays.length ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length) : null,
  };
}
