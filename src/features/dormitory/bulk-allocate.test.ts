import { describe, expect, test } from "bun:test";
import { availableBeds, planBulkAllocation } from "./bulk-allocate";
import type { BedAllocation, Dormitory } from "@/lib/types";

const dorm = { id: "d1", name: "Tuas View", address: "", capacity: 2, monthlyRent: 300, status: "Active", createdAt: "", updatedAt: "" } as Dormitory;
const alloc = (employeeId: string, status: BedAllocation["status"] = "Occupied") =>
  ({ id: employeeId, dormitoryId: "d1", employeeId, roomNo: "1", bedNo: "A", checkInDate: "2026-01-01", monthlyRent: 300, status, createdAt: "", updatedAt: "" }) as BedAllocation;
const emps = [{ id: "e1", name: "Ali", employeeCode: "B-1" }, { id: "e2", name: "Raju", employeeCode: "B-2", fin: "G123" }, { id: "e3", name: "Sam", employeeCode: "B-3" }];

describe("dormitory seats", () => {
  test("available beds = capacity minus active, vacated ignored", () => {
    expect(availableBeds(dorm, [alloc("x"), alloc("y", "Vacated")])).toBe(1);
    expect(availableBeds(dorm, [alloc("x"), alloc("y"), alloc("z")])).toBe(0);
  });
  test("bulk upload stops when beds run out", () => {
    const rows = ["B-1", "B-2", "B-3"].map((c) => ({ "p-file no": c, dormitory: "tuas view", room: "2" }));
    const r = planBulkAllocation(rows, [dorm], emps, [], "2026-11-25");
    expect(r.valid.length).toBe(2);
    expect(r.errors[0]?.rowNumber).toBe(4);
  });
  test("matches by FIN, defaults rent and rejects unknown dorm/worker", () => {
    const r = planBulkAllocation(
      [{ fin: "g123", dormitory: "Tuas View", room: "3", "check in": "5/11/2026" }, { "p-file no": "Z-9", dormitory: "Tuas View", room: "1" }, { "p-file no": "B-1", dormitory: "Nope", room: "1" }],
      [dorm], emps, [], "2026-11-25",
    );
    expect(r.valid[0]?.monthlyRent).toBe(300);
    expect(r.valid[0]?.checkInDate).toBe("2026-11-05");
    expect(r.errors.length).toBe(2);
  });
  test("occupied bed is rejected", () => {
    const r = planBulkAllocation([{ "p-file no": "B-1", dormitory: "Tuas View", room: "1", bed: "A" }], [dorm], emps, [alloc("e9")], "2026-11-25");
    expect(r.errors[0]?.message).toContain("already occupied");
  });
});
