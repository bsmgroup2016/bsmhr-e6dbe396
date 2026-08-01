import { useRef, useState } from "react";
import { Upload, File as FileIcon, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { uploadToR2, isR2Configured, MAX_UPLOAD_BYTES } from "@/lib/r2";

interface FileUploadProps {
  /** Hidden input name so the value is picked up by FormData. */
  name?: string;
  label?: string;
  folder?: string;
  defaultValue?: string;
  className?: string;
  /** Override the accepted file extensions, e.g. ".pdf". */
  accept?: string;
  /** Replaces the default helper text in the drop zone. */
  hint?: string;
  onUploaded?: (url: string, key: string) => void;
}

export function FileUpload({
  name = "fileUrl",
  label = "Attachment",
  folder = "documents",
  defaultValue = "",
  className,
  accept = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt",
  hint,
  onUploaded,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultValue);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const configured = isR2Configured();

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setProgress(0);
    try {
      const result = await uploadToR2(file, folder, setProgress);
      setUrl(result.url);
      onUploaded?.(result.url, result.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setFileName("");
    } finally {
      setProgress(null);
    }
  }

  function clear() {
    setUrl("");
    setFileName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={url} readOnly />

      {url ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
          >
            {fileName || url}
          </a>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
            progress !== null && "pointer-events-none opacity-70",
          )}
        >
          {progress !== null ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading {fileName} — {progress}%</p>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a file or click to browse</p>
              <p className="text-xs text-muted-foreground">
                {hint ?? "PDF, image or office file"} · max {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}

      {!configured && !url && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileIcon className="h-3.5 w-3.5" />
          Cloudflare R2 is not connected yet — set the Worker URL in Settings → Storage, or paste a link below.
        </p>
      )}

      {!configured && (
        <Input
          placeholder="https://... (paste a file link instead)"
          defaultValue={defaultValue}
          onChange={(e) => setUrl(e.target.value)}
        />
      )}
    </div>
  );
}
