import { expect, test } from "bun:test";
import { preparePermitImport, permitSchema, permitStatus } from "./permit-register";
import type { Employee } from "@/lib/types";
const workers = [{ id: "one", employeeCode: "B-001", fin: "G123", workPermitIssueDate: "2026-01-01", workPermitExpiryDate: "2026-12-31" }, { id: "two", employeeCode: "V-001", fin: "G456" }] as Employee[];
test("bulk update matches existing P-File or FIN and imports only supplied fields", () => {
  const { employee, patch } = preparePermitImport({ "p-file number": "b001", "work permit number": "WP001" }, workers);
  expect(employee.id).toBe("one"); expect(patch).toEqual({ workPermitNumber: "WP001" });
  expect(preparePermitImport({ fin: "g123", "work permit expiry date": "2027-01-01" }, workers).employee.id).toBe("one");
});
test("rejects unknown and conflicting worker identities", () => {
  expect(() => preparePermitImport({ "p-file number": "UNKNOWN" }, workers)).toThrow("Worker not found");
  expect(() => preparePermitImport({ "p-file number": "B001", fin: "G456" }, workers)).toThrow("different workers");
});
test("validates official dates without inferring or replacing blank dates", () => {
  expect(() => permitSchema.parse({ workPermitExpiryDate: "2026-02-30" })).toThrow();
  expect(() => preparePermitImport({ fin: "G123", "work permit expiry date": "2025-01-01" }, workers)).toThrow("precede");
  expect(permitSchema.parse({ workPermitIssueDate: "2026-01-01" }).workPermitExpiryDate).toBeUndefined();
});
test("shows current permits including long-valid and missing-expiry records", () => {
  expect(permitStatus(workers[0], "2026-11-20")).toBe("Due within 90 days");
  expect(permitStatus(workers[0], "2026-01-01")).toBe("Valid");
  expect(permitStatus(workers[1], "2026-11-20")).toBe("Missing expiry");
});