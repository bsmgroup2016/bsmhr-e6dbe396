export const IDENTITY_FIELDS = ["fin", "passportNumber", "employeeCode"] as const;
export type EmployeeIdentity = { id?: string; name?: string } & Partial<Record<typeof IDENTITY_FIELDS[number], string>>;
export type DuplicateEmployee = { employee: EmployeeIdentity; fields: typeof IDENTITY_FIELDS[number][] };
const normalize = (value?: string) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export function findEmployeeDuplicates(identity: EmployeeIdentity, employees: EmployeeIdentity[], ownId?: string): DuplicateEmployee[] {
  return employees.flatMap(employee => {
    if (ownId && employee.id === ownId) return [];
    const fields = IDENTITY_FIELDS.filter(field => {
      const value = normalize(identity[field]);
      return value.length > 0 && value !== "NA" && value !== "NONE" && value === normalize(employee[field]);
    });
    return fields.length ? [{ employee, fields }] : [];
  });
}