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