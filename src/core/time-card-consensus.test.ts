import { describe, expect, test } from "bun:test";
import { calculatedHours, flaggedFields, mergeTargetedResolution, normalizeDate, normalizeTime, toExistingClaimRows, type FlatTimeCard } from "./time-card-consensus";

const fixture: FlatTimeCard = { card_index: 1, employee_name: "OCR Fixture", employee_code: "B-999", fin: null, site_name: "Fixture Site", date: "2026-11-01", in_time: "07:00", out_time: "20:00", break_minutes: 60, reported_total_hours: 12, confidence: 0.9, normal_hours: 8, ot_hours: 4 };

describe("consensus OCR deterministic rules", () => {
  test("normalizes Singapore dates to YYYY-MM-DD without inventing invalid dates", () => {
    expect(normalizeDate("1/11/2026")).toBe("2026-11-01");
    expect(normalizeDate("2026-02-30")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
  test("normalizes times to 24-hour HH:MM and rejects 24:00", () => {
    expect(normalizeTime("0700")).toBe("07:00");
    expect(normalizeTime("24:00")).toBeNull();
    expect(normalizeTime("07:60")).toBeNull();
  });
  test("calculates 07:00–20:00 less 60 minutes as 12 hours in code", () => {
    expect(calculatedHours(fixture)).toBe(12);
    expect(calculatedHours({ ...fixture, break_minutes: null })).toBeNull();
    expect(calculatedHours({ ...fixture, break_minutes: 30 })).toBe(12.5);
  });
  test("confidence 0.8 passes; below 0.8 flags the critical fields", () => {
    expect(flaggedFields({ ...fixture, confidence: 0.8 }, null)).toEqual([]);
    expect(flaggedFields({ ...fixture, confidence: 0.799 }, null)).toEqual(expect.arrayContaining(["employee_name", "date", "in_time", "out_time", "confidence"]));
  });
  test("missing critical cells are flagged instead of guessed", () => {
    expect(flaggedFields({ ...fixture, employee_name: null, date: null, in_time: null, out_time: null }, null)).toEqual(expect.arrayContaining(["employee_name", "date", "in_time", "out_time"]));
  });
  test("only differences above 0.25 hours trigger math flags", () => {
    expect(flaggedFields({ ...fixture, reported_total_hours: 12.25 }, null)).toEqual([]);
    expect(flaggedFields({ ...fixture, reported_total_hours: 12.251 }, null)).toContain("reported_total_hours");
  });
  test("out time equal to or before in time is flagged, not interpreted as overnight", () => {
    for (const out_time of ["07:00", "06:00"]) {
      expect(calculatedHours({ ...fixture, out_time })).toBeNull();
      expect(flaggedFields({ ...fixture, out_time }, null)).toEqual(expect.arrayContaining(["in_time", "out_time"]));
    }
  });
  test("compares normalized reader cells field-by-field, including confidence", () => {
    expect(flaggedFields(fixture, { ...fixture, date: "1/11/2026", in_time: "0700" })).toEqual([]);
    expect(flaggedFields(fixture, { ...fixture, confidence: 0.8 })).toEqual(["confidence"]);
    expect(flaggedFields(fixture, { ...fixture, employee_name: "Different name" })).toEqual(["employee_name"]);
  });
  test("only flagged values can be merged and original readings are not mutated", () => {
    const resolved = mergeTargetedResolution(fixture, ["out_time"], { out_time: "2100" });
    expect(resolved.out_time).toBe("21:00");
    expect(fixture.out_time).toBe("20:00");
    expect(() => mergeTargetedResolution(fixture, ["out_time"], { out_time: "21:00", employee_name: "Overwrite" })).toThrow();
  });
  test("rechecks math after a targeted correction", () => {
    const corrected = mergeTargetedResolution({ ...fixture, reported_total_hours: 11 }, ["reported_total_hours"], { reported_total_hours: 12 });
    expect(flaggedFields(corrected, null)).toEqual([]);
    expect(calculatedHours(corrected)).toBe(12);
  });
  test("keeps the existing claim identity, written GW/OT and review marker", () => {
    const result = { row: fixture, calculated_hours: 12, flagged_fields: [] as const, tie_breaker_failed: false };
    const [row] = toExistingClaimRows([{ ...result, flagged_fields: [] }]);
    expect(row).toMatchObject({ date: "2026-11-01", workerName: "OCR Fixture", employeeCode: "B-999", siteName: "Fixture Site", normalHours: 8, otHours: 4 });
    expect(toExistingClaimRows([{ ...result, flagged_fields: ["out_time"] }])[0]).toMatchObject({ confidence: 0.45, verifiedBy: "conflict" });
  });
  test("unknown dates and duplicate dates cannot silently disappear from claim output", () => {
    const result = { row: fixture, calculated_hours: 12, flagged_fields: [], tie_breaker_failed: false };
    expect(() => toExistingClaimRows([{ ...result, row: { ...fixture, date: null } }])).toThrow();
    expect(() => toExistingClaimRows([result, result])).toThrow();
  });
});