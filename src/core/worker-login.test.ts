import { expect, test } from "bun:test";
import { loginEmail, workerUsername } from "./worker-login";

test("workers without email use their first and last names", () => {
  expect(workerUsername("Mohammad Abdul Rahman", "12345678-1234-1234-1234-123456789abc")).toBe("mohammad.rahman.12345678123412341234123456789abc");
});
test("duplicate worker names have distinct login identifiers", () => {
  expect(workerUsername("John Smith", "a")).not.toBe(workerUsername("John Smith", "b"));
});
test("worker identifier and email sign-in resolve without public directory lookup", () => {
  expect(loginEmail(" John.Smith.abc ")).toBe("john.smith.abc@workers.hrbsm.xyz");
  expect(loginEmail(" Staff@Example.com ")).toBe("staff@example.com");
});