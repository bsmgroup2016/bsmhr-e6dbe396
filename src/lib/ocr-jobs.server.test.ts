import { describe, expect, test } from "bun:test";
import { createOcrJob, readOwnedOcrJob, runOcrJob, ocrJobResponse, r2ObjectTag, type OcrJob, type OcrJobStore } from "./ocr-jobs.server";
import { consumeOcrJob } from "./ocr-job-polling";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const rows = [{ cardIndex: 1, date: "2026-11-01", workerName: "Fixture Worker", normalHours: 8, otHours: 4, confidence: 0.9, verifiedBy: "fixture" }];
function memoryStore() {
  const values = new Map<string, OcrJob>(), writes: string[] = [];
  const store: OcrJobStore = { read: async id => values.get(id) ?? null, write: async job => { values.set(job.id, structuredClone(job)); writes.push(job.status); } };
  return { store, writes, values };
}

describe("private R2 OCR job contract", () => {
  test("compressed read tags retain the strong object tag needed by conditional writes", () => {
    expect(r2ObjectTag('W/"fixture-object-tag"')).toBe('"fixture-object-tag"');
    expect(r2ObjectTag('"fixture-object-tag"')).toBe('"fixture-object-tag"');
    expect(r2ObjectTag(null)).toBeNull();
  });
  test("a repeated request id reuses completed output and never reads OCR twice", async () => {
    const h = memoryStore(), id = "00000000-0000-4000-8000-000000000003";
    let executions = 0;
    const read = async () => { executions++; return rows; };
    const first = await createOcrJob(owner, "time-cards/fixture.png", h.store, id);
    await runOcrJob(first, read, h.store);
    const repeat = await createOcrJob(owner, "time-cards/fixture.png", h.store, id);
    expect((await runOcrJob(repeat, read, h.store)).data).toEqual(rows);
    expect(executions).toBe(1);
    await expect(createOcrJob(other, "time-cards/fixture.png", h.store, id)).rejects.toThrow("could not be verified");
  });
  test("two executions share an atomic claim and start only one reader", async () => {
    const h = memoryStore();
    h.store.claim = async job => {
      const saved = h.values.get(job.id);
      if (!saved || saved.status !== "queued") return null;
      const running = { ...saved, status: "running" as const }; h.values.set(job.id, running); return running;
    };
    const job = await createOcrJob(owner, "time-cards/fixture.png", h.store);
    let executions = 0;
    await Promise.all([runOcrJob(job, async () => { executions++; return rows; }, h.store), runOcrJob(job, async () => { executions++; return rows; }, h.store)]);
    expect(executions).toBe(1);
  });
  test("only the job owner can read results", async () => {
    const h = memoryStore(), job = await createOcrJob(owner, "time-cards/fixture.png", h.store);
    expect((await readOwnedOcrJob(job.id, owner, h.store))?.source).toBe("time-cards/fixture.png");
    expect(await readOwnedOcrJob(job.id, other, h.store)).toBeNull();
  });
  test("success is reported only after running and final result writes succeed", async () => {
    const h = memoryStore(), job = await createOcrJob(owner, "time-cards/fixture.png", h.store);
    await runOcrJob(job, async () => rows, h.store);
    expect(h.writes).toEqual(["queued", "running", "complete"]);
    expect((await readOwnedOcrJob(job.id, owner, h.store))?.data).toEqual(rows);
  });
  test("provider failure persists a failed job, not empty successful rows or raw upstream secrets", async () => {
    const h = memoryStore(), job = await createOcrJob(owner, "time-cards/fixture.png", h.store);
    const result = await runOcrJob(job, async () => { throw new Error("Fixture upstream secret must not escape"); }, h.store);
    expect(result.status).toBe("failed");
    expect(result.data).toBeUndefined();
    expect(result.error).not.toContain("Fixture upstream secret");
  });
  test("initial storage failure prevents starting a job", async () => {
    const store: OcrJobStore = { read: async () => null, write: async () => { throw new Error("fixture write failed"); } };
    await expect(createOcrJob(owner, "time-cards/fixture.png", store)).rejects.toThrow("fixture write failed");
  });
  test("heartbeat and authenticated polling return the unchanged claim rows end to end", async () => {
    const h = memoryStore(), job = await createOcrJob(owner, "time-cards/fixture.png", h.store);
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let registrations = 0;
    const request = Object.assign(new Request("http://localhost:8080/api/public/ocr"), { waitUntil: (_task: Promise<unknown>) => { registrations++; } });
    const response = ocrJobResponse(request, job, async () => { await gate; return rows; }, h.store);
    expect(response.status).toBe(202);
    let polls = 0;
    const result = await consumeOcrJob(response, {
      status: async id => {
        polls++;
        if (polls === 2) release?.();
        const snapshot = await readOwnedOcrJob(id, owner, h.store);
        if (!snapshot) throw new Error("Fixture job missing");
        return snapshot;
      },
      wait: () => new Promise(resolve => setTimeout(resolve, 1)),
    });
    expect(result).toEqual(rows);
    expect(registrations).toBe(1);
    expect(h.writes).toEqual(["queued", "running", "complete"]);
  });
  test("polling a failed job rejects without invoking another paid OCR run", async () => {
    const h = memoryStore(), job = await createOcrJob(owner, "time-cards/fixture.png", h.store);
    let executions = 0;
    const response = ocrJobResponse(new Request("http://localhost:8080/api/public/ocr"), job, async () => { executions++; throw new Error("fixture failure"); }, h.store);
    await expect(consumeOcrJob(response, { status: async id => {
      const state = await h.store.read(id);
      if (!state) throw new Error("Fixture missing");
      return state;
    }, wait: () => new Promise(resolve => setTimeout(resolve, 1)) })).rejects.toThrow("OCR could not complete");
    expect(executions).toBe(1);
  });
});
