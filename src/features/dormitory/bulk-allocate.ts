import type { BedAllocation, Dormitory } from "@/lib/types";

export type DormRow = Record<string, string>;
export type PlannedAllocation = {
  rowNumber: number; dormitoryId: string; employeeId: string; roomNo: string; bedNo: string;
  checkInDate: string; monthlyRent: number; remarks: string; workerLabel: string; dormLabel: string;
};
export type PlanError = { rowNumber: number; message: string };

type Emp = { id: string; name: string; employeeCode?: string; fin?: string };

const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();

/** Beds still free in a dormitory (capacity minus active allocations), never negative. */
export function availableBeds(dorm: Pick<Dormitory, "id" | "capacity">, allocs: Pick<BedAllocation, "dormitoryId" | "status">[]): number {
  const used = allocs.filter((a) => a.dormitoryId === dorm.id && a.status !== "Vacated").length;
  return Math.max(0, (dorm.capacity || 0) - used);
}

function toIsoDate(v: string, fallback: string): string | null {
  const s = v.trim();
  if (!s) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Validate uploaded worker rows against dormitories and seats.
 * Columns (case-insensitive): P-File No | FIN, Dormitory, Room, Bed, Check in, Monthly rent, Remarks.
 * `firstDataRow` is the sheet row number of the first data row (header + 1).
 */
export function planBulkAllocation(
  rows: DormRow[], dorms: Dormitory[], employees: Emp[], allocs: BedAllocation[], today: string, firstDataRow = 2,
): { valid: PlannedAllocation[]; errors: PlanError[] } {
  const valid: PlannedAllocation[] = [];
  const errors: PlanError[] = [];
  const free = new Map(dorms.map((d) => [d.id, availableBeds(d, allocs)]));
  const seenEmp = new Set<string>();
  const takenBeds = new Set(
    allocs.filter((a) => a.status !== "Vacated" && a.bedNo).map((a) => `${a.dormitoryId}|${norm(a.roomNo)}|${norm(a.bedNo)}`),
  );
  rows.forEach((r, i) => {
    const rowNumber = firstDataRow + i;
    const code = norm(r["p-file no"] ?? r["p-file"] ?? r["worker id"]);
    const fin = norm(r["fin"] ?? r["fin no"]);
    const dormKey = norm(r["dormitory"] ?? r["dorm"]);
    const roomNo = (r["room"] ?? r["room no"] ?? "").trim();
    const bedNo = (r["bed"] ?? r["bed no"] ?? "").trim();
    if (!code && !fin && !dormKey && !roomNo) return; // blank row
    const emp = employees.find((e) => (code && norm(e.employeeCode) === code) || (fin && norm(e.fin) === fin));
    if (!emp) return errors.push({ rowNumber, message: "Worker not found (check P-File No / FIN)" });
    if (seenEmp.has(emp.id)) return errors.push({ rowNumber, message: `${emp.name} appears twice in the file` });
    const dorm = dorms.find((d) => norm(d.name) === dormKey);
    if (!dorm) return errors.push({ rowNumber, message: `Dormitory "${r["dormitory"] ?? ""}" not found` });
    if (!roomNo) return errors.push({ rowNumber, message: "Room is required" });
    const date = toIsoDate(r["check in"] ?? r["check-in date"] ?? "", today);
    if (!date) return errors.push({ rowNumber, message: "Invalid check-in date" });
    const bedKey = `${dorm.id}|${norm(roomNo)}|${norm(bedNo)}`;
    if (bedNo && takenBeds.has(bedKey)) return errors.push({ rowNumber, message: `Bed ${roomNo}/${bedNo} is already occupied` });
    const alreadyHere = allocs.some((a) => a.employeeId === emp.id && a.dormitoryId === dorm.id && a.status !== "Vacated");
    const left = free.get(dorm.id) ?? 0;
    if (!alreadyHere && left <= 0) return errors.push({ rowNumber, message: `${dorm.name} has no available beds` });
    const rentRaw = (r["monthly rent"] ?? r["rent"] ?? "").replace(/[$,\s]/g, "");
    const rent = rentRaw ? Number(rentRaw) : dorm.monthlyRent || 0;
    if (Number.isNaN(rent) || rent < 0) return errors.push({ rowNumber, message: "Invalid monthly rent" });
    if (!alreadyHere) free.set(dorm.id, left - 1);
    if (bedNo) takenBeds.add(bedKey);
    seenEmp.add(emp.id);
    valid.push({
      rowNumber, dormitoryId: dorm.id, employeeId: emp.id, roomNo, bedNo, checkInDate: date, monthlyRent: rent,
      remarks: (r["remarks"] ?? "").trim(), workerLabel: `${emp.name}${emp.employeeCode ? ` — ${emp.employeeCode}` : ""}`, dormLabel: dorm.name,
    });
  });
  return { valid, errors };
}
