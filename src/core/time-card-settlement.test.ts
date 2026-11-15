import { expect, test } from "bun:test";
import type { TimeCard } from "@/lib/types";
import { canGenerateSettledCards, countedCardHours, isCardApproved, validCardHours } from "./time-card-settlement";

test("Verification counts 07:00 to 20:00 as 8 GW and 4 OT", () => {
  expect(countedCardHours({ date: "2026-11-04", checkIn: "07:00", checkOut: "20:00" })).toEqual({ normalHours: 8, otHours: 4 });
});

test("Edited GW and OT hours win in reviewed output including explicit zero", () => {
  expect(countedCardHours({ date: "2026-11-04", checkIn: "07:00", checkOut: "20:00", normalHours: 7.5, otHours: 0 })).toEqual({ normalHours: 7.5, otHours: 0 });
});

test("Corrected resolution uses system times while ignored entries contribute nothing", () => {
  const entry = { date: "2026-11-04", checkIn: "07:00", checkOut: "20:00" };
  expect(countedCardHours({ ...entry, resolution: "Corrected" }, { checkIn: "07:00", checkOut: "16:00" })).toEqual({ normalHours: 8, otHours: 0 });
  expect(countedCardHours({ ...entry, resolution: "Ignored", normalHours: 8, otHours: 4 })).toEqual({ normalHours: 0, otHours: 0 });
});

test("A batch above twenty cards cannot generate until every card is approved", () => {
  const cards: TimeCard[] = Array.from({ length: 25 }, (_, index) => ({ id: `${index}`, employeeId: `${index}`, periodStart: "2026-11-01", periodEnd: "2026-11-30", status: "Verified", entries: [{ date: "2026-11-04", normalHours: 8, otHours: 4, reviewApproved: index < 24 }] }));
  expect(canGenerateSettledCards(cards, 0)).toBe(false);
  const last = cards[24];
  if (!last) throw new Error("Missing final card");
  last.entries = last.entries.map(entry => ({ ...entry, reviewApproved: true }));
  expect(canGenerateSettledCards(cards, 0)).toBe(true);
  expect(canGenerateSettledCards(cards, 1)).toBe(false);
  last.status = "Draft";
  expect(isCardApproved(last)).toBe(false);
});

test("Invalid negative and nonfinite hours block approval", () => {
  expect(validCardHours([{ date: "2026-11-04", otHours: -1 }])).toBe(false);
  expect(validCardHours([{ date: "2026-11-04", normalHours: NaN }])).toBe(false);
  expect(validCardHours([{ date: "2026-11-04", normalHours: 8, otHours: 4 }])).toBe(true);
});
test("bulk approval cannot bypass explicit uncertainty review", () => {
  const card: TimeCard = { id: "c", employeeId: "", periodStart: "2026-11-01", periodEnd: "2026-11-30", status: "Verified", entries: [{ date: "2026-11-15", confidence: 0.45, reviewApproved: true, normalHours: 8, otHours: 3.5 }] };
  expect(canGenerateSettledCards([card], 0)).toBe(false);
  card.entries[0] = { ...card.entries[0], date: "2026-11-15", ocrReviewed: true };
  expect(canGenerateSettledCards([card], 0)).toBe(true);
});

test("A blank card date never inherits system hours unless Use System Time is explicitly selected", () => {
  const system = { hoursWorked: 8, overtimeHours: 4 };
  expect(countedCardHours({ date: "2026-11-15" }, system)).toEqual({ normalHours: 0, otHours: 0 });
  expect(countedCardHours({ date: "2026-11-15", resolution: "Corrected" }, system)).toEqual({ normalHours: 8, otHours: 4 });
});