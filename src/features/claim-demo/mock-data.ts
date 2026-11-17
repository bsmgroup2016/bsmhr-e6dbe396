import type { DayEntry, Worker } from "./types";

export const TEMPLATE_FILE = "Claim_Sheet_Blank.xlsx";
export const TEMPLATE_SHEET = "PENTA OCEAN";
export const MOCK_FILE = { name: "SING_TEC_F3_PROJECT_TIME_CARD_OCT_2026.pdf", size: "6.4 MB", pages: 4 };
export const MOCK_DETAILS = { client: "Penta Ocean", site: "JB-1183 (Finger 3 Project)", month: "2026-10" };
export const YEAR = 2026;
export const MONTH = 10;

const OT: Record<number, number | "OFF"> = {
  1: 3, 2: 3, 3: 3, 4: 0, 5: 3, 6: 3, 7: 2, 8: 2, 9: 3, 10: 3, 11: 0, 12: 3, 13: 5, 14: 5, 15: 5,
  16: 5, 17: 5, 18: 0, 19: 3, 20: 5, 21: 3, 22: 3, 23: 3, 24: 2, 25: "OFF",
  26: 3, 27: 3, 28: 3, 29: 3, 30: 3, 31: 3,
};

const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;

function buildDays(crossedUntil = 0): DayEntry[] {
  return Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    if (day <= crossedUntil) return { day, status: "crossed", inTime: null, outTime: null, g: null, ot: null };
    const ot = OT[day];
    if (ot === "OFF") return { day, status: "off", inTime: null, outTime: null, g: null, ot: null };
    return { day, status: "work", inTime: fmt(8), outTime: fmt(8 + 8 + ot + 1), g: 8, ot };
  });
}

export function mockWorkers(): Worker[] {
  return [
    { id: "w1", name: "ISLAM MD RAKIBUL", code: "580R", category: "Fire Watchman", address: "PC-34", flags: [], days: buildDays() },
    { id: "w2", name: "HOSSAIN MD ZAHID", code: "273P", category: "T.C.", address: "PC-195", flags: [{ field: "category", reason: "handwriting unclear" }], days: buildDays(15) },
    { id: "w3", name: "HOSER MD ROSUL", code: "530W", category: "Welder", address: "PC-219", flags: [{ field: "name", reason: "may be Hossen" }], days: buildDays() },
    { id: "w4", name: "FARAZI EMON", code: "637V", category: "Welder", address: "PC-222", flags: [], days: buildDays(15) },
  ];
}
