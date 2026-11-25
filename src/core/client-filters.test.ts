import { describe, expect, it } from "bun:test";
import { clientCompanyOptions, filterClients } from "./client-filters";
import type { Client, Company } from "@/lib/types";

const client = (id: string, name: string, values: Partial<Client> = {}) =>
  ({ id, code: id.toUpperCase(), name, contactPerson: "", email: "", phone: "", address: "", status: "Active", ...values }) as Client;

const bsm = { id: "c-bsm", code: "BSM", name: "BSM" } as Company;
const vrl = { id: "c-vrl", code: "VRL", name: "VRL" } as Company;
const plt = { id: "c-plt", code: "PLT", name: "Pluto" } as Company;

describe("filterClients", () => {
  const clients = [
    client("1", "Keppel Infrastructure", { companyId: "c-bsm", status: "Active" }),
    client("2", "Sim Lian Construction", { companyId: "c-vrl", status: "Active" }),
    client("3", "Changi Facility Services", { companyId: "c-plt", status: "Prospect" }),
    client("4", "No Company Co", { companyId: undefined, status: "Active" }),
  ];

  it("returns only the selected company's clients", () => {
    const r = filterClients(clients, { search: "", status: "all", companyId: "c-vrl" });
    expect(r.map((c) => c.name)).toEqual(["Sim Lian Construction"]);
  });

  it("shows every client when company is All", () => {
    expect(filterClients(clients, { search: "", status: "all", companyId: "all" })).toHaveLength(4);
  });

  it("excludes clients without a company from a company filter", () => {
    const r = filterClients(clients, { search: "", status: "all", companyId: "c-bsm" });
    expect(r.map((c) => c.name)).toEqual(["Keppel Infrastructure"]);
  });

  it("combines company, status and search", () => {
    expect(filterClients(clients, { search: "keppel", status: "Active", companyId: "c-bsm" })).toHaveLength(1);
    expect(filterClients(clients, { search: "keppel", status: "Prospect", companyId: "c-bsm" })).toHaveLength(0);
    expect(filterClients(clients, { search: "", status: "all", companyId: "c-plt" }).map((c) => c.name)).toEqual(["Changi Facility Services"]);
  });

  it("orders company options BSM, VRL, Pluto", () => {
    expect(clientCompanyOptions([plt, vrl, bsm]).map((o) => o.label)).toEqual(["BSM", "VRL", "Pluto"]);
  });
});
