import { describe, test, expect } from "bun:test";
import { keyFromRef, registerObject, ObjectMetadataError } from "../lib/r2.server";
import { deletePFileReference } from "./p-file-deletion";
import { chatMessagePage, chatMessageQuery, mergeChatMessages } from "./chat-pagination";
import { auditPageRange, auditLogsQueryOptions } from "../lib/audit-log-data";

describe("Phase 2 file safety and history pagination", () => {
  test("stored proxy URL becomes the actual P-file object key", () => {
    expect(keyFromRef("/api/public/r2-file?key=p-files%2Femployee.pdf")).toBe("p-files/employee.pdf");
    expect(keyFromRef("https://hrbsm.xyz/api/public/r2-file?key=p-files%2Femployee.pdf")).toBe("p-files/employee.pdf");
    expect(keyFromRef("p-files/employee.pdf")).toBe("p-files/employee.pdf");
  });
  test("failed deletion retains the P-file reference", async () => {
    let reference: string | undefined = "p-files/employee.pdf";
    await expect(deletePFileReference(reference, async () => { throw new Error("Forbidden"); }, () => { reference = undefined; })).rejects.toThrow("Forbidden");
    expect(reference).toBe("p-files/employee.pdf");
  });
  test("successful deletion clears the reference only after storage succeeds", async () => {
    const calls: string[] = [];
    await deletePFileReference("p-files/employee.pdf", async (ref) => { calls.push(ref); }, () => calls.push("clear"));
    expect(calls).toEqual(["p-files/employee.pdf", "clear"]);
  });
  test("metadata failure rejects upload success without deleting an object", async () => {
    const original = globalThis.fetch;
    const oldKey = process.env.SB_SERVICE_ROLE_KEY;
    const methods: string[] = [];
    process.env.SB_SERVICE_ROLE_KEY = "unit-test-only";
    globalThis.fetch = Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => { methods.push(init?.method ?? "GET"); return new Response("private database error", { status: 500 }); }, { preconnect: original.preconnect });
    try {
      await expect(registerObject({ key: "p-files/test.pdf", folder: "p-files", original_name: "test.pdf", content_type: "application/pdf", size: 1, employee_id: null, uploaded_by: "test" })).rejects.toBeInstanceOf(ObjectMetadataError);
      expect(methods).toEqual(["POST"]);
    } finally { globalThis.fetch = original; if (oldKey === undefined) delete process.env.SB_SERVICE_ROLE_KEY; else process.env.SB_SERVICE_ROLE_KEY = oldKey; }
  });
  test("chat opens on latest messages even after more than 200", () => {
    const rows = Array.from({ length: 251 }, (_, i) => ({ id: String(251 - i).padStart(3, "0"), created_at: "2026-11-03T00:00:00Z" }));
    const page = chatMessagePage(rows.slice(0, 51));
    expect(page.messages.length).toBe(50); expect(page.messages[0]?.id).toBe("202"); expect(page.messages.at(-1)?.id).toBe("251"); expect(page.hasOlder).toBe(true);
    expect(page.nextCursor?.id).toBe("202");
  });
  test("older chat cursor uses timestamp and ID to avoid tied-row omissions", () => {
    const params = new URLSearchParams(chatMessageQuery("chat", { createdAt: "2026-11-03T00:00:00Z", id: "202" }).split("?")[1]);
    expect(params.get("order")).toBe("created_at.desc,id.desc");
    expect(params.get("or")).toBe("(created_at.lt.2026-11-03T00:00:00Z,and(created_at.eq.2026-11-03T00:00:00Z,id.lt.202))");
    expect(params.get("limit")).toBe("51");
  });
  test("polling retains older messages and does not duplicate existing ones", () => {
    const message = (id: string) => ({ id, created_at: "2026-11-03T00:00:00Z" });
    expect(mergeChatMessages([message("001"), message("002")], [message("002"), message("003")]).map((m) => m.id)).toEqual(["001", "002", "003"]);
    expect(chatMessagePage([message("001")]).hasOlder).toBe(false);
  });
  test("audit requests disjoint fixed 100-row ranges, not growing limits", () => {
    expect(auditPageRange(0)).toEqual([0, 99]); expect(auditPageRange(1)).toEqual([100, 199]); expect(auditPageRange(12)).toEqual([1200, 1299]);
    const filters = { page: 1, action: "all", entity: "all", from: "", to: "" };
    expect(auditLogsQueryOptions(filters, "first").queryKey).not.toEqual(auditLogsQueryOptions(filters, "second").queryKey);
  });
});