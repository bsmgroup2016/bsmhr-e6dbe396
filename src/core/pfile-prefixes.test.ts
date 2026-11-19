import { describe, expect, it } from "bun:test";
import { nextPFileNumber, prefixesForCompany, plutoBranchPrefix, bsmBranchPrefix, vrlBranchPrefix } from "./pfile-prefixes";

describe("P-File prefixes", () => {
  it("BSM uses B and BS", () => expect(prefixesForCompany("BSM")).toEqual(["B", "BS"]));
  it("BSM Pte 01 validates and generates only B", () => {
    const branch = "BSM Engineering & Construction Pte Ltd  (Pte 01)";
    expect(prefixesForCompany(branch)).toEqual(["B"]);
    expect(bsmBranchPrefix(branch)).toBe("B");
  });
  it("BSM Pte 02 validates and generates only BS", () => {
    const branch = "BSM Engineering & Construction Pte Ltd (Pte 02)";
    expect(prefixesForCompany(branch)).toEqual(["BS"]);
    expect(bsmBranchPrefix(branch)).toBe("BS");
  });
  it("B and BS retain separate existing sequences", () => {
    const existing = ["B-99", "BS-150"];
    expect(nextPFileNumber("B", existing)).toBe("B-100");
    expect(nextPFileNumber("BS", existing)).toBe("BS-151");
    expect(existing).toEqual(["B-99", "BS-150"]);
  });
  it("Pluto uses P, PC and PS", () => expect(prefixesForCompany("Pluto")).toEqual(["P", "PC", "PS"]));
  it("VRL uses V and VR", () => expect(prefixesForCompany("VRL")).toEqual(["V", "VR"]));
  it("P-99 is followed by P-100, ignoring PC numbers", () =>
    expect(nextPFileNumber("P", ["P-99", "PC-150", "P-12"])).toBe("P-100"));
  it("first number is 01", () => expect(nextPFileNumber("V", [])).toBe("V-01"));
  it("Pluto Pte 01 uses only P", () => expect(prefixesForCompany("Pluto System Engineering Pte Ltd (Pte 01)")).toEqual(["P"]));
  it("Pluto Pte 02 uses only PC", () => expect(prefixesForCompany("Pluto System Engineering Pte Ltd (Pte 02)")).toEqual(["PC"]));
  it("PC sequence stays separate from P", () => expect(nextPFileNumber("PC", ["P-99", "PC-02"])).toBe("PC-03"));
  it("new Pte 01 worker numbers resolve to P", () => expect(plutoBranchPrefix("Pluto System Engineering Pte Ltd (Pte 01)")).toBe("P"));
  it("new Pte 02 worker numbers resolve to PC", () => expect(plutoBranchPrefix("Pluto System Engineering Pte Ltd (Pte 02)")).toBe("PC"));
  it("VRL Pte 01 uses only V", () => expect(prefixesForCompany("VRL Engineering Pte Ltd (Pte 01)")).toEqual(["V"]));
  it("VRL Pte 02 uses only VR", () => expect(prefixesForCompany("VRL Engineering Pte Ltd (Pte 02)")).toEqual(["VR"]));
  it("VRL Pte 01 resolves to V", () => expect(vrlBranchPrefix("VRL Engineering Pte Ltd (Pte 01)")).toBe("V"));
  it("VRL Pte 02 resolves to VR", () => expect(vrlBranchPrefix("VRL Engineering Pte Ltd (Pte 02)")).toBe("VR"));
  it("VR sequence stays separate from V", () => expect(nextPFileNumber("VR", ["V-99", "VR-02"])).toBe("VR-03"));
});
