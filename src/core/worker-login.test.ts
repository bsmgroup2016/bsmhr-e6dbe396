import { expect, test } from "bun:test";
import { loginEmail, workerUsername } from "./worker-login";

test("workers without email use their first and last names", () => {
  expect(workerUsername("Mohammad Abdul Rahman")).toBe("mohammad.rahman");
});
test("duplicate worker names have distinct login identifiers", () => {
  expect(workerUsername("John Smith", 2)).toBe("john.smith2");
  expect(workerUsername("John Smith")).toBe("john.smith");
});
test("worker identifier and email sign-in resolve without public directory lookup", () => {
  expect(loginEmail(" John.Smith.abc ")).toBe("john.smith.abc@workers.hrbsm.xyz");
  expect(loginEmail(" Staff@Example.com ")).toBe("staff@example.com");
});