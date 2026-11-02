/** Browser-side tray of AI assistant notifications (per device). */
export type AiNotice = { id: string; severity: "critical" | "warning" | "info"; title: string; detail: string; names?: string[]; at: string; read: boolean };

const KEY = "bsm-ai-notices";
const EVT = "bsm-ai-notices-change";

export function readNotices(): AiNotice[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: AiNotice[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  window.dispatchEvent(new Event(EVT));
}
/** Adds notices not seen before; returns only the new ones. */
export function addNotices(items: Omit<AiNotice, "at" | "read">[]): AiNotice[] {
  const list = readNotices();
  const known = new Set(list.map((n) => n.id));
  const fresh = items.filter((i) => !known.has(i.id)).map((i) => ({ ...i, at: new Date().toISOString(), read: false }));
  if (fresh.length) write([...fresh, ...list]);
  return fresh;
}
export function markRead(ids?: string[]) {
  write(readNotices().map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
}
export function clearNotices() {
  write([]);
}
export function onNoticesChange(fn: () => void) {
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
  };
}
