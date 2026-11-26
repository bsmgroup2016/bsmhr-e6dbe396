import { expect, test } from "bun:test";
import { rolldown } from "rolldown";
import { smtpNativeImportPlugin } from "./smtp-build-plugin";

test("only the native socket is external, never the SMTP npm package", () => {
  const plugin = smtpNativeImportPlugin();
  expect(plugin.resolveId("cloudflare:sockets")).toEqual({ id: "cloudflare:sockets", external: true });
  expect(plugin.resolveId("worker-mailer")).toBeNull();
  expect(plugin.resolveId("cloudflare:other")).toBeNull();
});

test("final production bundling preserves native sockets and embeds the mailer", async () => {
  const bundle = await rolldown({
    input: "node_modules/worker-mailer/dist/index.mjs",
    plugins: [smtpNativeImportPlugin()],
  });
  try {
    const result = await bundle.generate({ format: "esm" });
    const chunks = result.output.filter((item) => item.type === "chunk");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.flatMap((chunk) => chunk.imports)).toContain("cloudflare:sockets");
    expect(chunks.flatMap((chunk) => chunk.imports)).not.toContain("worker-mailer");
    expect(chunks.some((chunk) => chunk.code.includes("WorkerMailer"))).toBe(true);
  } finally {
    await bundle.close();
  }
});