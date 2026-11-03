import { useState } from "react";
import { FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadR2FilesAsZip } from "@/lib/r2";

export type PFilePerson = {
  name: string;
  employeeCode?: string | null;
  pFileUrl?: string | null;
};

interface Props {
  /** People currently shown by the active filters. */
  people: PFilePerson[];
  /** Base name of the generated ZIP. */
  zipBaseName?: string;
  label?: string;
}

/** Downloads every P-File PDF of the currently listed people as one ZIP. */
export function PFileBulkDownloadButton({ people, zipBaseName = "Particulars", label = "Download Particular" }: Props) {
  const [busy, setBusy] = useState(false);
  const withFile = people.filter((p) => p.pFileUrl);

  async function handleClick() {
    if (withFile.length === 0) {
      toast.error("No Particulars uploaded for this list");
      return;
    }
    setBusy(true);
    const id = toast.loading(`Downloading ${withFile.length} Particulars…`);
    try {
      const names: Record<string, string> = {};
      for (const p of withFile) {
        const safe = `${p.employeeCode ? `${p.employeeCode}-` : ""}${p.name}`.replace(/[^\w.-]+/g, "-");
        names[p.pFileUrl as string] = `Particular-${safe}.pdf`;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const { added, failed } = await downloadR2FilesAsZip(
        withFile.map((p) => p.pFileUrl as string),
        `${zipBaseName}_${stamp}.zip`,
        names,
      );
      toast.dismiss(id);
      if (added === 0) toast.error("No Particular could be downloaded");
      else if (failed.length) toast.warning(`${added} downloaded, ${failed.length} failed`);
      else toast.success(`${added} Particulars downloaded as ZIP`);
    } catch {
      toast.dismiss(id);
      toast.error("Could not create ZIP");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={handleClick}
      disabled={busy}
      title={`Download ${withFile.length} Particular PDF(s) as ZIP`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
      {label}
      <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
        {withFile.length}
      </span>
    </Button>
  );
}
