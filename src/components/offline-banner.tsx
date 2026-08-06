import { CloudOff, RefreshCw, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOfflineQueue } from "@/lib/offline-punch";

/**
 * Thin status strip: shows when the device is offline, and how many punches are
 * still waiting to sync once the connection returns.
 */
export function OfflineBanner() {
  const { online, pending, syncing, sync } = useOfflineQueue();
  if (online && pending === 0) return null;

  return (
    <div
      className={
        online
          ? "flex items-center justify-between gap-3 border-b border-border/60 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-400"
          : "flex items-center justify-between gap-3 border-b border-border/60 bg-destructive/10 px-4 py-2 text-xs text-destructive"
      }
      role="status"
    >
      <span className="flex items-center gap-2">
        {online ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
        {online
          ? `${pending} punch${pending === 1 ? "" : "es"} waiting to sync.`
          : `Offline — punches are saved on this device${pending ? ` (${pending} waiting)` : ""}.`}
      </span>
      {online && pending > 0 && (
        <Button size="sm" variant="outline" className="h-6 px-2" disabled={syncing} onClick={() => void sync()}>
          <RefreshCw className={syncing ? "mr-1 h-3 w-3 animate-spin" : "mr-1 h-3 w-3"} />
          {syncing ? "Syncing" : "Sync now"}
        </Button>
      )}
    </div>
  );
}
