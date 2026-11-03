import { expect, test } from "bun:test";
import { employeeFormDocuments } from "./employee-form-documents";

test("uploaded passport retains its file and corrected expiry as an unverified document", () => {
  const fd = new FormData();
  fd.set("passportUpload", "r2://documents/passport.pdf");
  fd.set("passportExpiry", "2030-04-12");
  expect(employeeFormDocuments(fd)).toEqual([{ type: "Passport", name: "Passport", fileUrl: "r2://documents/passport.pdf", expiryDate: "2030-04-12", docNumber: undefined, status: "Pending", verified: false }]);
});
test("no upload creates no document", () => {
  expect(employeeFormDocuments(new FormData())).toEqual([]);
});
test("CSOC source is retained as a safety certificate with reviewed expiry", () => {
  const fd = new FormData();
  fd.set("csocUpload", "r2://documents/csoc.pdf");
  fd.set("safetyCourseExpiry", "2026-12-14");
  fd.set("safetyCourseNo", "CS-22");
  expect(employeeFormDocuments(fd)).toEqual([{ type: "Safety Certificate", name: "Safety Certificate", fileUrl: "r2://documents/csoc.pdf", expiryDate: "2026-12-14", docNumber: "CS-22", status: "Pending", verified: false }]);
});import { storedFormDocumentUrls } from "./employee-form-documents";

test("re-saving with an already stored Work Permit does not create a duplicate", () => {
  const fd = new FormData();
  fd.set("workPermitUpload", "r2://documents/wp.pdf");
  expect(employeeFormDocuments(fd, [{ fileUrl: "r2://documents/wp.pdf" }])).toEqual([]);
});
test("saved Work Permit shows again in the form, newest first", () => {
  expect(storedFormDocumentUrls([
    { type: "Work Permit", fileUrl: "old.pdf", uploadedAt: "2026-11-03T05:00:00Z" },
    { type: "Work Permit", fileUrl: "new.pdf", uploadedAt: "2026-11-03T08:00:00Z" },
    { type: "Passport", fileUrl: "pp.pdf", uploadedAt: "2026-11-03T05:00:00Z" },
  ])).toEqual({ workPermitUpload: "new.pdf", passportUpload: "pp.pdf" });
});
