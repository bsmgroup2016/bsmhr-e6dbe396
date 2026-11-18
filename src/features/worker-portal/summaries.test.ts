import { describe, expect, it } from "bun:test";
import { leaveSummary, payslipsInRange, rangeAttendance, weekRange } from "./summaries";

const pay = (month: string, netPay: number) => ({ id: month, month, netPay, basicSalary: netPay, overtimePay: 0, allowances: 0, deductions: 0, cpfEmployee: 0 }) as never;
const leave = (startDate: string, status: string, days = 1) => ({ id: startDate + status, startDate, status, days }) as never;
const att = (date: string, status: string, hoursWorked = 8, overtimeHours = 0) => ({ id: date, date, status, hoursWorked, overtimeHours }) as never;

describe("worker portal summaries", () => {
  it("totals net pay only for months in the chosen range", () => {
    const r = payslipsInRange([pay("2026-01", 1000), pay("2026-02", 1200), pay("2026-05", 900)], "2026-01", "2026-03");
    expect(r.months).toBe(2);
    expect(r.net).toBe(2200);
  });
  it("counts requested, approved and pending leave for a month", () => {
    const r = leaveSummary([leave("2026-03-02", "Approved", 2), leave("2026-03-10", "Pending"), leave("2026-04-01", "Approved")], 2026, 3);
    expect([r.requested, r.approved, r.pending, r.approvedDays]).toEqual([2, 1, 1, 2]);
  });
  it("week runs Monday to Sunday", () => {
    expect(weekRange("2026-11-18")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
  });
  it("sums attendance hours in a date range", () => {
    const r = rangeAttendance([att("2026-11-16", "Present", 8, 4), att("2026-11-17", "Absent", 0), att("2026-11-30", "Present")], "2026-11-16", "2026-11-22");
    expect([r.daysWorked, r.absent, r.normalHours, r.otHours]).toEqual([1, 1, 8, 4]);
  });
});
