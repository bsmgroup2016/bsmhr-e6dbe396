import { expect, test } from "bun:test";
import { applyPunch } from "./attendance-punch.server";
import type { AuthContext } from "./api-v1.server";

const ctx: AuthContext = { userId: "worker-user", email: null, token: "test-token", roles: ["employee"], employeeId: "worker-1" };

test("direct portal check-in saves supported times/GPS without the absent event table", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; method: string; body?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: String(input), method: init?.method ?? "GET", body });
    return Response.json(body ? [{ id: "attendance-1", ...body }] : []);
  }) as typeof fetch;
  try {
    const result = await applyPunch(ctx, { date: "2026-11-18", checkIn: "07:00", lat: 1.35, lng: 103.82 }, "worker-1", "single");
    expect(result.status).toBe("saved");
    expect(calls.some(call => call.url.includes("attendance_events"))).toBe(false);
    expect(calls.find(call => call.method === "POST")?.body).toEqual({ employee_id: "worker-1", date: "2026-11-18", status: "Present", check_in: "07:00", check_in_lat: 1.35, check_in_lng: 103.82 });
    expect(result.attendance).toMatchObject({ id: "attendance-1", checkIn: "07:00" });
  } finally { globalThis.fetch = original; }
});

test("direct portal check-out updates the same attendance row and keeps check-in", async () => {
  const original = globalThis.fetch;
  let payload: Record<string, unknown> = {};
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    if (!init?.method) return Response.json([{ id: "attendance-1" }]);
    expect(init.method).toBe("PATCH");
    payload = JSON.parse(String(init.body));
    return Response.json([{ id: "attendance-1", check_in: "07:00", ...payload }]);
  }) as typeof fetch;
  try {
    const result = await applyPunch(ctx, { date: "2026-11-18", checkOut: "20:00" }, "worker-1", "single");
    expect(result.status).toBe("saved");
    expect(payload).toEqual({ employee_id: "worker-1", date: "2026-11-18", status: "Present", check_out: "20:00" });
    expect(result.attendance).toMatchObject({ checkIn: "07:00", checkOut: "20:00" });
  } finally { globalThis.fetch = original; }
});

test("queued and QR punches remain unavailable without their event/proof table", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json([]); }) as unknown as typeof fetch;
  try {
    for (const [source, event] of [
      ["mobile-offline", { checkIn: "07:00" }],
      ["single", { checkIn: "07:00", clientEventId: "event-1" }],
      ["single", { checkIn: "07:00", siteId: "site-1" }],
      ["single", { checkIn: "07:00", selfieKey: "selfies/1.jpg" }],
    ] as const) {
      expect((await applyPunch(ctx, event, "worker-1", source)).status).toBe("error");
    }
    expect(calls).toBe(0);
  } finally { globalThis.fetch = original; }
});

test("failed direct attendance writes never report success", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) =>
    init?.method ? Response.json({ message: "write denied" }, { status: 403 }) : Response.json([])) as typeof fetch;
  try {
    expect((await applyPunch(ctx, { date: "2026-11-18", checkIn: "07:00" }, "worker-1", "single")).status).toBe("error");
  } finally { globalThis.fetch = original; }
});