import { describe, expect, test } from "bun:test";
import { prepareProjectImport } from "./project-import";

const clients = [{ id: "c1", name: "Active Service Pte", code: "ASP" }];

describe("prepareProjectImport", () => {
  test("one client can get multiple projects/sites", () => {
    const r = prepareProjectImport([{ client: "Active Service Pte", name: "VSMC" }, { client: "asp", name: "Mandai Zoo" }], clients, []);
    expect(r.projects.map((p) => [p.clientId, p.name])).toEqual([["c1", "VSMC"], ["c1", "Mandai Zoo"]]);
  });
  test("unknown client is rejected", () => {
    const r = prepareProjectImport([{ client: "Nobody", name: "X" }], clients, []);
    expect(r.projects.length).toBe(0);
    expect(r.errors.length).toBe(1);
  });
  test("existing project for same client is skipped", () => {
    const r = prepareProjectImport([{ client: "ASP", name: "vsmc" }], clients, [{ clientId: "c1", name: "VSMC" }]);
    expect(r.projects.length).toBe(0);
  });
});
