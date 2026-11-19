import type { Client, ClientStatus, Company } from "@/lib/types";
import { orderedCompanies } from "./company-overview";

export interface ClientFilters {
  search: string;
  status: ClientStatus | "all";
  companyId: string | "all";
}

/** Company dropdown options in the fixed BSM → VRL → Pluto order, others after. */
export function clientCompanyOptions(companies: Company[]) {
  return orderedCompanies(companies).map((c) => ({ value: c.id, label: c.name }));
}

/** Clients matching the search box, status and company filters together. */
export function filterClients(clients: Client[], f: ClientFilters): Client[] {
  const q = f.search.trim().toLowerCase();
  return clients.filter((c) => {
    const matchesSearch =
      !q ||
      [c.name, c.code, c.contactPerson, c.email].some((v) => (v ?? "").toLowerCase().includes(q));
    const matchesStatus = f.status === "all" || c.status === f.status;
    const matchesCompany = f.companyId === "all" || (c.companyId ?? "") === f.companyId;
    return matchesSearch && matchesStatus && matchesCompany;
  });
}
