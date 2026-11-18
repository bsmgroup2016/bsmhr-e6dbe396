import { expect, test } from "bun:test";
import { ensureWorkerAccount } from "./worker-accounts.server";

test("a linked worker keeps their existing account and password", async () => {
  const original = globalThis.fetch;
  const originalKey = process.env["SB_SERVICE_ROLE_KEY"];
  process.env["SB_SERVICE_ROLE_KEY"] = "test-only";
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return Response.json([{ id: "worker-1", name: "John Smith", user_id: "existing-user" }]);
  }) as unknown as typeof fetch;
  try {
    expect(await ensureWorkerAccount("worker-1")).toEqual({ employeeId: "worker-1", userId: "existing-user", created: false });
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = original;
    if (originalKey === undefined) delete process.env["SB_SERVICE_ROLE_KEY"];
    else process.env["SB_SERVICE_ROLE_KEY"] = originalKey;
  }
});

test("new worker gets employee-only role and confirmed link without exposing password", async () => {
  const original = globalThis.fetch;
  const originalKey = process.env["SB_SERVICE_ROLE_KEY"];
  process.env["SB_SERVICE_ROLE_KEY"] = "test-only";
  const workerId = "12345678-1234-1234-1234-123456789abc";
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (init?.method) {
      const body = JSON.parse(String(init.body));
      if (path.includes("/auth/v1/admin/users")) {
        // Assert privately: never capture or print generated credentials in test output.
        if (typeof body.password !== "string" || body.password.length < 16 || body.password === "1234") throw new Error("Unsafe password generated");
        return Response.json({ id: "new-user" });
      }
      writes.push({ path, body });
      return Response.json(path.includes("employees?") ? [{ id: workerId, user_id: "new-user" }] : []);
    }
    return Response.json([{ id: workerId, name: "John Smith", phone: null, email: null, user_id: null }]);
  }) as unknown as typeof fetch;
  try {
    const result = await ensureWorkerAccount(workerId);
    expect(result.userId).toBe("new-user");
    expect("password" in result).toBe(false);
    expect(writes.find(write => write.path.includes("user_roles?"))?.body).toEqual({ user_id: "new-user", role: "employee" });
    expect(writes.find(write => write.path.includes("employees?"))?.body).toEqual({ user_id: "new-user" });
  } finally {
    globalThis.fetch = original;
    if (originalKey === undefined) delete process.env["SB_SERVICE_ROLE_KEY"];
    else process.env["SB_SERVICE_ROLE_KEY"] = originalKey;
  }
});