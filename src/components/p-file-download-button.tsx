import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadR2File } from "@/lib/r2";

interface PFileDownloadButtonProps {
  /** Stored P-File reference (R2 key or signed-file link). */
  pFileUrl?: string | null;
  /** Employee name, used for the saved file name. */
  name: string;
  /** P-File number / employee code, used for the saved file name. */
  code?: string | null;
}

/** Downloads only the employee's P-File PDF. Disabled when none is uploaded. */
export function PFileDownloadButton({ pFileUrl, name, code }: PFileDownloadButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!pFileUrl) return;
    setBusy(true);
    try {
      const safe = `${code ? `${code}-` : ""}${name}`.replace(/[^\w.-]+/g, "-");
      await downloadR2File(pFileUrl, `P-File-${safe}.pdf`);
    } catch {
      toast.error("P-File ডাউনলোড করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="icon"
      variant="outline"
      className="h-8 w-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40"
      aria-label={pFileUrl ? `Download P-File of ${name}` : `No P-File uploaded for ${name}`}
      title={pFileUrl ? "Download P-File (PDF)" : "No P-File uploaded"}
      disabled={!pFileUrl || busy}
      onClick={handleClick}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
    </Button>
  );
}
