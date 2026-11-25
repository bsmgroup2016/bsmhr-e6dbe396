import { useCallback, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  Trash2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaPreview, type MediaPreviewFile } from "./media-preview";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { mediaUploadPrefix } from "@/lib/media-policy";

type BucketId = "main" | "scans";
const folderLabel = (folder: string) => folder === "p-files" || folder === "particulars" ? "Particulars" : folder;

type Listing = {
  bucket: { id: BucketId; title: string; purpose: string };
  prefix: string;
  folders: string[];
  files: { key: string; name: string; size: number; lastModified: string; protected?: boolean }[];
  nextCursor: string | null;
};

const BUCKETS: { id: BucketId; title: string; purpose: string }[] = [
  { id: "main", title: "Main bucket", purpose: "Work permits, ICs, passports, certificates, employee documents, logos, invoices and other attachments." },
  { id: "scans", title: "Scans bucket", purpose: "Time-card scans for OCR and attendance selfies." },
];

function size(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function isImage(name: string) {
  return /\.(png|jpe?g|webp|gif|heic)$/i.test(name);
}

async function api(path: string, init?: RequestInit) {
  const { data: s } = await supabase.auth.getSession();
  const res = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${s.session?.access_token ?? ""}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? (res.status === 403 ? "Admins only" : "Could not load files"));
  }
  return res.json();
}

