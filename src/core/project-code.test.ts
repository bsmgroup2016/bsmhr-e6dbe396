import { describe, expect, test } from "bun:test";
import { nextProjectCode, projectCodeLetter } from "./project-code";

describe("project codes", () => {
  test("company letters", () => {
    expect(projectCodeLetter({ code: "BSM" })).toBe("B");
    expect(projectCodeLetter({ code: "VRL" })).toBe("V");
    expect(projectCodeLetter({ code: "PLT", name: "Pluto System Engineering" })).toBe("P");
  });
  test("numbers per company", () => {
    expect(nextProjectCode("V", [])).toBe("V01");
    expect(nextProjectCode("V", ["V01", "V02", "P05"])).toBe("V03");
    expect(nextProjectCode("P", ["V01", "P05"])).toBe("P06");
  });
});
