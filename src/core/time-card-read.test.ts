import { describe, expect, it } from "vitest";
import { mergeCardReads, parseCardReads, redateToMonth } from "./time-card-read";
import { nextBatchCardId, readBatchState, writeBatchState } from "./time-card-batch-state";

const fullMonth = (overrides: Record<number, object> = {}) =>
  Array.from({ length: 31 }, (_, i) => i + 1).map(day => day === 25
    ? { day, off: true }
    : { day, start: "0800", end: "2000", normal: 8, ot: 3, ...overrides[day] });

const card = (days: object[], extra: object = {}) => ({ cards: [{ cardIndex: 1, year: 2026, month: 10, siteName: "JB-1183", workerName: "ISLAM MD RAKIBUL", employeeCode: "PC-34", fin: "580R", days, ...extra }] });

describe("whole-card time card reading", () => {
  it("keeps all 30 worked days of a 31-day card with one OFF day", () => {
    const rows = mergeCardReads(parseCardReads(card(fullMonth())), parseCardReads(card(fullMonth())));
    expect(rows).toHaveLength(30);
    expect(rows[0]!.date).toBe("2026-10-01");
    expect(rows.at(-1)!.date).toBe("2026-10-31");
    expect(rows.some(r => r.date === "2026-10-25")).toBe(false);
    expect(rows.every(r => r.siteName === "JB-1183" && r.employeeCode === "PC-34")).toBe(true);
    expect(rows[0]).toMatchObject({ checkIn: "08:00", checkOut: "20:00", normalHours: 8, otHours: 3, confidence: 0.97 });
  });

  it("flags a day the two readers disagree on and keeps the other reading as a suggestion", () => {
    const rows = mergeCardReads(parseCardReads(card(fullMonth())), parseCardReads(card(fullMonth({ 21: { end: "2200", ot: 5 } }))));
    const day21 = rows.find(r => r.date === "2026-10-21")!;
    expect(day21.confidence).toBeLessThan(0.7);
    expect(day21.suggestion).toEqual({ checkIn: "08:00", checkOut: "22:00" });
    expect(day21.normalHours).toBe(8);
    expect(day21.otHours).toBe(3);
  });

  it("flags written hours that do not match the times under the 9h duty rule", () => {
    const rows = mergeCardReads(parseCardReads(card(fullMonth({ 3: { ot: 4 } }))), null);
    expect(rows.find(r => r.date === "2026-10-03")!.confidence).toBeLessThanOrEqual(0.6);
  });

  it("never uses the staff code in Address as the site", () => {
    const [read] = parseCardReads(card(fullMonth(), { siteName: "PC-34" }));
    expect(read!.siteName).toBeUndefined();
  });

  it("moves entries to the confirmed claim month by day of month", () => {
    const moved = redateToMonth([{ date: "2023-09-01" }, { date: "2023-09-30" }], "2026-10");
    expect(moved.map(e => e.date)).toEqual(["2026-10-01", "2026-10-30"]);
  });
});

describe("batch settlement", () => {
  it("opens the next unapproved worker after approval, wrapping around", () => {
    const approved = new Set(["a", "b"]);
    expect(nextBatchCardId(["a", "b", "c", "d"], "b", id => approved.has(id))).toBe("c");
    expect(nextBatchCardId(["a", "b", "c"], "c", id => approved.has(id))).toBeUndefined();
    expect(nextBatchCardId(["a", "b", "c"], "c", id => id === "b")).toBe("a");
  });

  it("restores the session batch after a reload", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    writeBatchState(storage, { localCards: [{ id: "x" }], batchCardIds: ["x", "y"], pendingScans: [], month: "2026-10", projectId: "" });
    expect(readBatchState(storage)).toMatchObject({ batchCardIds: ["x", "y"], month: "2026-10" });
  });
});
