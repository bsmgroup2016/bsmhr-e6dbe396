import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchR2Blob } from "@/lib/r2";
import type { EmployeeDocument } from "@/lib/types";

/** Read-only file history: never registers another upload or replaces an old reference. */
export function EmployeeSavedDocuments({ documents, exclude = [] }: { documents: EmployeeDocument[]; exclude?: string[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const seen = new Set(exclude.filter(Boolean));
  const files = [...documents].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt) || a.id.localeCompare(b.id)).filter((file) => {
    if (!file.fileUrl || seen.has(file.fileUrl)) return false;
    seen.add(file.fileUrl);
    return true;
  });
  async function download(file: EmployeeDocument) {
    if (!file.fileUrl) return;
    setDownloading(file.id);
    try {
      const blob = await fetchR2Blob(file.fileUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = ({ "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" } as Record<string, string>)[blob.type.split(";")[0]] || "";
      link.download = `${file.name.replace(/[^\w.-]+/g, "-")}${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download document");
    } finally {
      setDownloading(null);
    }
  }
  return <div className="divide-y">{files.map((file, index) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
    <div className="min-w-0 flex-1"><p className="break-words text-sm">{index + 1}. {file.name === "P-File" ? "Particular" : file.name}</p><p className="text-xs text-muted-foreground">{file.uploadedAt.slice(0, 10)}</p></div>
    <Button type="button" size="sm" variant="outline" disabled={downloading !== null} onClick={() => void download(file)}>{downloading === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download</Button>
  </div>)}</div>;
}