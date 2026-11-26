import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ActiveProvider } from "./api-integrations.server";

let providers: ActiveProvider[] = [];
let received: { router: ActiveProvider | null; geminiKey: string; openaiKey: string } | null = null;
const provider = (name: string, url: string): ActiveProvider => ({ id: name, name, url, key: `fixture-${name}`, model: "fixture", extra: {} });
mock.module("./api-integrations.server", () => ({ activeProviders: async (category: string) => category === "ocr" ? providers : [] }));
mock.module("./time-card-consensus.server", () => ({ verifyTimeCardConsensus: async (_data: string, deps: NonNullable<typeof received>) => {
  received = deps;
  return [{ row: { card_index: 1, employee_name: "Fixture Worker", date: "2026-11-01", in_time: "07:00", out_time: "20:00", break_minutes: 60, reported_total_hours: 12, confidence: 0.95, employee_code: "B-999", fin: null, site_name: "Fixture Site", normal_hours: 8, ot_hours: 4 }, calculated_hours: 12, flagged_fields: [], tie_breaker_failed: false }];
} }));
mock.module("./r2.server", () => ({ keyFromRef: (ref: string) => ref, presignGet: async () => "https://fixture.invalid/card" }));
const { readTimeCard } = await import("./ocr.server");
const originalFetch = globalThis.fetch;
beforeEach(() => {
  received = null;
  providers = [provider("router", "https://hr.seobdshop.com/v1/chat/completions"), provider("gemini", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"), provider("openai", "https://api.openai.com/v1/chat/completions")];
  globalThis.fetch = Object.assign(async () => new Response("fixture", { headers: { "Content-Type": "image/png" } }), { preconnect: originalFetch.preconnect });
});
afterAll(() => { globalThis.fetch = originalFetch; mock.restore(); });
describe("active consensus dispatch", () => {
  test("uses Settings overrides and preserves the claim-row contract and hours", async () => {
    const rows = await readTimeCard("time-cards/fixture.png");
    expect(received).toEqual({ router: providers[0], geminiKey: "fixture-gemini", openaiKey: "fixture-openai" });
    expect(rows[0]).toMatchObject({ date: "2026-11-01", employeeCode: "B-999", normalHours: 8, otHours: 4, verifiedBy: "gemini-4-carbon" });
  });
  test("disabled mandatory Gemini cannot fall back to unverified router output", async () => {
    providers = providers.filter(p => p.name !== "gemini");
    await expect(readTimeCard("time-cards/fixture.png")).rejects.toThrow("Official Gemini OCR must be enabled");
    expect(received).toBeNull();
  });
  test("disabled OpenAI supplies no credential to the targeted verifier", async () => {
    providers = providers.filter(p => p.name !== "openai");
    await readTimeCard("time-cards/fixture.png");
    expect(received).toMatchObject({ openaiKey: "", geminiKey: "fixture-gemini" });
  });
});