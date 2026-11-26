import type { BedAllocation, BedStatus, DormStatus, Dormitory } from "@/lib/types";

/**
 * Form state for the dormitory and bed-allocation dialogs.
 *
 * The edit target and the field values live in one session object so a dialog
 * can never be closed with an edit target left behind: every close path returns
 * `closedDormSession()` / `closedAllocSession()`, which means the next "Add"
 * always creates a new record instead of overwriting the previously edited one.
 */

export type DormForm = {
  name: string;
  address: string;
  operator: string;
  contactPerson: string;
  contactPhone: string;
  capacity: number;
  monthlyRent: number;
  floorAreaSqm: number;
  rooms: number;
  licenseNo: string;
  licenseExpiry: string;
  lastInspection: string;
  status: DormStatus;
  remarks: string;
};

export type AllocForm = {
  dormitoryId: string;
  employeeId: string;
  roomNo: string;
  bedNo: string;
  checkInDate: string;
  monthlyRent: number;
  status: BedStatus;
  remarks: string;
};

export type DormSession = { open: boolean; editId: string | null; form: DormForm };
export type AllocSession = { open: boolean; editId: string | null; form: AllocForm };

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function emptyDormForm(): DormForm {
  return {
    name: "", address: "", operator: "", contactPerson: "", contactPhone: "",
    capacity: 0, monthlyRent: 0, floorAreaSqm: 0, rooms: 0, licenseNo: "",
    licenseExpiry: "", lastInspection: "", status: "Active", remarks: "",
  };
}

export function emptyAllocForm(checkInDate: string = todayISO()): AllocForm {
  return {
    dormitoryId: "", employeeId: "", roomNo: "", bedNo: "",
    checkInDate, monthlyRent: 0, status: "Occupied", remarks: "",
  };
}

export function dormToForm(d: Dormitory): DormForm {
  return {
    name: d.name, address: d.address, operator: d.operator ?? "",
    contactPerson: d.contactPerson ?? "", contactPhone: d.contactPhone ?? "",
    capacity: d.capacity, monthlyRent: d.monthlyRent, floorAreaSqm: d.floorAreaSqm ?? 0,
    rooms: d.rooms ?? 0, licenseNo: d.licenseNo ?? "", licenseExpiry: d.licenseExpiry ?? "",
    lastInspection: d.lastInspection ?? "", status: d.status, remarks: d.remarks ?? "",
  };
}

export function allocToForm(a: BedAllocation): AllocForm {
  return {
    dormitoryId: a.dormitoryId, employeeId: a.employeeId, roomNo: a.roomNo,
    bedNo: a.bedNo ?? "", checkInDate: a.checkInDate, monthlyRent: a.monthlyRent,
    status: a.status, remarks: a.remarks ?? "",
  };
}

/** Closing (Cancel, Escape, outside click or a saved record) drops the edit target. */
export function closedDormSession(): DormSession {
  return { open: false, editId: null, form: emptyDormForm() };
}

export function closedAllocSession(): AllocSession {
  return { open: false, editId: null, form: emptyAllocForm() };
}

/** Opening "Add dormitory" / "Allocate bed" always starts from an empty form. */
export function openAddDormSession(): DormSession {
  return { open: true, editId: null, form: emptyDormForm() };
}

export function openAddAllocSession(checkInDate?: string): AllocSession {
  return { open: true, editId: null, form: emptyAllocForm(checkInDate) };
}

export function openEditDormSession(d: Dormitory): DormSession {
  return { open: true, editId: d.id, form: dormToForm(d) };
}

export function openEditAllocSession(a: BedAllocation): AllocSession {
  return { open: true, editId: a.id, form: allocToForm(a) };
}

/** Editing a field keeps the current edit target; it never invents one. */
export function withDormForm(session: DormSession, patch: Partial<DormForm>): DormSession {
  return { ...session, form: { ...session.form, ...patch } };
}

export function withAllocForm(session: AllocSession, patch: Partial<AllocForm>): AllocSession {
  return { ...session, form: { ...session.form, ...patch } };
}
