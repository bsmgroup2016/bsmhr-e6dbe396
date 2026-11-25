import { expect, test, mock } from "bun:test";

const calls: string[] = [];
let verified = true;
mock.module("./r2.server", () => ({
  r2BucketClient: (id: string) => ({ base: `https://${id}`, client: { fetch: async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method} ${url}`);
    if (init?.method === "HEAD") return new Response(null, { status: verified ? 404 : 200 });
    return new Response(null, { status: 204 });
  } } }),
  unregisterObject: async () => { calls.push("metadata removed"); },
  registerObject: async () => {},
  uploadAllowance: async () => ({ maxBytes: 25 * 1024 * 1024, dailyLimit: 500 }),
  uploadsToday: async () => 0,
}));
const { deleteMedia } = await import("./media-management.server");
const request = (key: string) => new Request("http://localhost/media", { method: "DELETE", body: JSON.stringify({ bucket: "scans", key }) });

test("media removal never deletes a claim template", async () => {
  calls.length = 0;
  expect((await deleteMedia(request("claim-templates/current.xlsx"))).status).toBe(409);
  expect(calls).toEqual([]);
});
test("media removal deletes only the chosen bucket and verifies absence", async () => {
  calls.length = 0; verified = true;
  expect((await deleteMedia(request("time-cards/demo.pdf"))).status).toBe(200);
  expect(calls).toEqual(["DELETE https://scans/time-cards/demo.pdf", "HEAD https://scans/time-cards/demo.pdf", "HEAD https://main/time-cards/demo.pdf", "metadata removed"]);
});
test("unverified deletion retains metadata and reports failure", async () => {
  calls.length = 0; verified = false;
  expect((await deleteMedia(request("time-cards/demo.pdf"))).status).toBe(502);
  expect(calls.includes("metadata removed")).toBe(false);
});