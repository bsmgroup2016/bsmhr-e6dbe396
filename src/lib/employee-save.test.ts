import { expect, test } from "bun:test";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionStore, getEmployees, saveEmployeeConfirmed, saveEmployeeDocumentsConfirmed, deleteEmployeeConfirmed, getDocumentsByEmployee } from "./store";

test("confirmed worker create edit documents retry and delete never show failed writes as success", async () => {
  const original = supabase.from;
  const rows = new Map<string, Record<string, unknown>>();
  let fail = true;
  supabase.from = ((table: string) => {
    if (table === "audit_logs") return { insert: () => Promise.resolve({ error: null }) };
    const query = (kind: string, payload?: Record<string, unknown> | Record<string, unknown>[]) => {
      let id = "";
      const result = () => {
        if (fail) return { data: null, error: { message: "Write denied" } };
        if (table === "employee_documents") return { data: (payload as Record<string, unknown>[]).map(row => ({ id: row.id })), error: null };
        const row = kind === "insert" ? payload as Record<string, unknown> : { ...rows.get(id), ...payload, id };
        if (kind === "delete") { rows.delete(id); return { data: [{ id }], error: null }; }
        rows.set(String(row.id), row); return { data: row, error: null };
      };
      const chain = { eq: (_: string, value: string) => { id = value; return chain; }, select: () => ({ single: async () => result(), then: (resolve: (value: unknown) => void) => resolve(result()) }) };
      return chain;
    };
    return { insert: (payload: Record<string, unknown>[]) => query("insert", payload), update: (payload: Record<string, unknown>) => query("update", payload), delete: () => query("delete") };
  }) as unknown as typeof supabase.from;
  clearSessionStore();
  const payload = { employeeCode: "PC-22", name: "WORKER", companyId: "pluto", department: "Construction", basicSalary: 22, nationality: "Bangladesh", fin: "G123", passType: "Work Permit" as const, status: "Active" as const, trade: "Welder", joinedOn: "2026-11-01" };
  try {
    await expect(saveEmployeeConfirmed(payload)).rejects.toThrow("Write denied"); expect(getEmployees()).toHaveLength(0);
    fail = false; const saved = await saveEmployeeConfirmed(payload); expect(getEmployees()[0].companyId).toBe("pluto");
    fail = true; await expect(saveEmployeeConfirmed({ basicSalary: 30 }, saved.id)).rejects.toThrow(); expect(getEmployees()[0].basicSalary).toBe(22);
    fail = false; await saveEmployeeConfirmed({ basicSalary: 30, skillCertNo: "SEC-22" }, saved.id); expect(getEmployees()[0]).toMatchObject({ basicSalary: 30, skillCertNo: "SEC-22" });
    const documents = [{ type: "Work Permit" as const, name: "WP", fileUrl: "documents/wp.pdf", status: "Pending" as const }];
    fail = true; await expect(saveEmployeeDocumentsConfirmed(saved.id, documents)).rejects.toThrow("Worker saved"); expect(getDocumentsByEmployee(saved.id)).toHaveLength(0);
    fail = false; await saveEmployeeDocumentsConfirmed(saved.id, documents); await saveEmployeeDocumentsConfirmed(saved.id, documents); expect(getDocumentsByEmployee(saved.id)).toHaveLength(1);
    fail = true; await expect(deleteEmployeeConfirmed(saved.id)).rejects.toThrow(); expect(getEmployees()).toHaveLength(1);
    fail = false; await deleteEmployeeConfirmed(saved.id); expect(getEmployees()).toHaveLength(0);
  } finally { supabase.from = original; clearSessionStore(); }
});