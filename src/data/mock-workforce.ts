export type PassType = "Work Permit" | "S Pass" | "Employment Pass" | "Singaporean/PR";
export type EmployeeStatus = "Active" | "On Leave" | "Deployed" | "Inactive";

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  nationality: string;
  fin: string;
  passType: PassType;
  passExpiry: string; // ISO date
  trade: string;
  site: string | null;
  status: EmployeeStatus;
  basicSalary: number;
  joinedOn: string;
}

export const employees: Employee[] = [
  { id: "e1", employeeCode: "BSM-0001", name: "Mohammed Rahman", nationality: "Bangladesh", fin: "G1234567X", passType: "Work Permit", passExpiry: "2026-09-14", trade: "Welder", site: "Tuas Mega Port", status: "Deployed", basicSalary: 1450, joinedOn: "2023-03-11" },
  { id: "e2", employeeCode: "BSM-0002", name: "Arun Kumar", nationality: "India", fin: "G7654321Y", passType: "S Pass", passExpiry: "2027-02-28", trade: "Site Supervisor", site: "Jurong Island Ph.2", status: "Deployed", basicSalary: 3200, joinedOn: "2022-07-01" },
  { id: "e3", employeeCode: "BSM-0003", name: "Zaw Min Htet", nationality: "Myanmar", fin: "G2233445Z", passType: "Work Permit", passExpiry: "2026-08-05", trade: "Pipe Fitter", site: "Tuas Mega Port", status: "Active", basicSalary: 1380, joinedOn: "2024-01-22" },
  { id: "e4", employeeCode: "BSM-0004", name: "Lim Wei Sheng", nationality: "Singapore", fin: "S8812345A", passType: "Singaporean/PR", passExpiry: "-", trade: "Project Engineer", site: "Changi T5 Works", status: "Active", basicSalary: 5200, joinedOn: "2021-05-17" },
  { id: "e5", employeeCode: "BSM-0005", name: "Suresh Nair", nationality: "India", fin: "G3344556B", passType: "Work Permit", passExpiry: "2026-08-19", trade: "Scaffolder", site: null, status: "On Leave", basicSalary: 1300, joinedOn: "2023-11-02" },
  { id: "e6", employeeCode: "BSM-0006", name: "Chen Guo Qiang", nationality: "China", fin: "G4455667C", passType: "Work Permit", passExpiry: "2027-05-30", trade: "Rigger", site: "Jurong Island Ph.2", status: "Deployed", basicSalary: 1500, joinedOn: "2022-09-14" },
  { id: "e7", employeeCode: "BSM-0007", name: "Abdul Karim", nationality: "Bangladesh", fin: "G5566778D", passType: "Work Permit", passExpiry: "2026-12-01", trade: "General Worker", site: null, status: "Active", basicSalary: 1150, joinedOn: "2025-02-03" },
  { id: "e8", employeeCode: "BSM-0008", name: "Rajesh Pillai", nationality: "India", fin: "G6677889E", passType: "Employment Pass", passExpiry: "2028-01-15", trade: "QA/QC Manager", site: "Changi T5 Works", status: "Deployed", basicSalary: 6800, joinedOn: "2020-10-09" },
  { id: "e9", employeeCode: "BSM-0009", name: "Htun Naing", nationality: "Myanmar", fin: "G7788990F", passType: "Work Permit", passExpiry: "2026-07-31", trade: "Welder", site: "Tuas Mega Port", status: "Deployed", basicSalary: 1420, joinedOn: "2024-06-18" },
  { id: "e10", employeeCode: "BSM-0010", name: "Tan Boon Hock", nationality: "Singapore", fin: "S7723456B", passType: "Singaporean/PR", passExpiry: "-", trade: "Safety Officer", site: "Jurong Island Ph.2", status: "Active", basicSalary: 4400, joinedOn: "2019-04-25" },
  { id: "e11", employeeCode: "BSM-0011", name: "Mizanur Islam", nationality: "Bangladesh", fin: "G8899001G", passType: "Work Permit", passExpiry: "2027-03-22", trade: "Painter", site: null, status: "Inactive", basicSalary: 1200, joinedOn: "2023-08-30" },
  { id: "e12", employeeCode: "BSM-0012", name: "Vignesh Raja", nationality: "India", fin: "G9900112H", passType: "S Pass", passExpiry: "2026-10-11", trade: "Foreman", site: "Changi T5 Works", status: "Deployed", basicSalary: 3050, joinedOn: "2022-02-12" },
];

export const statusVariant: Record<EmployeeStatus, "success" | "info" | "warning" | "ghost"> = {
  Active: "success",
  Deployed: "info",
  "On Leave": "warning",
  Inactive: "ghost",
};

export function daysUntil(iso: string): number | null {
  if (!iso || iso === "-") return null;
  const today = new Date("2026-07-28T00:00:00+08:00");
  const target = new Date(`${iso}T00:00:00+08:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}