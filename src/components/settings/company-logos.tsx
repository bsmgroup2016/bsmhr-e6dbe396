import { useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { R2Image } from "@/components/r2-image";
import { getCompanies, updateCompany } from "@/lib/store";
import { uploadToR2 } from "@/lib/r2";

/** Upload / replace the letterhead logo for each company (used on quotation PDFs). */
export function CompanyLogos() {
  const [, force] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const companies = getCompanies();

  async function pick(companyId: string, file?: File | null) {
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
      return toast.error("Logo must be a PNG, JPG or WEBP image");
    }
    setBusy(companyId);
    try {
      const res = await uploadToR2(file, "logos");
      updateCompany(companyId, { logoUrl: res.url || res.key });
      toast.success("Logo updated");
      force((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Company logos</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Used as the letterhead on quotations, invoices and other documents. PNG with a transparent
        background works best (square, at least 256×256).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <div key={c.id} className="rounded-lg border bg-background/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-card">
                <R2Image
                  src={c.logoUrl}
                  alt={`${c.name} logo`}
                  className="h-full w-full object-contain"
                  fallback={<span className="text-sm font-bold text-muted-foreground">{c.code}</span>}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.legalName}</p>
              </div>
            </div>
            <input
              ref={(el) => {
                inputs.current[c.id] = el;
              }}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                void pick(c.id, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy === c.id}
                onClick={() => inputs.current[c.id]?.click()}
              >
                <Upload className="mr-2 h-3.5 w-3.5" />
                {busy === c.id ? "Uploading…" : c.logoUrl ? "Replace" : "Upload logo"}
              </Button>
              {c.logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    updateCompany(c.id, { logoUrl: undefined });
                    toast.success("Logo removed");
                    force((v) => v + 1);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
