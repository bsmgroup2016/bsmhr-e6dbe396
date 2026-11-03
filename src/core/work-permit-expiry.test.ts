import { expect, test } from "bun:test";
import { estimatedWorkPermitExpiry, workPermitDatesFromExcel } from "./work-permit-expiry";

test("confirmed 20 December 2024 issue date gives one-year estimate 20 December 2025", () => {
  expect(estimatedWorkPermitExpiry("2024-12-20")).toBe("2025-12-20");
});
test("missing or invalid issue dates never produce an estimate", () => {
  for (const date of [undefined, "", "-", "2024-02-30", "20-12-2024"]) expect(estimatedWorkPermitExpiry(date)).toBeUndefined();
});
test("company Work Permit convention does not apply to S Pass", () => {
  expect(estimatedWorkPermitExpiry("2024-12-20", "S Pass")).toBeUndefined();
});
test("leap-day anniversary uses February 28", () => {
  expect(estimatedWorkPermitExpiry("2024-02-29")).toBe("2025-02-28");
});
test("Excel official expiry remains independent of the one-year estimate", () => {
  const dates = workPermitDatesFromExcel("2024-12-20", "2026-06-15");
  expect(dates.workPermitIssueDate).toBe("2024-12-20");
  expect(dates.workPermitExpiryDate).toBe("2026-06-15");
  expect(estimatedWorkPermitExpiry(dates.workPermitIssueDate)).toBe("2025-12-20");
});
test("Excel issue date alone never fills official expiry", () => {
  expect(workPermitDatesFromExcel("2024-12-20", "").workPermitExpiryDate).toBeUndefined();
});