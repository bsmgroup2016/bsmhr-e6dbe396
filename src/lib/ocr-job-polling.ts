export interface OcrJobSnapshot { status: "queued" | "running" | "complete" | "failed"; data?: unknown; error?: string }
export interface JobPollingDependencies {
  status: (jobId: string) => Promise<OcrJobSnapshot>;
  wait?: () => Promise<void>;
}
export class OcrPollingError extends Error {}

/** Read-only recovery: never starts or replays a paid OCR request. */
export async function waitForOcrJob(jobId: string, deps: JobPollingDependencies, stopped: () => boolean = () => false): Promise<unknown> {
  if (!JOB_ID.test(jobId)) throw new Error("Invalid OCR job identifier");
  const wait = deps.wait ?? (() => new Promise<void>(resolve => setTimeout(resolve, 2_000)));
  let failures = 0, disconnectChecks = 0;
  for (let attempt = 0; attempt < 1800; attempt++) {
    let state: OcrJobSnapshot;
    try { state = await deps.status(jobId); failures = 0; }
    catch (error) {
      if (error instanceof OcrPollingError) throw error;
      if (++failures >= 10) throw new Error("OCR progress is temporarily unavailable. Reopen this page after reconnecting to recover the same job.");
      await wait(); continue;
    }
    if (state.status === "complete") return state.data;
    if (state.status === "failed") throw new OcrPollingError(state.error ?? "OCR could not complete. Review the original time card.");
    if (stopped() && ++disconnectChecks >= 30) throw new Error("OCR connection stopped. Reopen this page to check the same job; no new OCR was started.");
    await wait();
  }
  throw new Error("OCR is taking too long. Reopen this page to recover the same job.");
}
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Drains the heartbeat connection while reading results from the private R2 status endpoint. */
export async function consumeOcrJob(response: Response, deps: JobPollingDependencies): Promise<unknown> {
  if (!response.body) throw new Error("OCR job did not return progress");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", jobId: string | null = null, disconnected = false;
  while (!jobId) {
    const part = await reader.read();
    if (part.done) throw new Error("OCR progress ended before the job started");
    buffer += decoder.decode(part.value, { stream: true });
    const end = buffer.indexOf("\n");
    if (end < 0) continue;
    const first = JSON.parse(buffer.slice(0, end)) as { jobId?: unknown };
    if (typeof first.jobId !== "string" || !JOB_ID.test(first.jobId)) throw new Error("Invalid OCR job identifier");
    jobId = first.jobId; buffer = buffer.slice(end + 1);
  }
  const drain = (async () => {
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
          JSON.parse(buffer.slice(0, end));
          buffer = buffer.slice(end + 1);
        }
      }
    } catch { /* Read-only status recovery remains available after a dropped heartbeat. */ }
    finally { disconnected = true; }
  })();
  try {
    return await waitForOcrJob(jobId, deps, () => disconnected);
  } finally {
    await reader.cancel().catch(() => undefined);
    await drain;
  }
}
