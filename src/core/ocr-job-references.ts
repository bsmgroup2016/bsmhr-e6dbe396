export interface OcrJobReference { jobId: string; ref: string; fileName: string; createdAt: number }
export interface JobReferenceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = (owner: string) => `bsm-ocr-job-refs:${owner}`;

/** Only small source/job references are stored, never OCR rows or credentials. */
export function readJobReferences(storage: JobReferenceStorage, owner: string, now = Date.now()): OcrJobReference[] {
  try {
    const values: unknown = JSON.parse(storage.getItem(key(owner)) ?? "[]");
    if (!Array.isArray(values)) return [];
    return values.filter((v): v is OcrJobReference => !!v && typeof v === "object" && typeof v.jobId === "string" && uuid.test(v.jobId) && typeof v.ref === "string" && typeof v.fileName === "string" && typeof v.createdAt === "number" && now >= v.createdAt && now - v.createdAt < 24 * 60 * 60 * 1000);
  } catch { return []; }
}
export function saveJobReference(storage: JobReferenceStorage, owner: string, reference: OcrJobReference): void {
  const values = readJobReferences(storage, owner).filter(v => v.ref !== reference.ref);
  storage.setItem(key(owner), JSON.stringify([...values, reference]));
}
export function clearJobReferences(storage: JobReferenceStorage, owner: string): void { storage.removeItem(key(owner)); }