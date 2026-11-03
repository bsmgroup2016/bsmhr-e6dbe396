import { describe, test, expect } from "bun:test";
import { ARCHIVE_BATCH_SIZE, ARCHIVE_TABLES, DEFAULT_ARCHIVE_SETTINGS, DELETE_ONLY, archiveCutoffs, monthlyArchiveDue, assertArchiveTable, verifyArchivePayload } from "./archive-policy";

describe("Approved archive safeguards", () => {
  const cutoff = archiveCutoffs(new Date("2026-11-03T03:30:00Z"));
  test("job run history retains seven days", () => { expect(cutoff["cron.job_run_details"]).toBe("2026-10-27T03:30:00.000Z"); });
  test("only expired counters older than seven days are proposed", () => { expect(cutoff.api_rate_limits).toBe("2026-10-27T03:30:00.000Z"); });
  test("crawl retention is thirty days", () => { expect(cutoff.ai_crawl_runs).toBe("2026-10-04T03:30:00.000Z"); });
  test("driver locations retain sixty days", () => { expect(cutoff.driver_task_pings).toBe("2026-09-04T03:30:00.000Z"); });
  test("chat retains ninety days", () => { expect(cutoff.live_chats).toBe("2026-08-05T03:30:00.000Z"); });
  test("audit uses twelve calendar months including leap day boundary", () => {
    expect(cutoff.audit_logs).toBe("2025-11-03T03:30:00.000Z");
    expect(archiveCutoffs(new Date("2024-02-29T12:00:00Z")).audit_logs).toBe("2023-02-28T12:00:00.000Z");
  });
  test("every protected business table is rejected", () => { for (const t of ["employees", "companies", "profiles", "user_roles", "payroll_entries", "attendance", "contracts", "claims", "invoices", "documents", "loans", "employee_documents", "storage_objects"]) expect(() => assertArchiveTable(t)).toThrow("protected"); expect(ARCHIVE_TABLES).toHaveLength(6); });
  test("batch size never exceeds approved 250", () => { expect(ARCHIVE_BATCH_SIZE).toBe(250); });
  test("automation and first cleanup start disabled", () => { expect(DEFAULT_ARCHIVE_SETTINGS.monthly).toBe(false); expect(DEFAULT_ARCHIVE_SETTINGS.firstRunConfirmed).toBe(false); });
  test("monthly start is first Sunday at 02:00 Singapore time", () => { expect(monthlyArchiveDue(new Date("2026-10-31T18:05:00Z"))).toBe(true); expect(monthlyArchiveDue(new Date("2026-11-07T18:05:00Z"))).toBe(false); expect(monthlyArchiveDue(new Date("2026-10-31T19:00:00Z"))).toBe(false); });
  test("delete-only tables do not become permanent archives", () => { expect(DELETE_ONLY).toEqual(["cron.job_run_details", "api_rate_limits", "ai_crawl_runs"]); });
  test("read-back rejects changed content even when counts match", async () => {
    const original = JSON.stringify({ rows: [{ id: "1", content: "original" }], messages: [] });
    await expect(verifyArchivePayload(original, JSON.stringify({ rows: [{ id: "1", content: "changed" }], messages: [] }))).rejects.toThrow("verification failed");
    expect(await verifyArchivePayload(original, original)).toEqual({ rows: 1, messages: 0 });
  });
});