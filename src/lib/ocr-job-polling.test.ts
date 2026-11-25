import { expect, test } from "bun:test";
import { waitForOcrJob, consumeOcrJob, OcrPollingError } from "./ocr-job-polling";
const id = "00000000-0000-4000-8000-000000000001";
const rows = [{ date: "2026-11-01", normalHours: 8, otHours: 4, verifiedBy: "conflict" }];
const wait = async () => {};
test("temporary status failures recover the same saved result without a paid retry", async () => {
  let reads = 0;
  const result = await waitForOcrJob(id, { wait, status: async job => {
    expect(job).toBe(id);
    if (++reads <= 3) throw new Error("offline fixture");
    return { status: "complete", data: rows };
  } });
  expect(reads).toBe(4); expect(result).toEqual(rows);
});
test("a dropped heartbeat does not fail after the old three-poll cutoff", async () => {
  let reads = 0;
  const response = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify({ jobId: id }) + "\n")); c.close(); } }));
  expect(await consumeOcrJob(response, { wait, status: async () => ++reads < 8 ? { status: "running" } : { status: "complete", data: rows } })).toEqual(rows);
  expect(reads).toBe(8);
});
test("permission denials stop immediately rather than retrying or creating another job", async () => {
  let reads = 0;
  await expect(waitForOcrJob(id, { wait, status: async () => { reads++; throw new OcrPollingError("denied fixture"); } })).rejects.toThrow("denied fixture");
  expect(reads).toBe(1);
});
test("persistent network failures are bounded and leave the same job recoverable", async () => {
  let reads = 0;
  await expect(waitForOcrJob(id, { wait, status: async () => { reads++; throw new Error("offline fixture"); } })).rejects.toThrow("recover the same job");
  expect(reads).toBe(10);
});