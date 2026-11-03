import { expect, test } from "bun:test";
import { employeeDocumentSection, employeeFormDocuments } from "./employee-form-documents";

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
});
import { storedFormDocumentUrls } from "./employee-form-documents";

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

test("Bank Card upload uses existing bank document records and is not duplicated on re-save", () => {
  const fd = new FormData();
  fd.set("bankCardUpload", "r2://documents/bank-card.pdf");
  fd.set("bankAccount", "455-03577-5");
  expect(employeeFormDocuments(fd)).toEqual([{ type: "Bank Letter", name: "Bank Card", fileUrl: "r2://documents/bank-card.pdf", expiryDate: undefined, docNumber: "455-03577-5", status: "Pending", verified: false }]);
  expect(employeeFormDocuments(fd, [{ fileUrl: "r2://documents/bank-card.pdf" }])).toEqual([]);
});

test("Bank Card restores its own file without replacing it with a bank letter", () => {
  expect(storedFormDocumentUrls([
    { type: "Bank Letter", name: "Bank Card", fileUrl: "card.pdf", uploadedAt: "2026-11-02" },
    { type: "Bank Letter", name: "Bank Letter", fileUrl: "letter.pdf", uploadedAt: "2026-11-03" },
  ])).toEqual({ bankCardUpload: "card.pdf" });
});

test("saved documents are classified into their original sections", () => {
  expect(employeeDocumentSection({ type: "IPA Letter", name: "IPA" })).toBe("IPA");
  expect(employeeDocumentSection({ type: "P-File", name: "Particular" })).toBe("Particular");
  expect(employeeDocumentSection({ type: "Safety Certificate", name: "CSOC" })).toBe("CSOC");
  expect(employeeDocumentSection({ type: "Bank Letter", name: "Bank Card" })).toBe("Bank Card");
  expect(employeeDocumentSection({ type: "Bank Letter", name: "Bank Letter" })).toBe("Bank Letter");
});
