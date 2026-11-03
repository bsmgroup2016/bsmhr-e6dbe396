import { describe, expect, test } from "bun:test";
import { SINGAPORE_COURSES, missingCourses } from "./training-courses";

describe("Singapore course list", () => {
  test("has all 30 courses with unique codes", () => {
    expect(SINGAPORE_COURSES.length).toBe(30);
    expect(new Set(SINGAPORE_COURSES.map((c) => c.code)).size).toBe(30);
  });
  test("only adds courses not already registered", () => {
    expect(missingCourses(["csoc", "WAH"]).length).toBe(28);
  });
});
