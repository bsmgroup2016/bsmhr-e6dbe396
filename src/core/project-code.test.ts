import { describe, expect, test } from "bun:test";
import { nextProjectCode, projectCodeLetter } from "./project-code";

describe("project codes", () => {
  test("company letters", () => {
    expect(projectCodeLetter({ code: "BSM" })).toBe("B");
    expect(projectCodeLetter({ code: "VRL" })).toBe("V");
    expect(projectCodeLetter({ code: "PLT", name: "Pluto System Engineering" })).toBe("P");
  });
  test("numbers per company", () => {
    expect(nextProjectCode("V", [])).toBe("V001");
    expect(nextProjectCode("V", ["V001", "V002", "P005"])).toBe("V003");
    expect(nextProjectCode("P", ["V001", "P005"])).toBe("P006");
  });
});
