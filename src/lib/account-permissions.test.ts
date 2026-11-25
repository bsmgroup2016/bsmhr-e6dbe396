import { expect, test } from "bun:test";
import { verifyAccountRoles } from "./account-permissions";

const wait = async () => {};
test("transient permission read retries and returns freshly verified admin role", async () => {
  let calls = 0;
  const roles = await verifyAccountRoles(async () => ++calls === 1
    ? { data: null, error: { message: "Failed to fetch" }, status: 0 }
    : { data: [{ role: "admin" }], error: null, status: 200 }, wait);
  expect(calls).toBe(2);
  expect(roles).toEqual(["admin"]);
});
test("exhausted transport failures deny access rather than return empty or admin roles", async () => {
  let calls = 0;
  await expect(verifyAccountRoles(async () => { calls++; throw new TypeError("Failed to fetch"); }, wait)).rejects.toThrow("Could not verify account permissions");
  expect(calls).toBe(3);
});
test("forbidden role read is never retried or bypassed", async () => {
  let calls = 0;
  await expect(verifyAccountRoles(async () => { calls++; return { data: null, error: { message: "Forbidden" }, status: 403 }; }, wait)).rejects.toThrow();
  expect(calls).toBe(1);
});
test("confirmed empty roles stay unprivileged", async () => {
  expect(await verifyAccountRoles(async () => ({ data: [], error: null, status: 200 }), wait)).toEqual([]);
});