import { describe, expect, test } from "bun:test";
import { buildBody, askAiJson } from "./ai.server";
import { clearIntegrationCache, toProvider, type IntegrationRow } from "./api-integrations.server";

const brain = { name: "hr-brain", label: "AI Brain", url: "https://stbd.seobdshop.com/v1/chat/completions", apiKey: "fixture-only", model: "hr-brain", extra: {} };

describe("AI Brain OCR", () => {
  test("removed Claude OCR rows cannot resolve by endpoint, label or model", () => {
    const row: IntegrationRow = { id: "fixture", category: "ocr", label: "Reader", url: brain.url, model: "hr-brain", api_key: "fixture-only", env_key: null, priority: 1, enabled: true, updated_at: "2026-11-25" };
    expect(toProvider({ ...row, url: "https://api.anthropic.com/v1/messages" })).toBeNull();
    expect(toProvider({ ...row, label: "Claude" })).toBeNull();
    expect(toProvider({ ...row, model: "claude-sonnet" })).toBeNull();
    expect(toProvider(row)?.name).toBe("Reader");
    expect(toProvider({ ...row, category: "chatbot", label: "Claude" })?.name).toBe("Claude");
  });

  test("forwards an image with the OCR instructions and hr-brain model", () => {
    const body = buildBody(brain, { instruction: "Read the printed dates", dataUrl: "data:image/png;base64,fixture" });
    expect(body.model).toBe("hr-brain");
    expect(body).toMatchObject({ stream: false });
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body.messages[1]?.content).toEqual([
      { type: "text", text: "Read the printed dates" },
      { type: "image_url", image_url: { url: "data:image/png;base64,fixture" } },
    ]);
  });

  test("forwards PDFs as document file data, not plain text", () => {
    const body = buildBody(brain, { instruction: "Read the IPA", dataUrl: "data:application/pdf;base64,fixture" });
    expect(body.messages[1]?.content).toEqual([
      { type: "text", text: "Read the IPA" },
      { type: "file", file: { filename: "document.pdf", file_data: "data:application/pdf;base64,fixture" } },
    ]);
  });

  test("existing OpenAI OCR request behavior is unchanged", () => {
    const body = buildBody({ ...brain, name: "openai", model: "gpt-5.5" }, { instruction: "Read" });
    expect(body.model).toBe("gpt-5.5");
    expect(body).toMatchObject({ reasoning_effort: "high" });
    expect(body).not.toHaveProperty("stream");
  });

  test("only enabled AI Brain is called even when a stale Claude OCR row is enabled", async () => {
    const originalFetch = globalThis.fetch;
    const oldService = process.env['SB_SERVICE_ROLE_KEY'];
    const oldBrain = process.env['HR_BRAIN_API_KEY'];
    const called: string[] = [];
    process.env['SB_SERVICE_ROLE_KEY'] = "fixture-service";
    process.env['HR_BRAIN_API_KEY'] = "fixture-brain";
    clearIntegrationCache();
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.includes("/rest/v1/api_integrations")) {
        return Response.json([
          ...["Google Gemini", "OpenAI"].map((label, index) => ({ id: label, category: "ocr", label, enabled: false, priority: index + 1 })),
          { id: "claude", category: "ocr", label: "Claude", url: "https://api.anthropic.com/v1/messages", model: "claude-sonnet", api_key: "fixture-removed", priority: 3, enabled: true },
          { id: "brain", category: "ocr", label: "AI Brain", url: brain.url, model: "hr-brain", env_key: "HR_BRAIN_API_KEY", api_key: null, priority: 4, enabled: true },
        ]);
      }
      called.push(url);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture-brain");
      expect(JSON.parse(String(init?.body)).model).toBe("hr-brain");
      return Response.json({ choices: [{ message: { content: '{"employeeName":"OCR Fixture"}' } }] });
    }) as typeof fetch;
    try {
      expect(await askAiJson({ instruction: "Read", dataUrl: "data:image/png;base64,fixture" })).toEqual({ employeeName: "OCR Fixture" });
      expect(called).toEqual([brain.url]);
    } finally {
      globalThis.fetch = originalFetch;
      if (oldService === undefined) delete process.env['SB_SERVICE_ROLE_KEY']; else process.env['SB_SERVICE_ROLE_KEY'] = oldService;
      if (oldBrain === undefined) delete process.env['HR_BRAIN_API_KEY']; else process.env['HR_BRAIN_API_KEY'] = oldBrain;
      clearIntegrationCache();
    }
  });
});