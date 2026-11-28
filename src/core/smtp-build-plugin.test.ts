import { expect, test } from "bun:test";
import { rolldown } from "rolldown";
import { smtpNativeImportPlugin } from "./smtp-build-plugin";

test("native sockets use an adapter bridge, never an eager external import", () => {
  const plugin = smtpNativeImportPlugin();
  expect(plugin.resolveId("cloudflare:sockets")).toBe("\0smtp-socket-bridge");
  expect(plugin.resolveId("worker-mailer")).toEndWith("/worker-mailer/dist/index.mjs");
  expect(plugin.resolveId("cloudflare:other")).toBeNull();
});

test("both mailers bundle without a native Cloudflare import in the Node graph", async () => {
  const bundle = await rolldown({
    input: "node_modules/worker-mailer/dist/index.mjs",
    platform: "node",
    plugins: [smtpNativeImportPlugin()],
  });
  try {
    const result = await bundle.generate({ format: "esm" });
    const chunks = result.output.filter((item) => item.type === "chunk");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.flatMap((chunk) => chunk.imports)).not.toContain("cloudflare:sockets");
    expect(chunks.flatMap((chunk) => chunk.imports)).not.toContain("worker-mailer");
    expect(chunks.some((chunk) => chunk.code.includes("getWorkerConnect"))).toBe(true);
  } finally {
    await bundle.close();
  }
});