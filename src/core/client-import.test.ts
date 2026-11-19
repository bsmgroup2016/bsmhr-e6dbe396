import { describe, it, expect } from "bun:test";
import { prepareClientImport } from "./client-import";

describe("prepareClientImport", () => {
  it("skips rows without a name", () => {
    expect(prepareClientImport([{ name: " " }], []).clients).toHaveLength(0);
  });
  it("skips clients that already exist (case-insensitive) and duplicates within the file", () => {
    const r = prepareClientImport([{ name: "acme" }, { name: "New Co" }, { name: "new co" }], ["ACME"]);
    expect(r.clients.map((c) => c.name)).toEqual(["New Co"]);
    expect(r.errors).toHaveLength(2);
  });
  it("defaults unknown status to Active and keeps valid status", () => {
    const r = prepareClientImport([{ name: "A", status: "prospect" }, { name: "B", status: "x" }], []);
    expect(r.clients.map((c) => c.status)).toEqual(["Prospect", "Active"]);
  });
});
