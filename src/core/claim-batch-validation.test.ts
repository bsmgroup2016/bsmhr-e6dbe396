import { expect, test } from "bun:test";
import { claimBatchProblem } from "./claim-batch-validation";
import type { TimeCard } from "@/lib/types";
const card = (id: string, worker: string, day: string): TimeCard => ({ id, employeeId: worker, status: "Verified", periodStart: "2026-11-01", periodEnd: "2026-11-30", entries: [{ date: day, normalHours: 8, otHours: 3.5, reviewApproved: true }] });
test("50 distinct workers sharing Sunday dates remain eligible", () => {
  expect(claimBatchProblem(Array.from({ length: 50 }, (_, i) => card(String(i), `P-${i}`, "2026-11-15")), "2026-11")).toBeNull();
});
test("the same worker date in two cards cannot double-count", () => {
  expect(claimBatchProblem([card("a", "P-1", "2026-11-15"), card("b", "P-1", "2026-11-15")], "2026-11")).toContain("Duplicate worker/date");
});
test("impossible month-end dates cannot disappear from generation", () => {
  expect(claimBatchProblem([card("a", "P-1", "2026-11-31")], "2026-11")).toContain("no dates will be dropped");
});
test("a worked date with incomplete times cannot silently become zero hours", () => {
  const c = card("a", "P-1", "2026-11-15"); c.entries = [{ date: "2026-11-15", checkIn: "08:00" }];
  expect(claimBatchProblem([c], "2026-11")).toContain("Incomplete hours");
});