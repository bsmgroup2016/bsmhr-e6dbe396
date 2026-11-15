import { expect, test } from "bun:test";
import { employeeFromForm } from "@/components/employee-form";
test("document-only form preserves missing personal salary identity and status values", () => {
  const fd = new FormData(); fd.set("ipaDocumentUrl", "ipa/new.pdf");
  expect(employeeFromForm(fd)).toEqual({ ipaDocumentUrl: "ipa/new.pdf" });
});
test("skill certification fields are submitted independently of CSOC", () => {
  const fd = new FormData(); fd.set("skillLevel", "Higher Skilled"); fd.set("skillCertType", "Skills Evaluation (SEC(K))"); fd.set("skillCertNo", "SEC-22"); fd.set("skillCertExpiry", "2028-11-15"); fd.set("safetyCourseExpiry", "2027-01-01");
  expect(employeeFromForm(fd)).toMatchObject({ skillLevel: "Higher Skilled", skillCertNo: "SEC-22", skillCertExpiry: "2028-11-15", safetyCourseExpiry: "2027-01-01" });
});