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