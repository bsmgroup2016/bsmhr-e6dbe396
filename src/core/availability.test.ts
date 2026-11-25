import { describe, expect, it } from "bun:test";
import type { Employee } from "../lib/types";
import { workforceBands } from "../lib/availability";

const worker = (id: string, over: Partial<Employee> = {}) =>
  ({ id, status: "Active", deploymentStatus: "Available", ...over }) as unknown as Employee;

describe("workforceBands", () => {
  it("splits live workers into working and available", () => {
    const workers = [
      worker("a"),
      worker("b", { deploymentStatus: "Deployed" }),
      worker("c", { deploymentStatus: "On Leave" }),
      worker("d"),
    ];
    const bands = workforceBands(workers, new Set(["a"]));
    expect(bands).toEqual({ live: 4, working: 3, available: 1 });
  });

  it("counts assigned workers as working", () => {
    const bands = workforceBands([worker("a"), worker("b")], new Set(["a", "b"]));
    expect(bands).toEqual({ live: 2, working: 2, available: 0 });
  });

  it("handles an empty company", () => {
    expect(workforceBands([], new Set())).toEqual({ live: 0, working: 0, available: 0 });
  });
});
