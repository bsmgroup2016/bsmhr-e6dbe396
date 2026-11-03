import { useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyPwaUpdate, getServerPwaUpdateReady, isPwaUpdateReady, subscribePwaUpdate } from "@/lib/pwa-updates";

export function PwaUpdateBanner() {
  const ready = useSyncExternalStore(subscribePwaUpdate, isPwaUpdateReady, getServerPwaUpdateReady);
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  return <div role="status" className="fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm text-foreground shadow-md">
    <span>New version available</span>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setBusy(true); void applyPwaUpdate().catch(() => setBusy(false)); }}>
      <RefreshCw className={`mr-1 h-3 w-3${busy ? " animate-spin" : ""}`} />Refresh
    </Button>
  </div>;
}