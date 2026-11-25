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
  it("resolves a Company name or code to its id, case-insensitively", () => {
    const companies = [{ id: "c-bsm", name: "BSM", code: "BSM" }, { id: "c-plt", name: "Pluto", code: "PLT" }];
    const r = prepareClientImport([{ name: "A", company: "bsm" }, { name: "B", company: "PLT" }, { name: "C" }], [], companies);
    expect(r.clients.map((c) => c.companyId)).toEqual(["c-bsm", "c-plt", undefined]);
    expect(r.errors).toHaveLength(0);
  });
  it("warns but still imports when the company is unknown", () => {
    const r = prepareClientImport([{ name: "A", company: "Unknown Co" }], [], [{ id: "c-bsm", name: "BSM" }]);
    expect(r.clients.map((c) => c.companyId)).toEqual([undefined]);
    expect(r.errors).toEqual(['Row 2: company "Unknown Co" not found, left unassigned']);
  });
});
