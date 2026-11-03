import { expect, test } from "bun:test";
import { documentEmployeeFields } from "./employee-document-fields";

test("Particular keeps CSOC, passport and permit expiries separate", () => {
  expect(documentEmployeeFields("particular", { passportExpiry: "2030-04-12", workPermitExpiryDate: "2027-05-31", safetyCourseExpiry: "2028-03-15", ipaExpiryDate: "2026-12-01" })).toEqual({ passportExpiry: "2030-04-12", workPermitExpiryDate: "2027-05-31", passExpiry: "2027-05-31", safetyCourseExpiry: "2028-03-15" });
});
test("passport expiry comes from passport only", () => {
  expect(documentEmployeeFields("passport", { docKind: "Passport", expiryDate: "2030-04-12" }).passportExpiry).toBe("2030-04-12");
  expect(documentEmployeeFields("passport", { docKind: "Work Permit", expiryDate: "2027-05-31" })).toEqual({});
});
test("work permit expiry comes from actual permit, not IPA", () => {
  expect(documentEmployeeFields("workpermit", { docKind: "Work Permit", expiryDate: "2027-05-31" }).workPermitExpiryDate).toBe("2027-05-31");
  expect(documentEmployeeFields("workpermit", { docKind: "IPA", expiryDate: "2027-05-31" })).toEqual({});
});
test("missing CSOC expiry is never inferred and invalid dates are omitted", () => {
  expect(documentEmployeeFields("particular", { safetyCourseType: "CSOC", safetyCourseExpiry: "2027-02-30", dateOfBirth: "unknown" })).toEqual({ safetyCourseType: "CSOC" });
});
test("AI WP abbreviation maps only permit fields", () => {
  expect(documentEmployeeFields("workpermit", { docKind: "W.P.", documentNumber: "065757656", expiryDate: "2027-12-20", passportExpiry: "2033-11-29" })).toEqual({ workPermitNumber: "065757656", workPermitExpiryDate: "2027-12-20", passExpiry: "2027-12-20" });
});
test("AI passport abbreviation maps passport expiry", () => {
  expect(documentEmployeeFields("passport", { docKind: "PP", expiryDate: "2033-11-29" })).toEqual({ passportExpiry: "2033-11-29" });
});
test("CSOC short form maps safety fields without changing permit dates", () => {
  expect(documentEmployeeFields("csoc", { docKind: "SCOS", safetyCourseType: "CSOC", safetyCourseNo: "CS-22", safetyCourseExpiry: "2026-12-14", workPermitExpiryDate: "2027-12-20" })).toEqual({ safetyCourseType: "CSOC", safetyCourseNo: "CS-22", safetyCourseExpiry: "2026-12-14" });
});
test("visit pass and IPA cannot fill work permit fields", () => {
  expect(documentEmployeeFields("workpermit", { docKind: "Visit Pass", expiryDate: "2024-12-20" })).toEqual({});
});
test("CSOC completion without explicit expiry does not invent one", () => {
  expect(documentEmployeeFields("csoc", { docKind: "SOC", safetyCourseType: "CSOC", completionDate: "2024-12-14" })).toEqual({ safetyCourseType: "CSOC" });
});