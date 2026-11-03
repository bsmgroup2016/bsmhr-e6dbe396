import { useState } from "react";
import { FileText, UserRoundPen, Loader2, RotateCcw } from "lucide-react";
import { EmployeeForm } from "@/components/employee-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { extractIpaData } from "@/lib/ocr";
import { ipaEmployeeDefaults, type IpaExtract } from "@/core/ipa-registration";
import { getBranchPrefixes } from "@/lib/store";

export function EmployeeRegistration({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const [method, setMethod] = useState("ipa");
  const [url, setUrl] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<IpaExtract | null>(null);
  const [revision, setRevision] = useState(0);

  async function readIpa(fileUrl: string) {
    setUrl(fileUrl);
    setReading(true);
    setError("");
    setExtracted(null);
    try {
      const result = await extractIpaData(fileUrl);
      if (!result.ok) { setError(result.reason); return; }
      if (!result.data.name && !result.data.fin && !result.data.workPermitNumber) {
        setError("No employee identity could be read from this IPA. Please upload a clearer copy.");
        return;
      }
      setExtracted(result.data);
      setRevision((value) => value + 1);
    } catch {
      setError("Could not read the IPA. Please try again.");
    } finally {
      setReading(false);
    }
  }

  const matches = extracted?.employerName ? getBranchPrefixes().filter((branch) =>
    branch.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "") === extracted.employerName?.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
  ) : [];

  return (
    <Tabs value={method} onValueChange={setMethod}>
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="ipa" className="min-h-11 whitespace-normal px-2 text-center">
          <FileText className="mr-2 h-4 w-4 shrink-0" />
          Register by IPA
        </TabsTrigger>
        <TabsTrigger value="manual" className="min-h-11 whitespace-normal px-2 text-center">
          <UserRoundPen className="mr-2 h-4 w-4 shrink-0" />
          Register manually
        </TabsTrigger>
      </TabsList>
      <TabsContent forceMount value="ipa" className="mt-5 space-y-5 data-[state=inactive]:hidden">
        <div className={reading ? "pointer-events-none opacity-70" : ""}>
          <FileUpload name="registrationIpa" label="Upload IPA" folder="ipa" accept=".pdf,.jpg,.jpeg,.png,.webp"
            onUploaded={(fileUrl) => void readIpa(fileUrl)} />
        </div>
        {reading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading IPA…</p>}
        {error && <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span><Button type="button" size="sm" variant="outline" disabled={reading} onClick={() => void readIpa(url)}><RotateCcw className="mr-2 h-4 w-4" />Retry</Button>
        </AlertDescription></Alert>}
        {extracted && <>
          <Alert><AlertDescription>
            IPA read — verify the details before registering.
            {extracted.employerName && <span className="mt-1 block">Employer on IPA: {extracted.employerName}</span>}
            {matches.length !== 1 && <span className="mt-1 block">Confirm the branch / company.</span>}
          </AlertDescription></Alert>
          <EmployeeForm key={revision} initialValues={ipaEmployeeDefaults(extracted, url, matches.length === 1 ? matches[0].name : undefined)} onSubmit={onSubmit} />
        </>}
      </TabsContent>
      <TabsContent forceMount value="manual" className="mt-5 data-[state=inactive]:hidden">
        <EmployeeForm onSubmit={onSubmit} />
      </TabsContent>
    </Tabs>
  );
}