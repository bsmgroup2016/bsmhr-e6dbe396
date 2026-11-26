import { expect, test } from "bun:test";
import { loadSmtpTransport, SmtpRuntimeUnavailableError } from "./smtp-runtime.server";

test("local preview never loads the unsupported SMTP module", async () => {
  let loads = 0;
  const result = loadSmtpTransport(true, async () => { loads += 1; return {}; });
  await expect(result).rejects.toBeInstanceOf(SmtpRuntimeUnavailableError);
  expect(loads).toBe(0);
});

test("published runtime loads the SMTP transport once", async () => {
  let loads = 0;
  const transport = { connected: true };
  expect(await loadSmtpTransport(false, async () => { loads += 1; return transport; })).toBe(transport);
  expect(loads).toBe(1);
});

test("real provider failures remain failures, not preview restrictions", async () => {
  const failure = new Error("535 Authentication failed");
  await expect(loadSmtpTransport(false, async () => { throw failure; })).rejects.toBe(failure);
});