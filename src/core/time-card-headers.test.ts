import { expect, test } from "bun:test";
import { applyCardHeaders, parseCardHeaders } from "./time-card-headers";
import { groupTimeCardRows } from "./time-card-batch";

test("Labelled JB-1183 Site replaces misread PCB 31 and retains worker code separately", () => {
  const headers = parseCardHeaders({ cards: [{ cardIndex: 1, siteName: "JB-1183", employeeCode: "PC-34", workerName: "ISLAM MD RAKIBUL", year: 2026, month: 10 }] });
  const [row] = applyCardHeaders([{ date: "2020-09-01", siteName: "PCB 31", checkIn: "07:00", checkOut: "20:00" }], headers);
  expect(row?.siteName).toBe("JB-1183");
  expect(row?.employeeCode).toBe("PC-34");
  expect(row?.date).toBe("2026-10-01");
});

test("Four cards keep their own header identities and real different sites", () => {
  const headers = parseCardHeaders({ cards: Array.from({ length: 4 }, (_, i) => ({ cardIndex: i + 1, siteName: i === 3 ? "OTHER SITE" : "JB-1183", employeeCode: `PC-${i + 1}`, workerName: `WORKER ${i + 1}`, year: 2026, month: 10 })) });
  const rows = applyCardHeaders(Array.from({ length: 4 }, (_, i) => ({ cardIndex: i + 1, date: "2020-09-01", siteName: "MISREAD" })), headers);
  expect(groupTimeCardRows(rows)).toHaveLength(4);
  expect(rows[0]?.siteName).toBe("JB-1183");
  expect(rows[3]?.siteName).toBe("OTHER SITE");
  expect(rows[3]?.employeeCode).toBe("PC-4");
});

test("Uncertain Site never falls back to the staff code or another card", () => {
  const headers = parseCardHeaders({ cards: [{ cardIndex: 1, siteName: "PC 34", employeeCode: "PC-34" }] });
  expect(applyCardHeaders([{ cardIndex: 1, date: "2026-10-01", siteName: "PC 34" }], headers)[0]?.siteName).toBeUndefined();
  expect(applyCardHeaders([{ cardIndex: 2, date: "2026-10-01", siteName: "SECOND SITE" }], headers)[0]?.siteName).toBe("SECOND SITE");
});