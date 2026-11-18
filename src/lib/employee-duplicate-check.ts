import { supabase } from "@/integrations/supabase/client";
import { findEmployeeDuplicates, type EmployeeIdentity } from "@/core/employee-duplicates";

/** Fresh narrow caller-RLS reads; never interpret an incomplete read as no duplicates. */
export async function checkEmployeeDuplicates(identity: EmployeeIdentity, ownId?: string) {
  const employees: EmployeeIdentity[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("employees").select("id,name,employee_code,fin,passport_number").order("id").range(offset, offset + pageSize - 1);
    if (error || !data) throw new Error("Could not check existing workers. Please retry before saving.");
    employees.push(...data.map(row => ({ id: row.id, name: row.name, employeeCode: row.employee_code, fin: row.fin, passportNumber: row.passport_number })));
    if (data.length < pageSize) break;
  }
  return findEmployeeDuplicates(identity, employees, ownId);
}