import { expect, test } from "bun:test";
import { readApiResponse } from "./api-client";

test("gateway HTML 502 returns a safe failure instead of throwing or confirming a save", async () => {
  const result = await readApiResponse(new Response("<html><title>502: Bad gateway</title></html>", { status: 502, headers: { "Content-Type": "text/html" } }));
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Gateway error incorrectly confirmed a save");
  expect(result.error.code).toBe("service_unavailable");
});

test("malformed JSON and missing envelopes never count as successful writes", async () => {
  for (const body of ["{", "null", '{"ok":true}', '{"ok":false}', '{"data":{}}']) {
    expect((await readApiResponse(new Response(body))).ok).toBe(false);
  }
});

test("HTTP errors cannot report successful application data", async () => {
  expect((await readApiResponse(Response.json({ ok: true, data: { id: "attendance-1" } }, { status: 502 }))).ok).toBe(false);
});

test("valid saved attendance and application errors retain the API contract", async () => {
  expect(await readApiResponse(Response.json({ ok: true, data: { id: "attendance-1" }, meta: { total: 1 } }))).toEqual({ ok: true, data: { id: "attendance-1" }, meta: { total: 1 } });
  expect(await readApiResponse(Response.json({ ok: false, error: { code: "unauthorized", message: "Valid access token required" } }, { status: 401 }))).toEqual({ ok: false, error: { code: "unauthorized", message: "Valid access token required" } });
});