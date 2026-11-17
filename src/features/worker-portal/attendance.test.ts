import { describe, expect, it } from "bun:test";
import { monthAttendance } from "./attendance";
import { isWorkerOnly } from "@/core/access";
import type { Attendance } from "@/lib/types";

const a = (date: string, status: Attendance["status"], h = 0, ot = 0): Attendance => ({ id: date, employeeId: "e1", date, status, hoursWorked: h, overtimeHours: ot, createdAt: "", updatedAt: "" });

describe("worker attendance month", () => {
  it("07:00–20:00 days count 8 normal + 4 OT each, other months excluded", () => {
    const m = monthAttendance([a("2026-10-01", "Present", 8, 4), a("2026-10-02", "Present", 8, 4), a("2026-09-30", "Present", 8, 4), a("2026-10-03", "Absent"), a("2026-10-04", "MC")], "2026-10");
    expect(m.daysWorked).toBe(2);
    expect(m.normalHours).toBe(16);
    expect(m.otHours).toBe(8);
    expect(m.absent).toBe(1);
    expect(m.leave).toBe(1);
    expect(m.rows[0].date).toBe("2026-10-04");
  });
});

describe("worker-only accounts", () => {
  it("employee-only lands on My Portal; mixed roles do not", () => {
    expect(isWorkerOnly(["employee"])).toBe(true);
    expect(isWorkerOnly(["employee", "hr"])).toBe(false);
    expect(isWorkerOnly([])).toBe(false);
  });
});
