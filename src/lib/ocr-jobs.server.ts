import { z } from "zod";
import { r2Client } from "./r2.server";
import type { ReadRow } from "@/core/time-card-read";

const jobSchema = z.object({ id: z.string().uuid(), owner: z.string().uuid(), source: z.string(), createdAt: z.number(), updatedAt: z.number(), status: z.enum(["queued", "running", "complete", "failed"]), data: z.array(z.unknown()).optional(), error: z.string().optional() });
export type OcrJob = z.infer<typeof jobSchema>;
export interface OcrJobStore {
  read(id: string): Promise<OcrJob | null>; write(job: OcrJob): Promise<void>;
  create?: (job: OcrJob) => Promise<void>;
  claim?: (job: OcrJob) => Promise<OcrJob | null>;
}
const idSchema = z.string().uuid();
export function r2ObjectTag(header: string | null): string | null { return header?.replace(/^W\//, "") ?? null; }
function path(id: string) { return `ocr-jobs/${idSchema.parse(id)}.json`; }
export const r2OcrJobStore: OcrJobStore = {
  async create(job) {
    const { client, base } = r2Client("ocr-jobs");
    const response = await client.fetch(`${base}/${path(job.id)}`, { method: "PUT", headers: { "Content-Type": "application/json", "If-None-Match": "*" }, body: JSON.stringify(jobSchema.parse(job)) });
    if (!response.ok && response.status !== 412) throw new Error("OCR job could not be created");
  },
  async claim(job) {
    const { client, base } = r2Client("ocr-jobs"), url = `${base}/${path(job.id)}`;
    const current = await client.fetch(url);
    if (!current.ok) throw new Error("OCR job could not be read");
    // HTTP compression may weaken the read ETag; R2 conditional PUT needs the object tag.
    const etag = r2ObjectTag(current.headers.get("etag")), saved = jobSchema.parse(await current.json());
    if (saved.status !== "queued" || saved.owner !== job.owner || saved.source !== job.source) return null;
    if (!etag) throw new Error("OCR job lock could not be verified");
    const running: OcrJob = { ...saved, status: "running", updatedAt: Date.now() };
    const response = await client.fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": etag }, body: JSON.stringify(running) });
    if (response.status === 412) return null;
    if (!response.ok) throw new Error("OCR job lock could not be saved");
    const check = await client.fetch(url);
    if (!check.ok || await check.text() !== JSON.stringify(running)) throw new Error("OCR job lock read-back failed");
    return running;
  },
  async read(id) {
    const { client, base } = r2Client("ocr-jobs");
    const response = await client.fetch(`${base}/${path(id)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("OCR progress could not be read");
    return jobSchema.parse(await response.json());
  },
  async write(job) {
    const value = jobSchema.parse(job), { client, base } = r2Client("ocr-jobs");
    const body = JSON.stringify(value);
    const response = await client.fetch(`${base}/${path(job.id)}`, { method: "PUT", headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body });
    if (!response.ok) throw new Error("OCR progress could not be saved");
    const check = await client.fetch(`${base}/${path(job.id)}`);
    if (!check.ok || await check.text() !== body) throw new Error("OCR progress read-back failed");
  },
};

export async function createOcrJob(owner: string, source: string, store: OcrJobStore = r2OcrJobStore, requestedId?: string): Promise<OcrJob> {
  const now = Date.now();
  const job: OcrJob = { id: requestedId ? idSchema.parse(requestedId) : crypto.randomUUID(), owner, source, createdAt: now, updatedAt: now, status: "queued" };
  if (store.create) await store.create(job);
  else {
    const existing = await store.read(job.id);
    if (!existing) await store.write(job);
  }
  const saved = await store.read(job.id);
  if (!saved || saved.owner !== owner || saved.source !== source) throw new Error("OCR job reference could not be verified");
  return saved;
}
export async function readOwnedOcrJob(id: string, owner: string, store: OcrJobStore = r2OcrJobStore): Promise<OcrJob | null> {
  const job = await store.read(id);
  if (!job || job.owner !== owner || Date.now() - job.createdAt > 24 * 60 * 60 * 1000) return null;
  return job;
}

export async function runOcrJob(job: OcrJob, read: (source: string) => Promise<ReadRow[]>, store: OcrJobStore = r2OcrJobStore): Promise<OcrJob> {
  const existing = await store.read(job.id);
  if (!existing || existing.owner !== job.owner || existing.source !== job.source) throw new Error("OCR job reference could not be verified");
  if (existing.status !== "queued") return existing;
  let running: OcrJob;
  if (store.claim) {
    const claimed = await store.claim(existing);
    if (!claimed) return (await store.read(job.id)) ?? existing;
    running = claimed;
  } else { running = { ...existing, status: "running", updatedAt: Date.now() }; await store.write(running); }
  let final: OcrJob;
  try {
    const data = await read(job.source);
    final = { ...running, status: "complete", updatedAt: Date.now(), data };
  } catch (error) {
    // Persist only safe app-level errors, never raw upstream bodies/headers.
    const message = error instanceof Error ? error.message : "OCR could not complete";
    const safe = /authentication was rejected|requested model is unavailable|Uncertain OCR|Unclear time-card|Duplicate time-card/.test(message)
      ? message.slice(0, 300) : "OCR could not complete. Retry the time card; no claim was generated.";
    final = { ...running, status: "failed", updatedAt: Date.now(), error: safe };
  }
  await store.write(final);
  return final;
}

/** A live heartbeat response keeps the Worker request open during multi-minute OCR.
 * waitUntil alone only provides a short post-disconnect grace period, not durable unlimited execution.
 * The caller drains this stream while independently polling authenticated R2 job status.
 */
export function ocrJobResponse(request: Request, job: OcrJob, read: (source: string) => Promise<ReadRow[]>, store: OcrJobStore = r2OcrJobStore): Response {
  const encoder = new TextEncoder();
  let connected = true, timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value: unknown) => {
        if (!connected) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`)); }
        catch { connected = false; }
      };
      send({ jobId: job.id, status: "queued" });
      timer = setInterval(() => send({ status: "running" }), 10_000);
      const task = runOcrJob(job, read, store).then(final => {
        send({ jobId: job.id, status: final.status });
      }).catch(() => send({ jobId: job.id, status: "failed", error: "OCR progress could not be saved. Retry the time card." })).finally(() => {
        if (timer) clearInterval(timer);
        if (connected) { connected = false; controller.close(); }
      });
      const runtimeRequest = request as Request & { waitUntil?: (task: Promise<unknown>) => void };
      // Nitro's Cloudflare adapter attaches the native execution-context method to Request.
      runtimeRequest.waitUntil?.(task);
    },
    cancel() { connected = false; if (timer) clearInterval(timer); },
  });
  return new Response(stream, { status: 202, headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", "X-Content-Type-Options": "nosniff" } });
}
