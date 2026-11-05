import { describe, expect, it } from "bun:test";
import { isLowConfidence, lowestConfidenceFirst } from "./confidence-order";

describe("confidence review order", () => {
  it("puts the least certain days first, then by date", () => {
    const rows = [
      { date: "2026-10-01", confidence: 0.97 },
      { date: "2026-10-03", confidence: 0.4 },
      { date: "2026-10-02", confidence: 0.45 },
      { date: "2026-10-04", confidence: 0.4 },
    ];
    expect(lowestConfidenceFirst(rows).map((r) => r.date)).toEqual(["2026-10-03", "2026-10-04", "2026-10-02", "2026-10-01"]);
  });
  it("flags below 70% only", () => {
    expect(isLowConfidence(0.69)).toBe(true);
    expect(isLowConfidence(0.7)).toBe(false);
    expect(isLowConfidence(undefined)).toBe(false);
  });
});
