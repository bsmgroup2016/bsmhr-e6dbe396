/** Rows below this OCR confidence need human review first. */
export const REVIEW_CONFIDENCE = 0.7;

export const isLowConfidence = (c?: number) => c !== undefined && c < REVIEW_CONFIDENCE;

/** Lowest-confidence days first; ties and unscored rows keep date order. */
export function lowestConfidenceFirst<T extends { date: string; confidence?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ca = a.confidence ?? 1, cb = b.confidence ?? 1;
    return ca !== cb ? ca - cb : a.date.localeCompare(b.date);
  });
}
