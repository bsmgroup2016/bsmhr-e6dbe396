import { expect, test } from "bun:test";
import {
  closedAllocSession, closedDormSession, openAddAllocSession, openAddDormSession,
  openEditAllocSession, openEditDormSession, withAllocForm, withDormForm,
} from "./dormitory-form-state";
import type { BedAllocation, Dormitory } from "@/lib/types";

const dorm: Dormitory = {
  id: "dorm-a", name: "Dorm A", address: "1 Soon Lee Street", operator: "BSM",
  contactPerson: "Ali", contactPhone: "90000000", capacity: 20, monthlyRent: 80,
  floorAreaSqm: 90, rooms: 4, licenseNo: "L1", licenseExpiry: "2027-01-31",
  lastInspection: "2026-10-01", status: "Active", remarks: "ok", createdAt: "", updatedAt: "",
};

const alloc: BedAllocation = {
  id: "alloc-a", dormitoryId: "dorm-a", employeeId: "emp-a", roomNo: "01-05", bedNo: "B",
  checkInDate: "2026-11-01", monthlyRent: 80, status: "Occupied", remarks: "note",
  createdAt: "", updatedAt: "",
};

test("editing a dormitory keeps its id and current values", () => {
  const s = openEditDormSession(dorm);
  expect(s.editId).toBe("dorm-a");
  expect(s.form.name).toBe("Dorm A");
  expect(s.form.capacity).toBe(20);
});

test("cancelling a dormitory edit drops the edit target and the typed values", () => {
  const edited = withDormForm(openEditDormSession(dorm), { name: "Renamed" });
  const closed = closedDormSession();
  expect(closed.open).toBe(false);
  expect(closed.editId).toBeNull();
  expect(closed.form.name).toBe("");
  expect(closed.form.capacity).toBe(0);
  expect(edited.editId).toBe("dorm-a");
});

test("Add dormitory after cancelling an edit creates a new record, not an overwrite", () => {
  const afterCancel = closedDormSession();
  const add = openAddDormSession();
  expect(add.editId).toBeNull();
  expect(add.form).toEqual(afterCancel.form);
});

test("typing in a dormitory field never invents or loses an edit target", () => {
  const add = withDormForm(openAddDormSession(), { name: "Dorm B" });
  expect(add.editId).toBeNull();
  expect(add.form.name).toBe("Dorm B");
  const edit = withDormForm(openEditDormSession(dorm), { capacity: 24 });
  expect(edit.editId).toBe("dorm-a");
  expect(edit.form.capacity).toBe(24);
  expect(edit.form.name).toBe("Dorm A");
});

test("editing an allocation keeps its id and current values", () => {
  const s = openEditAllocSession(alloc);
  expect(s.editId).toBe("alloc-a");
  expect(s.form.roomNo).toBe("01-05");
  expect(s.form.bedNo).toBe("B");
});

test("cancelling an allocation edit drops the edit target and the typed values", () => {
  const edited = withAllocForm(openEditAllocSession(alloc), { roomNo: "02-11" });
  const closed = closedAllocSession();
  expect(closed.editId).toBeNull();
  expect(closed.form.roomNo).toBe("");
  expect(closed.form.employeeId).toBe("");
  expect(edited.form.roomNo).toBe("02-11");
});

test("Allocate bed after cancelling an edit creates a new allocation", () => {
  const add = openAddAllocSession("2026-11-26");
  expect(add.editId).toBeNull();
  expect(add.form.employeeId).toBe("");
  expect(add.form.checkInDate).toBe("2026-11-26");
});
