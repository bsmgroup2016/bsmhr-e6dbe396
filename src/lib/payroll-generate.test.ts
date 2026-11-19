import { expect, test } from "bun:test";
import { supabase } from "@/integrations/supabase/client";
import {
  addLeaveRequest,
  clearSessionStore,
  generatePayrollForMonth,
  getPayrollByEmployee,
  saveEmployeeConfirmed,
} from "./store";

function mockSupabaseOk() {
  const original = supabase.from;
  supabase.from = (() => {
    const query = (payload?: Record<string, unknown> | Record<string, unknown>[]) => {
      const row = Array.isArray(payload) ? payload[0] : payload;
      const result = () => ({ data: row ?? null, error: null });
      const chain: Record<string, unknown> = {};
      chain.eq = () => chain;
      chain.select = () => ({ single: async () => result(), then: (r: (v: unknown) => void) => r(result()) });
      chain.then = (r: (v: unknown) => void) => r(result());
      return chain;
    };
    return {
      insert: (payload: Record<string, unknown>[]) => query(payload),
      update: (payload: Record<string, unknown>) => query(payload),
      delete: () => query(),
      upsert: (payload: Record<string, unknown>) => query(payload),
    };
  }) as unknown as typeof supabase.from;
  return () => { supabase.from = original; };
}

test("auto-generated payroll deducts unpaid leave exactly once", async () => {
  const restore = mockSupabaseOk();
  clearSessionStore();
  try {
    const emp = await saveEmployeeConfirmed({
      employeeCode: "P-900",
      name: "TEST WORKER",
      companyId: "pluto",
      department: "Construction",
      basicSalary: 2600,
      nationality: "Bangladesh",
      fin: "G900",
      passType: "Work Permit",
      status: "Active",
      trade: "Welder",
      joinedOn: "2026-01-01",
    });
    // 2 approved unpaid days inside 2026-11 (Mon 2 Nov + Tue 3 Nov)
    addLeaveRequest({
      employeeId: emp.id,
      type: "Unpaid Leave",
      startDate: "2026-11-02",
      endDate: "2026-11-03",
      status: "Approved",
      reason: "test",
    });

    const result = generatePayrollForMonth("2026-11");
    expect(result.created).toBe(1);

    const entry = getPayrollByEmployee(emp.id)[0];
    const dailyRate = 2600 / 26; // 100
    const unpaidDeduction = 2 * dailyRate; // 200
    expect(entry.otherDeductions).toBe(200);
    expect(entry.deductions).toBe(unpaidDeduction);
    // Foreign worker on Work Permit: no CPF/SHG, so net = basic - unpaid deduction (counted once)
    expect(entry.cpfEmployee).toBe(0);
    expect(entry.shgAmount).toBe(0);
    expect(entry.netPay).toBe(2600 - unpaidDeduction);
  } finally {
    restore();
    clearSessionStore();
  }
});
