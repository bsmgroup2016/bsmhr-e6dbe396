import { describe, expect, test } from "bun:test";
import { agingBucket, daysOverdue, summarizeReceivables } from "./client-receivables";
import type { Invoice } from "@/lib/billing-types";

const inv = (o: Partial<Invoice>): Invoice => ({
  id: "x", invoiceNo: "I", clientId: "c", issueDate: "2026-01-01", dueDate: "2026-01-31",
  periodStart: "", periodEnd: "", subtotal: 0, gstRate: 9, gstAmount: 0, total: 100, amountPaid: 0,
  status: "Sent", lines: [], createdAt: "", updatedAt: "", ...o,
});

describe("client receivables", () => {
  test("aging buckets by days past due", () => {
    expect(agingBucket(0)).toBe("Current");
    expect(agingBucket(30)).toBe("1-30");
    expect(agingBucket(31)).toBe("31-60");
    expect(agingBucket(91)).toBe("90+");
  });
  test("days overdue counts from due date", () => {
    expect(daysOverdue(inv({ dueDate: "2026-01-31" }), "2026-03-02")).toBe(30);
    expect(daysOverdue(inv({ dueDate: "2026-03-10" }), "2026-03-02")).toBe(0);
  });
  test("drafts and cancelled invoices are excluded; partial payments reduce balance", () => {
    const s = summarizeReceivables([
      inv({ id: "a", total: 100, amountPaid: 40, status: "Partially Paid", dueDate: "2026-01-01" }),
      inv({ id: "b", total: 500, status: "Draft" }),
      inv({ id: "c", total: 200, status: "Cancelled" }),
      inv({ id: "d", total: 50, dueDate: "2026-12-31" }),
    ], "2026-02-15");
    expect(s.billed).toBe(150);
    expect(s.outstanding).toBe(110);
    expect(s.overdue).toBe(60);
    expect(s.buckets["31-60"]).toBe(60);
    expect(s.buckets.Current).toBe(50);
  });
});
