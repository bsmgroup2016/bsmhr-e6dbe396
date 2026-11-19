import { describe, expect, it } from "bun:test";
import {
  ALL,
  claimFilterCompanyOptions,
  claimSalaryStatuses,
  emptyClaimFilter,
  filterClaimSummaries,
  filterSalaryRows,
  isClaimFilterActive,
} from "./claim-filters";
import { NO_COMPANY, type CompanyClaimSummary } from "./company-claim-summary";
import type { Company } from "@/lib/types";

const summary = (
  companyId: string,
  companyName: string,
  projects: { key: string; label: string; clientName: string }[],
  workers: { key: string; code: string; name: string; projectKeys: string[] }[],
): CompanyClaimSummary => ({
  companyId,
  companyName,
  companyCode: companyId,
  sheets: [],
  projects: projects.map((p) => ({ ...p, projectName: p.label, siteName: p.label, workers: 1, normalHours: 8, otHours: 2 })),
  workers: workers.map((w) => ({
    key: w.key,
    code: w.code,
    name: w.name,
    projects: w.projectKeys.map((key) => ({ key, label: projects.find((p) => p.key === key)?.label ?? key, bDays: 1, sundays: 0, normalHours: 8, otHours: 2 })),
  })),
});

const summaries = [
  summary("c-bsm", "BSM Engineering", [{ key: "P1|Site A", label: "Marina Bay — Site A", clientName: "CapitaLand" }, { key: "P2|Site B", label: "Tampines — Site B", clientName: "Sembcorp" }],
    [{ key: "e1", code: "B-101", name: "RAHMAN HASIBUR", projectKeys: ["P1|Site A"] }, { key: "e2", code: "B-102", name: "PRakash KUMAR", projectKeys: ["P2|Site B"] }]),
  summary("c-vrl", "VRL Logistics", [{ key: "P3|Yard", label: "Tuas Yard", clientName: "PSA" }],
    [{ key: "e3", code: "V-58", name: "TARIK ALI", projectKeys: ["P3|Yard"] }]),
  summary(NO_COMPANY, "No company set", [{ key: "UNASSIGNED|", label: "Unassigned project", clientName: "" }],
    [{ key: "e4", code: "", name: "UNKNOWN WORKER", projectKeys: ["UNASSIGNED|"] }]),
];
const companies = [{ id: "c-vrl", code: "VRL", name: "VRL Logistics" }, { id: "c-bsm", code: "BSM", name: "BSM Engineering" }] as Company[];
const filter = (over: Partial<ReturnType<typeof emptyClaimFilter>> = {}) => ({ ...emptyClaimFilter(), ...over });

describe("claim workflow filters", () => {
  it("does nothing when no filter is set", () => {
    expect(filterClaimSummaries(summaries, emptyClaimFilter())).toEqual(summaries);
    expect(isClaimFilterActive(emptyClaimFilter())).toBe(false);
  });

  it("keeps only the selected company", () => {
    expect(filterClaimSummaries(summaries, filter({ company: "c-vrl" })).map((s) => s.companyId)).toEqual(["c-vrl"]);
  });

  it("searching a worker keeps that worker and the project rows they worked", () => {
    const [bsm] = filterClaimSummaries(summaries, filter({ search: "hasibur" }));
    expect(bsm?.workers.map((w) => w.code)).toEqual(["B-101"]);
    expect(bsm?.projects.map((p) => p.label)).toEqual(["Marina Bay — Site A"]);
  });

  it("searching a client keeps only that client's project rows", () => {
    const [bsm] = filterClaimSummaries(summaries, filter({ search: "sembcorp" }));
    expect(bsm?.projects.map((p) => p.label)).toEqual(["Tampines — Site B"]);
    expect(bsm?.workers.map((w) => w.code)).toEqual(["B-102"]);
  });

  it("searching a company name keeps the whole company", () => {
    const kept = filterClaimSummaries(summaries, filter({ search: "vrl log" }));
    expect(kept.map((s) => s.companyId)).toEqual(["c-vrl"]);
    expect(kept[0]?.workers.length).toBe(1);
  });

  it("drops companies with nothing matching and ignores case and extra spaces", () => {
    expect(filterClaimSummaries(summaries, filter({ search: "  PSA  " })).map((s) => s.companyId)).toEqual(["c-vrl"]);
    expect(filterClaimSummaries(summaries, filter({ search: "zzz" }))).toEqual([]);
  });

  it("offers registered companies first, then claim-only and unassigned companies", () => {
    expect(claimFilterCompanyOptions(summaries, companies)).toEqual([
      { value: "c-bsm", label: "BSM Engineering" },
      { value: "c-vrl", label: "VRL Logistics" },
      { value: NO_COMPANY, label: "No company set" },
    ]);
  });

  it("filters salary rows by company, status and search together", () => {
    const rows = [
      { Company: "BSM Engineering", "P-File number": "B-101", Name: "RAHMAN HASIBUR", Status: "Draft" },
      { Company: "BSM Engineering", "P-File number": "B-102", Name: "PRAKASH KUMAR", Status: "Payroll not prepared" },
      { Company: "VRL Logistics", "P-File number": "V-58", Name: "TARIK ALI", Status: "Draft" },
    ];
    expect(filterSalaryRows(rows, filter({ company: "c-bsm" }), "BSM Engineering").map((r) => r["P-File number"])).toEqual(["B-101", "B-102"]);
    expect(filterSalaryRows(rows, filter({ status: "Draft" }), null).map((r) => r["P-File number"])).toEqual(["B-101", "V-58"]);
    expect(filterSalaryRows(rows, filter({ search: "kumar", status: "Payroll not prepared" }), null).map((r) => r["P-File number"])).toEqual(["B-102"]);
    expect(filterSalaryRows(rows, filter({ search: "kumar" }), "VRL Logistics")).toEqual([]);
    expect(claimSalaryStatuses(rows)).toEqual(["Draft", "Payroll not prepared"]);
    expect(ALL).toBe("all");
  });
});
