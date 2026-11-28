import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { isPwaPreviewHost, PWA_UPDATE_INTERVAL_MS, startPwaUpdateChecks } from "./pwa-policy";
import { applyPwaUpdate, isPwaUpdateReady, offerPwaUpdate } from "../lib/pwa-updates";

const source = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
// Exercise the literal options consumed by VitePWA, not a separate test-only copy.
const block = source.slice(source.indexOf("workbox: {") + "workbox: ".length, source.lastIndexOf("}),")).trim().replace(/,$/, "");
const config = new Function(`return (${block});`)() as { globPatterns: string[]; navigateFallback: null; skipWaiting: boolean; runtimeCaching: { handler: string; urlPattern: (input: { request: { mode: string }; url: URL; sameOrigin: boolean }) => boolean; options: { precacheFallback: { fallbackURL: string } } }[] };

describe("Phase 3 service-worker hardening", () => {
  test("only static assets and offline.html are precached", () => {
    expect(config.globPatterns).toEqual(["**/*.{js,css,woff,woff2,png,svg,ico}", "offline.html"]);
    expect(config.navigateFallback).toBeNull();
    expect(config.runtimeCaching.map((rule) => rule.handler)).toEqual(["NetworkOnly"]);
    expect(config.runtimeCaching[0]?.options.precacheFallback.fallbackURL).toBe("/offline.html");
  });
  test("offline fallback handles app navigation only, never APIs, Supabase or R2 requests", () => {
    const match = config.runtimeCaching[0]?.urlPattern;
    if (!match) throw new Error("Missing navigation rule");
    const input = (path: string, mode = "navigate", sameOrigin = true) => ({ request: { mode }, url: new URL(path, "https://hrbsm.xyz"), sameOrigin });
    expect(match(input("/dashboard"))).toBe(true);
    expect(match(input("/payroll"))).toBe(true); // network-only, never cached HTML
    for (const path of ["/api", "/api/public/live-chat", "/api/public/r2-file?key=x", "/api/public/r2-signed?key=x", "/_serverFn/x", "/~oauth"]) expect(match(input(path))).toBe(false);
    expect(match(input("https://supabase.bsmengg.com/rest/v1/employees", "cors", false))).toBe(false);
    expect(match(input("https://bucket.r2.cloudflarestorage.com/selfie.jpg?X-Amz-Signature=x", "no-cors", false))).toBe(false);
    expect(match(input("/api/public/v1/attendance", "cors"))).toBe(false);
  });
  test("ready updates wait for user consent", async () => {
    let applied = 0;
    offerPwaUpdate(async () => { applied++; });
    expect(isPwaUpdateReady()).toBe(true); expect(applied).toBe(0);
    await applyPwaUpdate(); expect(applied).toBe(1);
    expect(config.skipWaiting).toBe(false);
    expect(source).toContain('registerType: "prompt"');
  });
  test("long-open sessions check once every 60 minutes and skip while offline", async () => {
    let callback: (() => void) | undefined; let interval = 0; let checks = 0; let online = true;
    startPwaUpdateChecks({ update: async () => { checks++; } }, () => online, (fn, ms) => { callback = fn; interval = ms; return 0 as unknown as ReturnType<typeof setInterval>; });
    expect(interval).toBe(3_600_000); expect(PWA_UPDATE_INTERVAL_MS).toBe(3_600_000); expect(checks).toBe(0);
    if (!callback) throw new Error("No update timer");
    callback(); expect(checks).toBe(1); online = false; callback(); expect(checks).toBe(1);
  });
  test("preview and dev origins remain blocked while published domains remain eligible", () => {
    for (const host of ["id-preview--project.lovable.app", "id-preview-2--project.lovable.app", "preview-a--project.gpt-eng.com", "project--id-dev.lovable.app", "beta.lovable.dev"]) expect(isPwaPreviewHost(host)).toBe(true);
    for (const host of ["hrbsm.xyz", "www.hrbsm.xyz", "bsmhr.lovable.app"]) expect(isPwaPreviewHost(host)).toBe(false);
  });
});