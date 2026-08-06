/**
 * Offline punch queue for the web app (PWA).
 *
 * When a worker clocks in/out without network, the punch is stored locally with
 * a stable `clientEventId` and flushed to `POST /v1/attendance/sync` once the
 * connection is back. The endpoint is idempotent, so replaying the queue never
 * creates duplicate attendance.
 */
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

const KEY = "bsm.offline.punches";

export interface QueuedPunch {
  clientEventId: string;
  employeeId?: string;
  siteId?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  punchedAt: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  address?: string;
  notes?: string;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function readQueue(): QueuedPunch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as QueuedPunch[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeQueue(list: QueuedPunch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* storage full — keep the app usable */
  }
  window.dispatchEvent(new Event("bsm:offline-queue"));
}

export function enqueuePunch(punch: Omit<QueuedPunch, "clientEventId">): QueuedPunch {
  const entry: QueuedPunch = { ...punch, clientEventId: newId() };
  writeQueue([...readQueue(), entry]);
  return entry;
}

export interface FlushResult {
  attempted: number;
  saved: number;
  duplicates: number;
  rejected: number;
  failed: number;
}

/** Send the whole queue. Only entries the server accepted are dropped. */
export async function flushQueue(): Promise<FlushResult> {
  const queue = readQueue();
  const empty: FlushResult = { attempted: 0, saved: 0, duplicates: 0, rejected: 0, failed: 0 };
  if (!queue.length) return empty;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return empty;

  const res = await apiFetch<{
    saved: number;
    duplicates: number;
    rejected: number;
    failed: number;
    results: { clientEventId: string | null; status: string }[];
  }>("/attendance/sync", { method: "POST", body: { events: queue } });

  if (!res.ok) return { ...empty, attempted: queue.length, failed: queue.length };

  const settled = new Set(
    res.data.results
      .filter((r) => r.status !== "error" && r.clientEventId)
      .map((r) => r.clientEventId as string),
  );
  writeQueue(queue.filter((q) => !settled.has(q.clientEventId)));
  return {
    attempted: queue.length,
    saved: res.data.saved,
    duplicates: res.data.duplicates,
    rejected: res.data.rejected,
    failed: res.data.failed,
  };
}

/** Live connection + pending-queue state, with auto-flush when back online. */
export function useOfflineQueue() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => setPending(readQueue().length), []);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await flushQueue();
    } finally {
      setSyncing(false);
      setPending(readQueue().length);
    }
  }, [syncing]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const up = () => {
      setOnline(true);
      void sync();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    window.addEventListener("bsm:offline-queue", refresh);
    const timer = window.setInterval(() => {
      if (navigator.onLine && readQueue().length) void sync();
    }, 60_000);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener("bsm:offline-queue", refresh);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return { online, pending, syncing, sync, refresh };
}
