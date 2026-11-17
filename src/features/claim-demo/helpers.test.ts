import { describe, expect, it } from "bun:test";
import { mockWorkers } from "./mock-data";
import { rowMatches, workerTotals, batchTotals } from "./helpers";

describe("claim demo helpers", () => {
  it("full-month worker totals", () => {
    expect(workerTotals(mockWorkers()[0])).toEqual({ days: 30, g: 240, ot: 90, total: 330 });
  });
  it("crossed-out days 1–15 are not counted", () => {
    expect(workerTotals(mockWorkers()[1]).days).toBe(15);
  });
  it("editing OT breaks the out-time check", () => {
    const d = { ...mockWorkers()[0].days[0], ot: 4 };
    expect(rowMatches(d)).toBe(false);
  });
  it("batch staff count", () => { expect(batchTotals(mockWorkers()).staff).toBe(4); });
});
