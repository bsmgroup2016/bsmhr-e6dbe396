import { describe, expect, it } from "bun:test";
import { nextPFileNumber, prefixesForCompany } from "./pfile-prefixes";

describe("P-File prefixes", () => {
  it("BSM uses B and BS", () => expect(prefixesForCompany("BSM")).toEqual(["B", "BS"]));
  it("Pluto uses P, PC and PS", () => expect(prefixesForCompany("Pluto")).toEqual(["P", "PC", "PS"]));
  it("VRL uses only V", () => expect(prefixesForCompany("VRL")).toEqual(["V"]));
  it("P-99 is followed by P-100, ignoring PC numbers", () =>
    expect(nextPFileNumber("P", ["P-99", "PC-150", "P-12"])).toBe("P-100"));
  it("first number is 01", () => expect(nextPFileNumber("V", [])).toBe("V-01"));
});
