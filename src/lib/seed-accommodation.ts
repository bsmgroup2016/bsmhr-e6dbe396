import {
  getDormitories, addDormitory, getAllocations, addAllocation,
  getDormitoryInvoices, addDormitoryInvoice,
  getDormitoryInspections, addDormitoryInspection,
  getDormitoryMovements, addDormitoryMovement,
  getEmployees, getCompanies,
} from "./store";
import type { Dormitory } from "./types";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
};
const monthStart = (back: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - back, 1);
  return iso(d);
};

/**
 * Seeds realistic demo accommodation data: dormitories, bed allocations,
 * monthly dorm invoices (with part payments), inspections and movement history.
 * Safe to call more than once — existing records are reused, not duplicated.
 */
export function seedAccommodationDemoData() {
  const companies = getCompanies();
  const bsm = companies.find((c) => c.code === "BSM") ?? companies[0];
  const vrl = companies.find((c) => c.code === "VRL") ?? companies[1] ?? bsm;
  const pluto = companies.find((c) => c.code === "PLT") ?? companies[2] ?? bsm;

  const demoDorms = [
    {
      name: "Jurong Penjuru Dormitory", address: "27 Penjuru Walk, Singapore 609200",
      operator: "Penjuru Lodge Pte Ltd", contactPerson: "Mr. Tan Wei Ming", contactPhone: "+65 6265 4411",
      capacity: 120, monthlyRent: 280, floorAreaSqm: 620, rooms: 12,
      licenseNo: "FDL/2024/0198", licenseExpiry: shift(210), lastInspection: shift(-24),
      companyId: bsm?.id, status: "Active" as Dormitory["status"],
      remarks: "Main housing for BSM site crews. Shuttle bus at 06:45 daily.",
    },
    {
      name: "Kranji Way Lodge", address: "15 Kranji Way, Singapore 739452",
      operator: "Northpoint Housing", contactPerson: "Ms. Siti Rahim", contactPhone: "+65 6752 8890",
      capacity: 80, monthlyRent: 265, floorAreaSqm: 400, rooms: 8,
      licenseNo: "FDL/2024/0455", licenseExpiry: shift(45), lastInspection: shift(-58),
      companyId: vrl?.id, status: "Active" as Dormitory["status"],
      remarks: "License renewal due soon — follow up with operator.",
    },
    {
      name: "Tuas South Quarters", address: "3 Tuas South Ave 6, Singapore 637021",
      operator: "Tuas Living Solutions", contactPerson: "Mr. Ramesh K.", contactPhone: "+65 6863 1220",
      capacity: 60, monthlyRent: 300, floorAreaSqm: 300, rooms: 6,
      licenseNo: "FDL/2023/1187", licenseExpiry: shift(320), lastInspection: shift(-9),
      companyId: pluto?.id, status: "Active" as Dormitory["status"],
      remarks: "Closest to Tuas projects. Higher rent, includes utilities.",
    },
  ];

  const dormIds: string[] = [];
  for (const d of demoDorms) {
    const existing = getDormitories().find((x) => x.name === d.name);
    dormIds.push(existing ? existing.id : addDormitory(d).id);
  }

  // ---- bed allocations -------------------------------------------------
  const workers = getEmployees().filter((e) => !!e.companyId).slice(0, 24);
  const existingAllocs = getAllocations();
  workers.forEach((w, i) => {
    if (existingAllocs.some((a) => a.employeeId === w.id && a.status !== "Vacated")) return;
    const dormIndex = i % dormIds.length;
    const dormitoryId = dormIds[dormIndex];
    if (!dormitoryId) return;
    addAllocation({
      dormitoryId,
      employeeId: w.id,
      roomNo: `${dormIndex + 1}-0${(i % 6) + 1}`,
      bedNo: `B${(i % 4) + 1}`,
      checkInDate: shift(-(30 + i * 11)),
      monthlyRent: demoDorms[dormIndex]?.monthlyRent ?? 280,
      status: "Occupied",
      remarks: i % 5 === 0 ? "Bottom bunk requested (medical)" : "",
    });
  });

  // ---- monthly dorm invoices ------------------------------------------
  const existingInvoices = getDormitoryInvoices();
  dormIds.forEach((dormitoryId, dIdx) => {
    for (let m = 3; m >= 0; m--) {
      const start = monthStart(m);
      const invoiceNo = `DORM-${start.slice(0, 7).replace("-", "")}-${dIdx + 1}`;
      if (existingInvoices.some((x) => x.invoiceNo === invoiceNo)) continue;
      const beds = Math.round((demoDorms[dIdx]?.capacity ?? 60) * 0.7);
      const total = beds * (demoDorms[dIdx]?.monthlyRent ?? 280);
      const paid = m === 0 ? 0 : m === 1 ? Math.round(total * 0.6) : total;
      addDormitoryInvoice({
        companyId: demoDorms[dIdx]?.companyId,
        dormitoryId,
        invoiceNo,
        invoiceDate: start,
        dueDate: shift(-(m * 30) + 14),
        totalAmount: total,
        amountPaid: paid,
        status: paid >= total ? "Paid" : m === 0 ? "Pending" : "Overdue",
        remarks: paid > 0 && paid < total ? "Part payment made — balance under dispute (2 vacated beds)" : "",
      });
    }
  });

  // ---- inspections -----------------------------------------------------
  const existingInspections = getDormitoryInspections();
  const inspectionSeed = [
    { day: -9, inspector: "Internal HSE — J. Lim", status: "Passed" as const, findings: "Housekeeping satisfactory. Fire extinguishers serviced. 4.8 sqm/resident confirmed." },
    { day: -24, inspector: "MOM FDL Officer", status: "Needs Rectification" as const, findings: "Two washroom taps leaking; kitchen exhaust filter clogged.", deadlineDays: 6 },
    { day: -58, inspector: "Internal HSE — S. Kaur", status: "Failed" as const, findings: "Overcrowding in room 2-03 (7 beds vs 5 allowed). Immediate re-allocation required.", deadlineDays: -44 },
  ];
  inspectionSeed.forEach((s, i) => {
    const dormitoryId = dormIds[i % dormIds.length];
    if (!dormitoryId) return;
    const inspectionDate = shift(s.day);
    if (existingInspections.some((x) => x.dormitoryId === dormitoryId && x.inspectionDate === inspectionDate)) return;
    addDormitoryInspection({
      dormitoryId,
      inspectionDate,
      inspectorName: s.inspector,
      findings: s.findings,
      status: s.status,
      rectificationDeadline: s.deadlineDays !== undefined ? shift(s.deadlineDays) : undefined,
      documentUrls: [],
    });
  });

  // ---- movement history ------------------------------------------------
  if (getDormitoryMovements().length < 4) {
    workers.slice(0, 5).forEach((w, i) => {
      const from = dormIds[i % dormIds.length];
      const to = dormIds[(i + 1) % dormIds.length];
      if (!from || !to) return;
      addDormitoryMovement({
        employeeId: w.id,
        fromDormitoryId: from,
        toDormitoryId: to,
        fromRoom: `${(i % 3) + 1}-0${(i % 5) + 1}`,
        toRoom: `${((i + 1) % 3) + 1}-0${(i % 4) + 1}`,
        moveDate: shift(-(15 + i * 20)),
        reason: i % 2 === 0 ? "Moved closer to project site" : "Room re-allocation after inspection",
      });
    });
  }
}
