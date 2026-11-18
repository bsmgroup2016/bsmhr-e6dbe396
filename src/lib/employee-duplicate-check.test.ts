import { expect, mock, test } from "bun:test";

let ranges: number[] = [];
let fail = false;
mock.module("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ order: () => ({ range: async (offset: number) => {
  ranges.push(offset);
  if (fail) return { data: null, error: { message: "Unavailable" } };
  return { error: null, data: offset === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: String(i), name: "Worker", employee_code: `P-${i}`, fin: "", passport_number: "" })) : [{ id: "last", name: "Last worker", employee_code: "P-501", fin: "G1234567X", passport_number: "AB1234567" }] };
} }) }) }) } }));
const { checkEmployeeDuplicates } = await import("./employee-duplicate-check");

test("duplicate check traverses every page instead of truncating the employee list", async () => {
  fail = false; ranges = [];
  const matches = await checkEmployeeDuplicates({ fin: "G1234567X" });
  expect(ranges).toEqual([0, 500]);
  expect(matches[0]?.employee.id).toBe("last");
});
test("a failed employee read blocks saving rather than declaring no duplicates", async () => {
  fail = true;
  await expect(checkEmployeeDuplicates({ fin: "G1234567X" })).rejects.toThrow("Could not check existing workers");
});