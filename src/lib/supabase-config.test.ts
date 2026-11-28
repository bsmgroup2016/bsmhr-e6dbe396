import { afterEach, expect, test } from "bun:test";
import { getBrowserSupabaseConfig, getSupabaseConfig } from "./supabase-config";
const originalUrl = process.env["SUPABASE_URL"];
const originalKey = process.env["SUPABASE_ANON_KEY"];
afterEach(() => {
  if (originalUrl === undefined) delete process.env["SUPABASE_URL"]; else process.env["SUPABASE_URL"] = originalUrl;
  if (originalKey === undefined) delete process.env["SUPABASE_ANON_KEY"]; else process.env["SUPABASE_ANON_KEY"] = originalKey;
});
test("defaults retain the existing public connection", () => {
  delete process.env["SUPABASE_URL"]; delete process.env["SUPABASE_ANON_KEY"];
  expect(getSupabaseConfig().url).toBe("https://supabase.bsmengg.com");
  expect(JSON.parse(atob(getSupabaseConfig().anonKey.split(".")[1] ?? "")).role).toBe("anon");
});
test("server overrides are read on every call, never captured at import", () => {
  process.env["SUPABASE_URL"] = "https://first.example/";
  process.env["SUPABASE_ANON_KEY"] = "public-first";
  expect(getSupabaseConfig()).toEqual({ url: "https://first.example", anonKey: "public-first" });
  process.env["SUPABASE_URL"] = "https://second.example";
  process.env["SUPABASE_ANON_KEY"] = "public-second";
  expect(getSupabaseConfig()).toEqual({ url: "https://second.example", anonKey: "public-second" });
});
test("browser configuration ignores server-only overrides", () => {
  const browser = getBrowserSupabaseConfig();
  process.env["SUPABASE_URL"] = "https://server-only.example";
  process.env["SUPABASE_ANON_KEY"] = "server-only-public-key";
  expect(getBrowserSupabaseConfig()).toEqual(browser);
});
