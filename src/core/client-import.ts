import type { Client, ClientStatus } from "@/lib/types";

export type ClientImportInput = Omit<Client, "id" | "code" | "createdAt" | "updatedAt">;

export const CLIENT_IMPORT_FIELDS = [
  { key: "name", label: "Client Name", required: true, example: "Jurong Port Logistics" },
  { key: "contactPerson", label: "Contact Person", example: "Tan Wei Ming" },
  { key: "email", label: "Email", example: "ops@example.com" },
  { key: "phone", label: "Phone", example: "+65 6123 4567" },
  { key: "address", label: "Address", example: "1 Jurong Port Road" },
  { key: "industry", label: "Industry", example: "Logistics" },
  { key: "status", label: "Status", example: "Active" },
  { key: "contractStart", label: "Contract Start", example: "2026-01-01" },
  { key: "contractEnd", label: "Contract End", example: "2026-12-31" },
] as const;

const STATUSES: ClientStatus[] = ["Active", "Inactive", "Prospect"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Turns imported rows (keyed by field key) into clients; skips blanks and names already present. */
export function prepareClientImport(rows: Record<string, string>[], existingNames: string[]) {
  const seen = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const clients: ClientImportInput[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const name = (row.name ?? "").trim();
    if (!name) { errors.push(`Row ${line}: missing Client Name`); return; }
    if (seen.has(name.toLowerCase())) { errors.push(`Row ${line}: "${name}" already exists, skipped`); return; }
    const rawStatus = (row.status ?? "").trim().toLowerCase();
    const status = STATUSES.find((s) => s.toLowerCase() === rawStatus) ?? "Active";
    const date = (v?: string) => { const t = (v ?? "").trim(); return DATE.test(t) ? t : undefined; };
    seen.add(name.toLowerCase());
    clients.push({
      name,
      contactPerson: (row.contactPerson ?? "").trim(),
      email: (row.email ?? "").trim(),
      phone: (row.phone ?? "").trim(),
      address: (row.address ?? "").trim(),
      industry: (row.industry ?? "").trim(),
      status,
      contractStart: date(row.contractStart),
      contractEnd: date(row.contractEnd),
    });
  });
  return { clients, errors };
}
