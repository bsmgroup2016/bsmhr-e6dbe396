import { describe, it, expect } from "bun:test";
import { newOnboarding, readOnboarding, writeOnboarding, onboardingEmployeePatch, onboardingIncomplete } from "./onboarding";
import { isEmployeeAvailable } from "../lib/availability";
import type { Employee } from "../lib/types";
import { isCountableWorker } from "../lib/workforce-split";

describe("Onboard & Issuence lifecycle", () => {
  it("keeps IPA registrants unavailable even if a generic form marks them active", () => {
    const worker = { id: "one", status: "Active", internalNotes: writeOnboarding("HR note", newOnboarding()) } as Employee;
    expect(isEmployeeAvailable(worker, new Set())).toBe(false);
    expect(isCountableWorker({ ...worker, companyId: "bsm", department: "Construction" })).toBe(false);
    expect(onboardingEmployeePatch(worker, newOnboarding()).deploymentStatus).toBe("Not Deployable");
  });
  it("releases the same worker only after recorded onboarding completion", () => {
    const worker = { id: "one", status: "Pending Approval", deploymentStatus: "Not Deployable" } as Employee;
    const result = { ...worker, ...onboardingEmployeePatch(worker, { ...newOnboarding(), stage: "Onboard completed", bookingDate: "2026-11-20", completedDate: "2026-11-21" }) };
    expect(result.id).toBe("one");
    expect(isEmployeeAvailable(result, new Set())).toBe(true);
  });
  it("requires real permit data to confirm issuance", () => {
    const state = { ...newOnboarding(), stage: "Work Permit issued" as const, bookingDate: "2026-11-20", completedDate: "2026-11-21" };
    expect(() => onboardingEmployeePatch({}, state)).toThrow("actual Work Permit");
    expect(onboardingEmployeePatch({ workPermitNumber: "WP123", workPermitIssueDate: "2026-11-22", workPermitExpiryDate: "2027-11-21" }, state).passExpiry).toBe("2027-11-21");
  });
  it("preserves IPA and free-text notes without inventing permit dates", () => {
    const notes = writeOnboarding("Keep original HR notes", newOnboarding());
    expect(notes.startsWith("Keep original HR notes\n")).toBe(true);
    expect(readOnboarding({ internalNotes: notes })?.stage).toBe("IPA registered");
    expect(onboardingEmployeePatch({ ipaDocumentUrl: "ipa/original.pdf" }, newOnboarding()).workPermitIssueDate).toBeUndefined();
  });
  it("fails closed for damaged onboarding data", () => { expect(onboardingIncomplete({ internalNotes: "[BSM_ONBOARD_V1]broken[/BSM_ONBOARD_V1]" })).toBe(true); });
  it("requires booking and completion dates for subsequent stages", () => {
    expect(() => writeOnboarding("", { ...newOnboarding(), stage: "At Onboard" })).toThrow();
    expect(() => writeOnboarding("", { ...newOnboarding(), stage: "MOM appointment booked", bookingDate: "2026-11-20", appointmentDate: "2026-11-22" })).toThrow();
  });
  it("rejects a completion date while still at Onboard and impossible dates", () => {
    expect(() => writeOnboarding("", { ...newOnboarding(), stage: "At Onboard", bookingDate: "2026-11-20", completedDate: "2026-11-21" })).toThrow();
    expect(() => writeOnboarding("", { ...newOnboarding(), stage: "Onboard booked", bookingDate: "2026-02-30" })).toThrow();
  });
});