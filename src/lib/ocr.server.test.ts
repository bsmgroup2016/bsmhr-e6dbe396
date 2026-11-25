import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const calls: (string | undefined)[] = [];
let mode: "pair" | "brain" = "pair";
const card = (end: string) => ({ cards: [{ cardIndex: 1, year: 2026, month: 11, workerName: "OCR Fixture", employeeCode: "B-999", days: [{ day: 1, start: "0700", end, normal: 8, ot: end === "2000" ? 4 : 5 }] }] });

mock.module("@/lib/ai.server", () => ({
  askAiJson: async (request: { only?: string }) => {
    calls.push(request.only);
    if (mode === "brain" && request.only) throw new Error(`${request.only} OCR provider is not enabled`);
    return card(request.only === "openai" ? "2100" : "2000");
  },
}));
mock.module("@/lib/r2.server", () => ({ keyFromRef: (ref: string) => ref, presignGet: async () => "https://fixture.invalid/card" }));
const { readTimeCardLegacy: readTimeCard } = await import("./ocr.server");
const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls.length = 0;
  globalThis.fetch = Object.assign(async () => new Response("fixture-image", { headers: { "Content-Type": "image/png" } }), { preconnect: originalFetch.preconnect });
});
afterAll(() => { globalThis.fetch = originalFetch; mock.restore(); });

describe("OCR without Claude", () => {
  test("time-card disagreements stay flagged without any third-reader request", async () => {
    mode = "pair";
    const rows = await readTimeCard("time-cards/fixture.png");
    expect(calls).toEqual(["gemini", "openai"]);
    expect(rows[0]?.verifiedBy).toBe("conflict");
    expect(rows[0]?.checkOut).toBe("20:00");
    expect(rows[0]?.suggestion?.checkOut).toBe("21:00");
  });

  test("AI Brain fallback still runs when the built-in pair is disabled", async () => {
    mode = "brain";
    const rows = await readTimeCard("time-cards/fixture.png");
    expect(calls).toEqual(["gemini", "openai", undefined]);
    expect(rows[0]?.date).toBe("2026-11-01");
    expect(rows[0]?.checkOut).toBe("20:00");
  });
});