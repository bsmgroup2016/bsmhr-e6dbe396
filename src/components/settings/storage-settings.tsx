import { useEffect, useState } from "react";
import { HardDrive, CheckCircle2, XCircle, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Bucket = {
  id: string; title: string; purpose: string; folders: string; bucket: string | null;
  configured: boolean; reachable: boolean; ms?: number; files?: number; filesMore?: boolean;
  bytes?: number; writeOk?: boolean | null; message: string;
};

function size(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function StorageSettings() {
  const [data, setData] = useState<{ buckets: Bucket[]; checkedAt: string } | null>(null);
  const [loading, setLoading] = useState<"load" | "test" | null>("load");

  const load = async (test: boolean) => {
    setLoading(test ? "test" : "load");
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`/api/public/r2-status${test ? "?test=1" : ""}`, {
        headers: { Authorization: `Bearer ${s.session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error(res.status === 403 ? "Admins only" : "Could not check storage");
      const json = await res.json();
      setData(json);
      if (test) {
        const bad = (json.buckets as Bucket[]).filter((b) => b.configured && (!b.reachable || b.writeOk === false));
        bad.length ? toast.error(`${bad.map((b) => b.title).join(", ")}: problem found`) : toast.success("All buckets working");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => { load(false); }, []);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Cloudflare R2 file storage</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={!!loading} onClick={() => load(false)}>
            <RefreshCw className={`h-3 w-3 ${loading === "load" ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" disabled={!!loading} onClick={() => load(true)}>
            {loading === "test" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Test all connections
          </Button>
        </div>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Files are stored in Cloudflare R2; only the file link is saved in the database. Keys are stored securely and are never shown.
        The full test uploads, reads and deletes a tiny test file in each bucket.
      </p>

      {!data && loading && <p className="text-sm text-muted-foreground">Checking buckets…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.buckets.map((b) => {
          const ok = b.configured && b.reachable && b.writeOk !== false;
          return (
            <div key={b.id} className="rounded-lg border bg-background/50 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{b.title}</span>
                {!b.configured ? (
                  <Badge variant="outline" className="text-[10px]">Not set up</Badge>
                ) : ok ? (
                  <Badge variant="outline" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-primary" /> Connected</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-[10px] text-destructive"><XCircle className="h-3 w-3" /> Problem</Badge>
                )}
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{b.purpose}</p>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Bucket name</dt><dd className="font-mono">{b.bucket ?? "—"}</dd>
                <dt className="text-muted-foreground">Folders</dt><dd className="font-mono">{b.folders}</dd>
                <dt className="text-muted-foreground">Status</dt><dd className={ok ? "" : "text-destructive"}>{b.message}</dd>
                {b.reachable && (
                  <>
                    <dt className="text-muted-foreground">Files</dt><dd>{b.files}{b.filesMore ? "+" : ""}</dd>
                    <dt className="text-muted-foreground">Space used</dt><dd>{size(b.bytes)}{b.filesMore ? "+" : ""}</dd>
                    <dt className="text-muted-foreground">Response time</dt><dd>{b.ms} ms</dd>
                  </>
                )}
                {b.writeOk !== undefined && b.writeOk !== null && (
                  <><dt className="text-muted-foreground">Upload test</dt><dd>{b.writeOk ? "Passed" : "Failed"}</dd></>
                )}
              </dl>
            </div>
          );
        })}
      </div>
      {data && <p className="mt-3 text-[11px] text-muted-foreground">Last checked {new Date(data.checkedAt).toLocaleString()}</p>}
    </div>
  );
}