export function MediaBrowser() {
  const [bucket, setBucket] = useState<BucketId | null>(null);
  const [prefix, setPrefix] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaPreviewFile | null>(null);
  const [removal, setRemoval] = useState<Listing["files"][number] | null>(null);
  const [mutating, setMutating] = useState(false);
  const [progress, setProgress] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (b: BucketId, p: string, cursor?: string) => {
    const params = new URLSearchParams({ bucket: b, prefix: p });
    if (cursor) params.set("cursor", cursor);
    return (await api(`/api/public/r2-files?${params}`)) as Listing;
  }, []);

  const open = useCallback(
    async (b: BucketId, p: string) => {
      setLoading(true);
      setSearch("");
      try {
        setListing(await load(b, p));
        setBucket(b);
        setPrefix(p);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  async function uploadFiles(selected: FileList | null) {
    if (!bucket || !selected?.length) return;
    setMutating(true);
    let count = 0;
    try {
      const targetPrefix = mediaUploadPrefix(bucket, prefix);
      for (const file of Array.from(selected)) {
        setProgress(`Uploading ${count + 1} of ${selected.length}…`);
        const form = new FormData(); form.set("file", file); form.set("bucket", bucket); form.set("prefix", targetPrefix);
        await api("/api/public/r2-files", { method: "POST", body: form });
        count++;
      }
      toast.success(`${count} file${count === 1 ? "" : "s"} uploaded`);
      await open(bucket, targetPrefix);
    } catch (error) {
      toast.error(`${count ? `${count} uploaded. ` : ""}${error instanceof Error ? error.message : "Upload failed"}`);
      await open(bucket, prefix);
    } finally { setMutating(false); setProgress(""); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function removeFile() {
    if (!bucket || !removal) return;
    setMutating(true);
    try {
      await api("/api/public/r2-files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bucket, key: removal.key }) });
      toast.success("File deleted"); setRemoval(null);
      await open(bucket, prefix);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Deletion failed"); }
    finally { setMutating(false); }
  }

  async function loadMore() {
    if (!bucket || !listing?.nextCursor) return;
    setLoadingMore(true);
    try {
      const more = await load(bucket, prefix, listing.nextCursor);
      setListing({
        ...more,
        folders: [...listing.folders, ...more.folders],
        files: [...listing.files, ...more.files],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoadingMore(false);
    }
  }

  async function viewFile(key: string, name: string) {
    if (!bucket) return;
    setOpening(key);
    try {
      const { url, contentType } = await api(`/api/public/r2-files?bucket=${bucket}&view=${encodeURIComponent(key)}`);
      setPreview({ url, name, contentType });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    } finally {
      setOpening(null);
    }
  }

  const q = search.trim().toLowerCase();
  const folders = (listing?.folders ?? []).filter((f) => !q || f.toLowerCase().includes(q));
  const files = (listing?.files ?? []).filter((f) => !q || f.name.toLowerCase().includes(q));
  const crumbs = prefix.split("/").filter(Boolean);

  // Bucket picker
  if (!bucket) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Media library</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Browse every file stored in Cloudflare R2. Pick a bucket to see its folders and files.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {BUCKETS.map((b) => (
            <Button
              key={b.id}
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => open(b.id, "")}
              className="group block h-auto whitespace-normal rounded-lg bg-background/50 p-4 text-left transition hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <HardDrive className="h-4 w-4 text-primary" />
                  {b.title}
                </span>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{b.purpose}</p>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // File browser
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={mutating || loading} onClick={() => { setBucket(null); setListing(null); setPrefix(""); }}>
            <ArrowLeft className="h-4 w-4" /> Buckets
          </Button>
          <h2 className="text-lg font-semibold">{listing?.bucket.title ?? "Media"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInput} type="file" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
          <Button size="sm" disabled={mutating || loading || prefix.startsWith("claim-templates/")} onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" />{mutating && progress ? progress : "Add files"}</Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files…"
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          <Button variant="ghost" size="sm" aria-label="Refresh files" title="Refresh files" disabled={loading || mutating} onClick={() => open(bucket, prefix)}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Button variant="ghost" size="sm" disabled={mutating || loading} className="h-7 font-medium" onClick={() => open(bucket, "")}>
          root
        </Button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <Button
              type="button"
              variant="ghost" size="sm" disabled={mutating || loading}
              className="h-7 font-medium"
              onClick={() => open(bucket, crumbs.slice(0, i + 1).join("/") + "/")}
            >
              {folderLabel(c)}
            </Button>
          </span>
        ))}
      </div>

      {loading && !listing ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading files…
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {folders.map((f) => (
            <Button
              key={f}
              type="button"
              variant="ghost"
              disabled={mutating || loading}
              onClick={() => open(bucket, f)}
              className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-3 py-2.5 text-left text-sm transition hover:bg-accent/40"
            >
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 truncate font-medium">{folderLabel(f.slice(prefix.length).replace(/\/$/, ""))}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          ))}
          {files.map((f) => (
            <div key={f.key} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              {isImage(f.name) ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start p-0 text-left font-normal" disabled={opening === f.key || mutating || loading} onClick={() => viewFile(f.key, f.name)} title={f.name}><span className="truncate">{f.name}</span></Button>
              <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{size(f.size)}</span>
              <span className="hidden w-36 text-right text-xs text-muted-foreground md:block">
                {f.lastModified ? new Date(f.lastModified).toLocaleDateString() : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={opening === f.key || mutating || loading}
                onClick={() => viewFile(f.key, f.name)}
                aria-label={`Open ${f.name}`}
                title="Preview file"
              >
                {opening === f.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-destructive" disabled={f.protected || mutating || loading} onClick={() => setRemoval(f)} aria-label={`Delete ${f.name}`} title={f.protected ? "Protected claim template" : "Delete file"}>{f.protected ? <Lock className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}</Button>
            </div>
          ))}
          {folders.length === 0 && files.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {q ? "Nothing matches this filter." : "This folder is empty."}
            </p>
          )}
        </div>
      )}

      {listing?.nextCursor && (
        <div className="mt-3 text-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load more
          </Button>
        </div>
      )}
      {listing && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {listing.folders.length} folders · {listing.files.length} files shown{listing.nextCursor ? " (more available)" : ""}
        </p>
      )}
      <MediaPreview file={preview} onClose={() => setPreview(null)} />
      <Dialog open={!!removal} onOpenChange={value => { if (!value && !mutating) setRemoval(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete file?</DialogTitle><DialogDescription>This permanently deletes the file from {listing?.bucket.title}. Any employee document or claim using it will no longer open. This cannot be undone.</DialogDescription></DialogHeader>
          <p className="break-all text-sm font-medium">{removal?.name}</p>
          <DialogFooter><Button variant="outline" disabled={mutating} onClick={() => setRemoval(null)}>Cancel</Button><Button variant="destructive" disabled={mutating} onClick={removeFile}>{mutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete file</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
