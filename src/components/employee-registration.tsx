import { useState } from "react";
import { FileText, UserRoundPen, Loader2, RotateCcw } from "lucide-react";
import { EmployeeForm } from "@/components/employee-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { extractIpaData } from "@/lib/ocr";
import { ipaEmployeeDefaults, type IpaExtract } from "@/core/ipa-registration";
import { getBranchPrefixes, nextEmployeeCode, isEmployeeCodeTaken } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function EmployeeRegistration({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const [method, setMethod] = useState("ipa");
  const [url, setUrl] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<IpaExtract | null>(null);
  const [revision, setRevision] = useState(0);
  const [company, setCompany] = useState("");
  const [pFile, setPFile] = useState("");
  const [confirmed, setConfirmed] = useState<{ code: string; branch: string } | null>(null);

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
      setConfirmed(null);
      setPFile("");
      const norm = (v?: string) => (v ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const found = getBranchPrefixes().filter((b) => norm(b.name) === norm(result.data.employerName));
      setCompany(found.length === 1 ? found[0].name : getBranchPrefixes()[0]?.name ?? "");
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
          {!confirmed ? (() => {
            const auto = nextEmployeeCode(company);
            const typed = pFile.trim();
            const taken = typed ? isEmployeeCodeTaken(typed) : false;
            return <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Particular number</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Company</Label>
                  <Select value={company} onValueChange={setCompany}><SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>{getBranchPrefixes().map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2"><Label htmlFor="ipa-pfile">Particular number (optional)</Label>
                  <Input id="ipa-pfile" value={pFile} placeholder={auto} onChange={(e) => setPFile(e.target.value)} />
                  <p className={taken ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{taken ? "This number is already used." : `Leave blank to use the next number: ${auto}`}</p>
                </div>
              </div>
              <Button type="button" disabled={!company || taken} onClick={() => { setConfirmed({ code: typed || auto, branch: company }); setRevision((v) => v + 1); }}>Continue</Button>
            </div>;
          })() : <EmployeeForm key={revision} initialValues={{ ...ipaEmployeeDefaults(extracted, url, confirmed.branch), branch: confirmed.branch, employeeCode: confirmed.code }} onSubmit={onSubmit} />}
        </>}
      </TabsContent>
      <TabsContent forceMount value="manual" className="mt-5 data-[state=inactive]:hidden">
        <EmployeeForm onSubmit={onSubmit} />
      </TabsContent>
    </Tabs>
  );
}