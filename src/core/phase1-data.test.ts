import { describe, expect, test } from "bun:test";
import { collectAllPages, periodForMonth } from "./data-pagination";
import { TABLE_COLUMNS, UNAVAILABLE_TABLES, assertAvailableTable } from "./data-tables";
import { summarizeHistory } from "./history-summary";
import { SessionDataCache } from "../lib/session-data-cache";
import { pageCollections } from "../lib/page-data";

describe("Phase 1 data loading", () => {
  test("navigation reuses cached values and deduplicates in-flight requests", async () => {
    const cache = new SessionDataCache(); cache.useSession("admin");
    let calls = 0;
    const read = async () => { calls++; return [1, 2]; };
    expect(await Promise.all([cache.get("employees|company-a", read), cache.get("employees|company-a", read)])).toEqual([[1, 2], [1, 2]]);
    await cache.get("employees|company-a", read);
    expect(calls).toBe(1);
  });
  test("company/session cache isolation and successful-write targeted invalidation", async () => {
    const cache = new SessionDataCache(); cache.useSession("first");
    let calls = 0; const read = async () => ++calls;
    expect(await cache.get("attendance|a", read)).toBe(1);
    expect(await cache.get("attendance|b", read)).toBe(2);
    cache.invalidate("attendance|");
    expect(await cache.get("attendance|a", read)).toBe(3);
    cache.useSession("second");
    expect(await cache.get("attendance|a", read)).toBe(4);
  });
  test("attendance export traverses all 4,201 rows beyond the response cap", async () => {
    const offsets: number[] = [];
    const rows = await collectAllPages(async (offset, limit) => { offsets.push(offset); return { rows: Array.from({ length: Math.min(limit, 4201 - offset) }, (_, i) => offset + i), total: 4201 }; });
    expect(rows.length).toBe(4201); expect(new Set(rows).size).toBe(4201); expect(rows.at(-1)).toBe(4200); expect(offsets).toContain(1000);
  });
  test("issuance export traverses all 1,428 rows", async () => {
    const rows = await collectAllPages(async (offset, limit) => ({ rows: Array.from({ length: Math.min(limit, 1428 - offset) }, (_, i) => offset + i), total: 1428 }));
    expect(rows.length).toBe(1428); expect(rows.at(-1)).toBe(1427);
  });
  test("incomplete exports fail rather than silently truncate", async () => {
    await expect(collectAllPages(async () => ({ rows: [], total: 4201 }))).rejects.toThrow("Incomplete data");
  });
  test("all eight known missing tables are rejected before any request", () => {
    const missing = ["dormitory_invoices", "dormitory_inspections", "dormitory_movements", "attendance_events", "notifications", "device_tokens", "manpower_requests", "manpower_request_items"];
    for (const table of missing) { expect(UNAVAILABLE_TABLES.has(table)).toBe(true); expect(() => assertAvailableTable(table)).toThrow("not present"); expect(TABLE_COLUMNS[table]).toBeUndefined(); }
  });
  test("page dependencies do not trigger unrelated history loads", () => {
    expect(pageCollections("/assets")).toEqual(["companies", "assets", "employees", "sites"]);
    expect(pageCollections("/time-management")).toEqual(["companies", "employees", "sites"]);
    expect(pageCollections("/assistant")).toEqual(["companies"]);
  });
  test("explicit projections contain no wildcard", () => {
    for (const columns of Object.values(TABLE_COLUMNS)) expect(columns).not.toContain("*");
    expect(TABLE_COLUMNS.attendance.split(",")).toContain("employee_id");
    expect(TABLE_COLUMNS.asset_issuances.split(",")).toContain("issue_date");
  });
  test("company monthly period covers whole month including leap day", () => {
    expect(periodForMonth("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodForMonth("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(() => periodForMonth("2026-13")).toThrow();
  });
  test("issuance totals and quantities include older records beyond visible pages", () => {
    const rows = Array.from({ length: 1428 }, (_, id) => ({ id, employee_id: "worker", asset_id: "helmet", status: "Issued", quantity: 2, issue_date: "2026-10-01", due_date: "2026-10-31", cost_recovery: 1, acknowledged: false, assets: { unit_cost: 10 } }));
    const summary = summarizeHistory("asset_issuances", rows, 1428, "2026-11-03");
    expect(summary.counts.Issued).toBe(1428); expect(summary.issuedQuantity.helmet).toBe(2856); expect(summary.overdue).toBe(1428); expect(summary.workers[0]?.value).toBe(28560);
  });
  test("monthly attendance preserves half-day and hour calculations", () => {
    const summary = summarizeHistory("attendance", [{ employee_id: "worker", status: "Half Day", hours_worked: 4, overtime_hours: 1 }, { employee_id: "worker", status: "Present", hours_worked: 8, overtime_hours: 2 }], 2, "2026-11-03");
    expect(summary.attendanceWorkers[0]?.presentDays).toBe(1.5); expect(summary.hours).toBe(12); expect(summary.ot).toBe(3); expect(summary.attendanceWorkers[0]?.totalHours).toBe(15);
  });
});