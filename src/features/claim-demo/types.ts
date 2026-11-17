export type DayStatus = "work" | "off" | "crossed" | "none";
export interface DayEntry {
  day: number;
  status: DayStatus;
  inTime: string | null;
  outTime: string | null;
  g: number | null;
  ot: number | null;
}
export interface FieldFlag { field: "name" | "code" | "category" | "address"; reason: string }
export interface Worker {
  id: string;
  name: string;
  code: string;
  category: string;
  address: string;
  flags: FieldFlag[];
  days: DayEntry[];
  site: string;
  preview: string;
  isPdf: boolean;
  fileName: string;
}
export interface ClaimDetails { client: string; site: string; month: string }
