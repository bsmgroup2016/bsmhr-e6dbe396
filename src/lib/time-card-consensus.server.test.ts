import { describe, expect, test } from "bun:test";
import { buildGeminiRequest, buildOpenAiRequest, verifyTimeCardConsensus, CARBON_MODEL, SOL_MODEL, ROUTER_TIMEOUT_MS, TARGETED_STATIC_PROMPT, type ConsensusDependencies } from "./time-card-consensus.server";
import type { FlatTimeCard } from "@/core/time-card-consensus";

const image = "data:image/png;base64,Zml4dHVyZQ==";
const row: FlatTimeCard = { card_index: 1, employee_name: "Fixture Worker", employee_code: "B-999", fin: null, site_name: "Fixture Site", date: "2026-11-01", in_time: "07:00", out_time: "20:00", break_minutes: 60, reported_total_hours: 12, confidence: 0.9, normal_hours: 8, ot_hours: 4 };
const router = { id: "fixture", name: "AI Brain", url: "https://stbd.seobdshop.com/v1/chat/completions", key: "fixture-router", model: "hr-brain", extra: {} };
const completion = (data: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(data) } }] });
const google = (rows: FlatTimeCard[]) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rows }) }] } }] });

function harness(handle: (url: string, body: Record<string, any>) => Response | Promise<Response>) {
  const calls: { url: string; body: Record<string, any> }[] = [];
  const send = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), body = JSON.parse(String(init?.body)) as Record<string, any>;
    calls.push({ url, body });
    return handle(url, body);
  }, { preconnect: fetch.preconnect });
  const deps: ConsensusDependencies = { router, geminiKey: "fixture-google", openaiKey: "fixture-openai", fetch: send };
  return { deps, calls };
}

describe("prepared backend consensus OCR", () => {
  test("the initial router deadline is exactly 30 seconds", () => {
    expect(ROUTER_TIMEOUT_MS).toBe(30_000);
  });
  test("uses mandatory official gemini-4-carbon with high-resolution structured JSON", () => {
    const body = buildGeminiRequest(image, null);
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", mediaResolution: "MEDIA_RESOLUTION_HIGH", thinkingConfig: { thinkingLevel: "HIGH" } });
    expect(body.generationConfig.responseJsonSchema.properties.rows.items.additionalProperties).toBe(false);
    expect(CARBON_MODEL).toBe("gemini-4-carbon");
  });
  test("uses gpt-6.2-sol, high effort, strict flagged-only output and a 300-token cap", () => {
    const body = buildOpenAiRequest(image, row, null, ["out_time"]);
    expect(body).toMatchObject({ model: "gpt-6.2-sol", reasoning_effort: "high", max_completion_tokens: 300 });
    expect(SOL_MODEL).toBe("gpt-6.2-sol");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.required).toEqual(["out_time"]);
    expect(Object.keys(body.response_format.json_schema.schema.properties)).toEqual(["out_time"]);
  });
  test("keeps the static cache prefix identical across changed rows and targets", () => {
    const a = buildOpenAiRequest(image, row, null, ["out_time"]);
    const b = buildOpenAiRequest(image, { ...row, employee_name: "Other fixture" }, row, ["employee_name"]);
    expect(a.messages[0]?.content).toBe(TARGETED_STATIC_PROMPT);
    expect(a.messages[0]?.content).toBe(b.messages[0]?.content);
    expect(a.messages[1]?.content).not.toEqual(b.messages[1]?.content);
  });
  test("skips OpenAI completely when router and mandatory Gemini agree", async () => {
    const h = harness(url => url.includes("googleapis.com") ? google([row]) : completion({ rows: [row] }));
    const results = await verifyTimeCardConsensus(image, h.deps);
    expect(h.calls.map(call => call.url)).toEqual([router.url, `https://generativelanguage.googleapis.com/v1beta/models/gemini-4-carbon:generateContent`]);
    expect(results[0]).toMatchObject({ calculated_hours: 12, flagged_fields: [], tie_breaker_failed: false });
  });
  test("router 429, timeout or invalid JSON moves to mandatory Gemini without failing", async () => {
    for (const failure of ["rate", "timeout", "json"] as const) {
      const h = harness(url => {
        if (url.includes("googleapis.com")) return google([row]);
        if (failure === "rate") return new Response(null, { status: 429 });
        if (failure === "timeout") throw new DOMException("Fixture timeout", "TimeoutError");
        return Response.json({ choices: [{ message: { content: "not JSON" } }] });
      });
      const results = await verifyTimeCardConsensus(image, h.deps);
      expect(h.calls).toHaveLength(2);
      expect(results[0]?.flagged_fields).toEqual([]);
      expect(h.calls[1]?.body.contents[0].parts[1].text).toBe("ninerouter_json: null");
    }
  });
  test("flagged disagreement alone triggers OpenAI and superseded router values stay superseded", async () => {
    const h = harness(url => url.includes("googleapis.com") ? google([row]) : url.includes("api.openai.com") ? completion({ employee_name: row.employee_name }) : completion({ rows: [{ ...row, employee_name: "Disputed fixture" }] }));
    const results = await verifyTimeCardConsensus(image, h.deps);
    expect(h.calls).toHaveLength(3);
    expect(h.calls[2]?.body.response_format.json_schema.schema.required).toEqual(["employee_name"]);
    expect(results[0]?.flagged_fields).toEqual([]);
    expect(results[0]?.row.employee_name).toBe("Fixture Worker");
  });
  test("OpenAI failure preserves Gemini readings and leaves the row flagged", async () => {
    const h = harness(url => url.includes("googleapis.com") ? google([{ ...row, employee_name: null }]) : url.includes("api.openai.com") ? new Response(null, { status: 401 }) : completion({ rows: [row] }));
    const results = await verifyTimeCardConsensus(image, h.deps);
    expect(results[0]).toMatchObject({ tie_breaker_failed: true, row: { employee_name: null } });
    expect(results[0]?.flagged_fields).toContain("employee_name");
  });
  test("mandatory Gemini authentication or missing-model failure never accepts router output", async () => {
    for (const status of [401, 404]) {
      const h = harness(url => url.includes("googleapis.com") ? new Response(null, { status }) : completion({ rows: [row] }));
      await expect(verifyTimeCardConsensus(image, h.deps)).rejects.toThrow("Gemini OCR");
      expect(h.calls).toHaveLength(2);
      expect(h.calls.some(call => call.url.includes("api.openai.com"))).toBe(false);
    }
  });
  test("missing worked dates cannot be silently dropped by the verifier", async () => {
    const h = harness(url => url.includes("googleapis.com") ? google([row]) : completion({ rows: [row, { ...row, date: "2026-11-02" }] }));
    await expect(verifyTimeCardConsensus(image, h.deps)).rejects.toThrow("every initially recorded date");
  });
  test("unrequested OpenAI edits are rejected rather than altering verified fields", async () => {
    const h = harness(url => url.includes("googleapis.com") ? google([row]) : url.includes("api.openai.com") ? completion({ employee_name: row.employee_name, ot_hours: 99 }) : completion({ rows: [{ ...row, employee_name: "Disputed fixture" }] }));
    const result = await verifyTimeCardConsensus(image, h.deps);
    expect(result[0]?.tie_breaker_failed).toBe(true);
    expect(result[0]?.row.ot_hours).toBe(4);
  });
});
