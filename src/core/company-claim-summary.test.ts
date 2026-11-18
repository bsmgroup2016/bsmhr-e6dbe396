import { describe, expect, it } from "bun:test";
import ExcelJS from "exceljs";
import { companyClaimSummaries, NO_COMPANY } from "./company-claim-summary";
import { createCompanyClaimWorkbook } from "@/lib/company-claim-export";
import type { ClaimSheet, Company, Project, Site } from "@/lib/types";

const companies = [{ id: "bsm", code: "BSM", name: "BSM Engineering" }, { id: "vrl", code: "VRL", name: "VRL" }] as Company[];
const projects = [{ id: "p1", name: "ITTC C-190", clientId: "c1" }, { id: "p2", name: "VIVO CITY", clientId: "c2" }] as Project[];
const sites = [{ id: "s1", projectId: "p1", name: "ITTC C-190" }, { id: "s2", projectId: "p2", name: "VIVO CITY" }] as Site[];
const clients = [{ id: "c1", name: "GS ENGINEERING" }, { id: "c2", name: "CS INSULATION" }] as never[];

const claim = (id: string, companyId: string | undefined, code: string, rows: [date: string, projectId: string, g: number, ot: number][]): ClaimSheet => ({
  id, reference: id, companyId, employeeId: `emp-${code}`, periodStart: "2026-02-01", periodEnd: "2026-02-28", totalDays: rows.length, totalNormalHours: 0, totalOtHours: 0,
  snapshot: rows.map(([date, projectId, g, ot]) => ({ date, projectId, siteId: projectId.replace("p", "s"), site: sites.find((s) => s.projectId === projectId)!.name, employeeCode: code, workerName: `Worker ${code}`, normalHours: g, otHours: ot, status: "Present" })),
});

const claims = [
  // 2026-02-01 is a Sunday.
  claim("a", "bsm", "B-159", [["2026-02-01", "p1", 8, 2], ["2026-02-02", "p1", 8, 3], ["2026-02-03", "p2", 8, 1]]),
  claim("b", "bsm", "BS-32", [["2026-02-02", "p1", 8, 0]]),
  claim("c", "vrl", "V-79", [["2026-02-02", "p2", 8, 4]]),
  claim("d", undefined, "X-1", [["2026-02-02", "p2", 8, 0]]),
  claim("e", "bsm", "B-159", [["2026-03-02", "p1", 8, 9]]), // other month: ignored
];
const lookups = { projects, sites, clients };

describe("company claim summary", () => {
  it("splits by company, keeps project/site per worker and counts Sundays separately", () => {
    const out = companyClaimSummaries(claims, [], companies, "2026-02", lookups);
    expect(out.map((s) => s.companyId)).toEqual(["bsm", "vrl", NO_COMPANY]);
    const bsm = out[0]!;
    expect(bsm.projects.map((p) => [p.label, p.clientName, p.workers, p.normalHours, p.otHours])).toEqual([
      ["ITTC C-190", "GS ENGINEERING", 2, 24, 5],
      ["VIVO CITY", "CS INSULATION", 1, 8, 1],
    ]);
    const rashel = bsm.workers.find((w) => w.code === "B-159")!;
    expect(rashel.projects).toEqual([
      { key: "p1|ITTC C-190", label: "ITTC C-190", bDays: 1, sundays: 1, normalHours: 16, otHours: 5 },
      { key: "p2|VIVO CITY", label: "VIVO CITY", bDays: 1, sundays: 0, normalHours: 8, otHours: 1 },
    ]);
  });

  it("writes one company workbook: combined summary first, then each project sheet", async () => {
    const tpl = new ExcelJS.Workbook(); const page = tpl.addWorksheet("TEMPLATE");
    page.getCell(4, 2).value = "STAFF CODE"; page.getCell(4, 3).value = "NAME"; page.getCell(4, 4).value = "CATEGORY";
    for (let d = 1; d <= 28; d++) page.getCell(4, 4 + d).value = d;
    page.getCell(5, 4).value = "G-HRS"; page.getCell(6, 4).value = "OT HOURS";
    const templateBuffer = (await tpl.xlsx.writeBuffer()) as ArrayBuffer;

    const bsm = companyClaimSummaries(claims, [], companies, "2026-02", lookups)[0]!;
    const book = await createCompanyClaimWorkbook(bsm, [], companies, "2026-02", { ...lookups, templateBuffer });
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(await book.xlsx.writeBuffer());

    expect(back.worksheets.map((s) => s.name)).toEqual(["BSM COMBINED", "ITTC C-190", "VIVO CITY"]);
    const ws = back.worksheets[0]!;
    expect(String(ws.getCell("A1").value)).toBe("BSM ENGINEERING WORKER PROJECT WISE SUMMARY - FEB 2026");
    // Two project slots (B-159 worked on two projects) → totals start at column L.
    expect(ws.getCell("C4").value).toBe("WORKER B-159");
    expect([ws.getCell("D4").value, ws.getCell("E4").value, ws.getCell("F4").value, ws.getCell("G4").value]).toEqual(["ITTC C-190", 1, 1, 5]);
    expect(ws.getCell("H4").value).toBe("VIVO CITY");
    expect((ws.getCell("L4").value as { formula: string }).formula).toBe("O4*8");
    expect((ws.getCell("M4").value as { formula: string }).formula).toBe("SUM(G4,K4)");
    expect((ws.getCell("P4").value as { formula: string }).formula).toBe("SUM(E4,I4)");
  });
});
