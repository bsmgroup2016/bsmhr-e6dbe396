export interface OcrJobSnapshot { status: "queued" | "running" | "complete" | "failed"; data?: unknown; error?: string }
export interface JobPollingDependencies {
  status: (jobId: string) => Promise<OcrJobSnapshot>;
  wait?: () => Promise<void>;
}
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Drains the heartbeat connection while reading results from the private R2 status endpoint. */
export async function consumeOcrJob(response: Response, deps: JobPollingDependencies): Promise<unknown> {
  if (!response.body) throw new Error("OCR job did not return progress");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", jobId: string | null = null, disconnected = false;
  let transportError: string | null = null;
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
          const event = JSON.parse(buffer.slice(0, end)) as { error?: unknown };
          if (typeof event.error === "string") transportError = event.error;
          buffer = buffer.slice(end + 1);
        }
      }
    } catch { transportError = "OCR connection was interrupted. Retry the time card; no claim was generated."; }
    finally { disconnected = true; }
  })();
  const wait = deps.wait ?? (() => new Promise<void>(resolve => setTimeout(resolve, 2_000)));
  let disconnectChecks = 0;
  try {
    // Finite guard; a disconnected Worker is not assumed to still be processing forever.
    for (let attempt = 0; attempt < 1800; attempt++) {
      const state = await deps.status(jobId);
      if (state.status === "complete") return state.data;
      if (state.status === "failed") throw new Error(state.error ?? "OCR could not complete. Retry the time card.");
      if (disconnected && ++disconnectChecks >= 3) throw new Error(transportError ?? "OCR progress stopped. Retry the time card.");
      await wait();
    }
    throw new Error("OCR is taking too long. Retry the time card; no claim was generated.");
  } finally {
    await reader.cancel().catch(() => undefined);
    await drain;
  }
}
