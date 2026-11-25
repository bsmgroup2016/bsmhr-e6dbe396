import { describe, expect, it } from "bun:test";
import { claimSalaryReviewSnapshot, reviewBatches, runClaimSalaryReview } from "./claim-salary-review";
import { claimSalaryRows } from "./claim-workflow";
import type { CompanyClaimSummary } from "./company-claim-summary";
import type { Employee, PayrollEntry } from "@/lib/types";

const summary = (): CompanyClaimSummary => ({ companyId: "BSM", companyName: "BSM", companyCode: "BSM", sheets: [], projects: [], workers: [{ key: "e1", code: "B-1", name: "Worker", projects: [{ key: "s1", label: "Site 1", bDays: 2, sundays: 1, normalHours: 24, otHours: 5 }] }] });
const employees = [{ id: "e1", companyId: "BSM", employeeCode: "B-1" }] as Employee[];
const payroll = [{ id: "p1", employeeId: "e1", month: "2026-10", basicSalary: 2600, overtimePay: 50, deductions: 200, netPay: 2450, status: "Draft" }] as PayrollEntry[];

describe("claim and salary advisory recheck", () => {
  it("detaches claim input so review cannot modify approved hours or source data", () => {
    const original = summary();
    const before = JSON.stringify(original);
    const snapshot = claimSalaryReviewSnapshot("2026-10", [original], [], "claim");
    const record = snapshot.records[0];
    if (!record) throw new Error("Missing review input");
    const data = record.data as { projects: { normalHours: number }[] };
    const project = data.projects[0];
    if (!project) throw new Error("Missing project review input");
    project.normalHours = 999;
    record.worker = "Changed";
    expect(JSON.stringify(original)).toBe(before);
    expect(original.workers[0]?.projects[0]?.normalHours).toBe(24);
  });
  it("preserves saved salary and export row fields, never replacing salary with claim-hour pay", () => {
    const rows = claimSalaryRows([summary()], employees, payroll, "2026-10");
    const before = JSON.stringify(rows);
    const snapshot = claimSalaryReviewSnapshot("2026-10", [summary()], rows, "salary");
    expect(snapshot.records[0]?.data).toEqual(rows[0]);
    const record = snapshot.records[0];
    if (!record) throw new Error("Missing review input");
    (record.data as Record<string, unknown>)["Net pay (SGD)"] = 999;
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0]?.["Net pay (SGD)"]).toBe(2450);
    expect(Object.keys(rows[0] ?? {})).not.toContain("AI review");
  });
  it("flags unresolved payroll without creating salary values", () => {
    const rows = claimSalaryRows([summary()], employees, [], "2026-10");
    expect(claimSalaryReviewSnapshot("2026-10", [summary()], rows, "salary").warnings).toEqual(["BSM · B-1: Payroll not prepared."]);
    expect(rows[0]?.["Net pay (SGD)"]).toBeNull();
  });
  it("flags duplicate identities, but does not treat Sunday or partial-month work as an error", () => {
    const original = summary();
    expect(claimSalaryReviewSnapshot("2026-10", [original], [], "claim").warnings).toEqual([]);
    original.workers.push(...original.workers);
    expect(claimSalaryReviewSnapshot("2026-10", [original], [], "claim").warnings).toEqual(["BSM · B-1: P-File number appears more than once in this report."]);
  });
  it("reviews only the supplied company/worker scope, without hidden source sheets", () => {
    const snapshot = claimSalaryReviewSnapshot("2026-10", [summary()], [], "claim");
    expect(snapshot.records.map(row => row.pFile)).toEqual(["B-1"]);
    expect(JSON.stringify(snapshot)).not.toContain("sheets");
  });
  it("covers all 81 visible records in bounded batches without truncation", async () => {
    const snapshot = claimSalaryReviewSnapshot("2026-10", [summary()], [], "claim");
    snapshot.records = Array.from({ length: 81 }, (_, index) => ({ company: "BSM", worker: `Worker ${index}`, pFile: `B-${index}`, data: {} }));
    expect(reviewBatches(snapshot).map(batch => batch.records.length)).toEqual([40, 40, 1]);
    const reviewed: string[] = [];
    expect(await runClaimSalaryReview(snapshot, async batch => { reviewed.push(...batch.records.map(record => record.pFile)); return `Part ${batch.part}`; })).toEqual(["Part 1", "Part 2", "Part 3"]);
    expect(new Set(reviewed).size).toBe(81);
    expect(reviewed).toContain("B-80");
  });
  it("does not represent empty or failed responses as a successful recheck", async () => {
    const snapshot = claimSalaryReviewSnapshot("2026-10", [summary()], [], "claim");
    await expect(runClaimSalaryReview(snapshot, async () => "")).rejects.toThrow("empty review");
    await expect(runClaimSalaryReview(snapshot, async () => { throw new Error("Provider offline"); })).rejects.toThrow("Provider offline");
  });
});