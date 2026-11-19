import { describe, expect, it } from "bun:test";
import { payslipFigures } from "./payslip-calc";

// Feb 2026: the 1st, 8th, 15th and 22nd are Sundays.
const days = (spec: Record<number, [number, number]>) =>
  Array.from({ length: 28 }, (_, i) => i + 1).map((day) => ({ day, g: spec[day]?.[0] ?? null, ot: spec[day]?.[1] ?? null, worked: !!spec[day] }));

describe("payslip figures", () => {
  it("pays weekdays at the daily rate, Sundays at 1.5x and OT at rate/8 x 1.5 (salary sheet rules)", () => {
    const f = payslipFigures(days({ 1: [8, 2], 2: [8, 3], 3: [8, 0] }), 20, 2026, 2);
    expect(f).toMatchObject({ workDays: 2, restDays: 1, otHours: 5, hourlyOtRate: 3.75, basicPay: 40, restDayPay: 30, otPay: 18.75, netPay: 88.75, otOverLimit: 0 });
  });

  it("over a full month counts only weekdays as basic days and keeps the $20 → $3.75 OT rate", () => {
    const spec: Record<number, [number, number]> = {};
    let n = 0;
    for (let d = 1; d <= 28 && n < 27; d++) if (new Date(Date.UTC(2026, 1, d)).getUTCDay() !== 0) { spec[d] = [8, n < 25 ? 4 : 0.5]; n++; }
    const f = payslipFigures(days(spec), 20, 2026, 2);
    expect(f.workDays).toBe(24); // only 24 weekdays in Feb 2026
    expect(f.hourlyOtRate).toBe(3.75);
    expect(f.otPay).toBe(f.otHours * 3.75);
  });

  it("flags OT above the 72-hour monthly limit instead of hiding it", () => {
    const spec: Record<number, [number, number]> = {};
    for (let d = 2; d <= 21; d++) spec[d] = [8, 4]; // 20 days x 4 = 80 OT hrs
    const f = payslipFigures(days(spec), 20, 2026, 2);
    expect(f.otHours).toBe(80);
    expect(f.otOverLimit).toBe(8);
    expect(f.otPay).toBe(300);
  });

  it("uses the exact OT rate like the salary sheet ($26 → 4.875/hr, 22 hrs → $107.25)", () => {
    const spec: Record<number, [number, number]> = {};
    for (let d = 2, n = 0; d <= 28 && n < 22; d++) if (new Date(Date.UTC(2026, 1, d)).getUTCDay() !== 0) { spec[d] = [8, 1]; n++; }
    const f = payslipFigures(days(spec), 26, 2026, 2);
    expect(f.hourlyOtRate).toBe(4.875);
    expect(f.otHours).toBe(22);
    expect(f.otPay).toBe(107.25);
  });

  it("missing daily rate pays zero rather than guessing", () => {
    expect(payslipFigures(days({ 2: [8, 1] }), Number.NaN, 2026, 2).netPay).toBe(0);
  });
});
