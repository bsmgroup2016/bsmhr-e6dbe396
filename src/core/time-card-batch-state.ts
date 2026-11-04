/** Session-local ClaimSheet Generator batch, so a reload/remount never loses unsaved cards. */
const KEY = "bsm:time-card-batch:v1";

export interface BatchState {
  localCards: unknown[];
  batchCardIds: string[];
  pendingScans: unknown[];
  month: string;
  projectId: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readBatchState(storage: StorageLike): BatchState | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<BatchState>;
    if (!Array.isArray(value.batchCardIds)) return null;
    return {
      localCards: Array.isArray(value.localCards) ? value.localCards : [],
      batchCardIds: value.batchCardIds.filter((id): id is string => typeof id === "string"),
      pendingScans: Array.isArray(value.pendingScans) ? value.pendingScans : [],
      month: typeof value.month === "string" ? value.month : "",
      projectId: typeof value.projectId === "string" ? value.projectId : "",
    };
  } catch { return null; }
}

export function writeBatchState(storage: StorageLike, state: BatchState) {
  try {
    if (!state.batchCardIds.length && !state.pendingScans.length) storage.removeItem(KEY);
    else storage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full or disabled: batch stays in memory only */ }
}

/** Next unapproved card after `current` in upload order, wrapping around. */
export function nextBatchCardId(order: string[], current: string, isApproved: (id: string) => boolean): string | undefined {
  const start = order.indexOf(current);
  for (let step = 1; step <= order.length; step++) {
    const id = order[(Math.max(start, 0) + step) % order.length];
    if (id && id !== current && !isApproved(id)) return id;
  }
  return undefined;
}
