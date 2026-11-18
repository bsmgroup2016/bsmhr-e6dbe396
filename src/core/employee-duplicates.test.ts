import { expect, test } from "bun:test";
import { findEmployeeDuplicates } from "./employee-duplicates";

test("warns for matching FIN despite case and spacing", () => {
  expect(findEmployeeDuplicates({ fin: "g 1234567 x" }, [{ id: "a", fin: "G1234567X" }])[0]?.fields).toEqual(["fin"]);
});
test("warns for a matching passport independently of FIN", () => {
  expect(findEmployeeDuplicates({ fin: "G7654321X", passportNumber: "AB1234567" }, [{ passportNumber: "ab1234567", fin: "G1234567X" }])[0]?.fields).toEqual(["passportNumber"]);
});
test("warns for matching P-File and groups multiple matching fields", () => {
  expect(findEmployeeDuplicates({ employeeCode: "P-100", fin: "G1234567X" }, [{ employeeCode: "p 100", fin: "G1234567X" }])[0]?.fields).toEqual(["fin", "employeeCode"]);
});
test("editing excludes the current employee but not another duplicate", () => {
  expect(findEmployeeDuplicates({ fin: "G1234567X" }, [{ id: "own", fin: "G1234567X" }, { id: "other", fin: "G1234567X" }], "own").map(match => match.employee.id)).toEqual(["other"]);
});
test("empty and placeholder identities do not match", () => {
  expect(findEmployeeDuplicates({ fin: "-", passportNumber: "N/A" }, [{ fin: "-", passportNumber: "N/A" }])).toEqual([]);
  expect(findEmployeeDuplicates({ employeeCode: "P-100" }, [{ employeeCode: "P-101" }])).toEqual([]);
});