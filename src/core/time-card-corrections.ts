import type { TimeCardEntry, TimeCardReading } from "@/lib/types";

export const readingFields = ["date", "workerName", "employeeCode", "fin", "siteName", "projectId", "projectName", "checkIn", "checkOut", "normalHours", "otHours", "resolution", "remarks"] as const;

export function cardReading(entry: TimeCardEntry): TimeCardReading {
  return Object.fromEntries(readingFields.map(field => [field, entry[field]])) as TimeCardReading;
}

/** Preserve the first reading; edits require revalidation, not just card approval. */
export function trackCardCorrection(before: TimeCardEntry, after: TimeCardEntry, at = new Date().toISOString()): TimeCardEntry {
  if (!readingFields.some(field => before[field] !== after[field])) return after;
  const audit = before.correctionAudit ?? { original: cardReading(before), pending: false, revisions: [] };
  return { ...after, ocrReviewed: false, reviewApproved: false, correctionAudit: { ...audit, editedAt: at, pending: true } };
}

export function verifyCardCorrection(entry: TimeCardEntry, at = new Date().toISOString()): TimeCardEntry {
  const audit = entry.correctionAudit;
  if (!audit?.pending) return { ...entry, ocrReviewed: true };
  const previous = { ...audit.original };
  for (const revision of audit.revisions) for (const change of revision.changes) Object.assign(previous, { [change.field]: change.after });
  const changes = readingFields.filter(field => previous[field] !== entry[field]).map(field => ({ field, before: previous[field], after: entry[field] }));
  return { ...entry, ocrReviewed: true, correctionAudit: { ...audit, pending: false, revisions: [...audit.revisions, { correctedAt: audit.editedAt ?? at, verifiedAt: at, changes }] } };
}