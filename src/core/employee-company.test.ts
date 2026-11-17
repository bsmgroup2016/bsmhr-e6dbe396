import { expect, test } from "bun:test";
import { employeeCompanyId, employeeImportPatch } from "./employee-company";
import type { Company } from "@/lib/types";
const companies = [{ id: "bsm", name: "BSM Engineering", legalName: "BSM Engineering Pte Ltd", code: "BSM" }, { id: "pluto", name: "Pluto Engineering", legalName: "Pluto Engineering Pte Ltd", code: "Pluto" }] as Company[];
test("selected Pluto branch wins over globally selected BSM company", () => {
  expect(employeeCompanyId("Pluto Engineering", companies, "bsm")).toBe("pluto");
  expect(employeeCompanyId("Unassigned", companies, "bsm")).toBe("bsm");
  expect(employeeCompanyId("Unassigned", companies, undefined, [{ id: "p", code: "U", name: "Unassigned", companyId: companies[0].id, active: true }])).toBe(companies[0].id);
});
test("partial import cannot zero daily pay or change status joining date company or trade through defaults", () => {
  expect(employeeImportPatch({ name: "CORRECTED", basicSalary: 0, status: "Active", joinedOn: "2026-11-15", companyId: "bsm", trade: "General Worker", otRate: 0 }, { name: "CORRECTED", basicSalary: "", status: "", joinedOn: "", trade: "", otRate: "0" })).toEqual({ name: "CORRECTED", otRate: 0 });
});