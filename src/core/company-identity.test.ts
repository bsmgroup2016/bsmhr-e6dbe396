import { expect, test } from "bun:test";
import { MOTHER_COMPANY } from "./company-identity";

test("mother company is BSM GROUP", () => {
  expect(MOTHER_COMPANY.name).toBe("BSM GROUP");
});

test("mother company keeps the supplied Soon Lee Street address", () => {
  expect(MOTHER_COMPANY.address).toBe("1 Soon Lee Street");
});

test("mother company has no UEN", () => {
  expect(MOTHER_COMPANY.uen).toBeNull();
});