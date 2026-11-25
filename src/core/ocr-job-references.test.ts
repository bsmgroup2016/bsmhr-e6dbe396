import { expect, test } from "bun:test";
import { readJobReferences, saveJobReference, clearJobReferences, type JobReferenceStorage } from "./ocr-job-references";
function storage(): JobReferenceStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
const reference = { jobId: "00000000-0000-4000-8000-000000000001", ref: "time-cards/fixture.png", fileName: "fixture.png", createdAt: Date.now() };
test("saved references recover the same job after reopening without storing OCR rows", () => {
  const s = storage(); saveJobReference(s, "owner", reference);
  expect(readJobReferences(s, "owner")).toEqual([reference]);
  expect(Object.keys(readJobReferences(s, "owner")[0] ?? {}).sort()).toEqual(["createdAt", "fileName", "jobId", "ref"]);
});
test("references cannot cross accounts and restarting clears only that owner", () => {
  const s = storage(); saveJobReference(s, "owner", reference);
  expect(readJobReferences(s, "other")).toEqual([]);
  saveJobReference(s, "other", reference); clearJobReferences(s, "owner");
  expect(readJobReferences(s, "owner")).toEqual([]);
  expect(readJobReferences(s, "other")).toEqual([reference]);
});
test("expired references follow the server's 24-hour access window", () => {
  const s = storage(); saveJobReference(s, "owner", reference);
  expect(readJobReferences(s, "owner", reference.createdAt + 24 * 60 * 60 * 1000)).toEqual([]);
});