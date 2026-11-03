import { IPA_DETAIL_FIELDS, ipaDetailsFromForm } from "@/core/ipa-detail-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/file-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Sparkles, Wand2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getBranchPrefixes,
  isEmployeeCodeTaken,
  nextEmployeeCode,
  prefixForBranch,
} from "@/lib/store";
import { OCR_NOT_CONFIGURED, extractIpaData, extractPassportData, extractParticularData, extractCsocData, isOcrConfigured } from "@/lib/ocr";
import { ipaEmployeeDefaults } from "@/core/ipa-registration";
import { documentEmployeeFields, type EmployeeDocumentKind } from "@/core/employee-document-fields";
import { isOfficeStaff } from "@/lib/workforce-split";
import type {
  DeploymentStatus,
  Employee,
  EmployeeStatus,
  EmploymentType,
  PassType,
  PaymentMethod,
  PayrollFrequency,
  WorkerCategory,
} from "@/lib/types";

export const PASS_TYPES: PassType[] = ["Work Permit", "S Pass", "Employment Pass", "Singaporean/PR"];

export const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  "Draft", "Pending Approval", "Pending Profile Completion", "Pending Verification",
  "Active", "Inactive", "On Leave", "Deployed",
  "Suspended", "Resigned", "Terminated", "Repatriated", "Archived",
];

export const DEPLOYMENT_STATUSES: DeploymentStatus[] = [
  "Available", "Deployed", "On Leave", "Blocked", "Not Deployable",
];

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "Full Time", "Part Time", "Contract", "Casual", "Project Based",
];

export const WORKER_CATEGORIES: WorkerCategory[] = [
  "Skilled", "Semi-Skilled", "General Worker", "Supervisor", "Office Staff", "Driver",
];

export const PAYMENT_METHODS: PaymentMethod[] = ["Bank Transfer", "GIRO", "PayNow", "Cash", "Cheque"];
export const PAYROLL_FREQUENCIES: PayrollFrequency[] = ["Monthly", "Bi-Weekly", "Weekly", "Daily"];

export const TRADES = [
  "Welder", "Pipe Fitter", "Scaffolder", "Rigger", "Rebar Man", "General Worker", "Painter",
  "Foreman", "Site Supervisor", "QA/QC Manager", "Project Engineer", "Safety Officer",
  "HR Executive", "Accounts Executive", "Driver",
];

/** Turn the form fields into an Employee payload (used for both create and edit). */
export function employeeFromForm(fd: FormData): Partial<Employee> {
  const s = (k: string) => ((fd.get(k) as string) || "").trim();
  const n = (k: string) => Number((fd.get(k) as string) || 0) || 0;
  const date = (k: string) => s(k) || undefined;
  const out: Record<string, unknown> = {
    ...ipaDetailsFromForm(fd),
    employeeCode: s("employeeCode") || undefined,
    name: s("name"),
    preferredName: s("preferredName") || undefined,
    nationality: s("nationality"),
    fin: s("fin"),
    passType: s("passType") as PassType,
    passExpiry: s("passExpiry") || "-",
    passportNumber: s("passportNumber") || undefined,
    passportExpiry: date("passportExpiry"),
    workPermitNumber: s("workPermitNumber") || undefined,
    workPermitIssueDate: date("workPermitIssueDate"),
    workPermitExpiryDate: date("workPermitExpiryDate"),
    trade: s("trade"),
    status: s("status") as EmployeeStatus,
    deploymentStatus: (s("deploymentStatus") || "Available") as DeploymentStatus,
    basicSalary: n("basicSalary"),
    otRate: n("otRate") || undefined,
    normalHours: n("normalHours") || undefined,
    levyRate: n("levyRate"),
    joinedOn: s("joinedOn"),
    applicationDate: date("applicationDate"),
    confirmationDate: date("confirmationDate"),
    contractStart: date("contractStart"),
    contractEnd: date("contractEnd"),
    lastWorkingDate: date("lastWorkingDate"),
    exitReason: s("exitReason") || undefined,
    dateOfBirth: date("dateOfBirth"),
    gender: (s("gender") || undefined) as Employee["gender"],
    maritalStatus: (s("maritalStatus") || undefined) as Employee["maritalStatus"],
    phone: s("phone") || undefined,
    altPhone: s("altPhone") || undefined,
    email: s("email") || undefined,
    address: s("address") || undefined,
    homeCountryAddress: s("homeCountryAddress") || undefined,
    postalCode: s("postalCode") || undefined,
    emergencyContact: s("emergencyContact") || undefined,
    emergencyRelation: s("emergencyRelation") || undefined,
    emergencyPhone: s("emergencyPhone") || undefined,
    emergencyEmail: s("emergencyEmail") || undefined,
    bankName: s("bankName") || undefined,
    bankAccount: s("bankAccount") || undefined,
    accountHolderName: s("accountHolderName") || undefined,
    paymentMethod: (s("paymentMethod") || undefined) as PaymentMethod | undefined,
    ethnicGroup: (s("ethnicGroup") || undefined) as Employee["ethnicGroup"],
    religion: (s("religion") || undefined) as Employee["religion"],
    prStatus: (s("prStatus") || undefined) as Employee["prStatus"],
    levyTier: (s("levyTier") || undefined) as Employee["levyTier"],
    medicalInsuranceExpiry: s("medicalInsuranceExpiry") || undefined,
    medicalCheckupDue: s("medicalCheckupDue") || undefined,
    branch: s("branch") || undefined,
    department: s("department") || undefined,
    employmentType: (s("employmentType") || undefined) as EmploymentType | undefined,
    workerCategory: (s("workerCategory") || undefined) as WorkerCategory | undefined,
    jobTitle: s("jobTitle") || undefined,
    secondarySkills: s("secondarySkills") || undefined,
    reportingManager: s("reportingManager") || undefined,
    siteSupervisor: s("siteSupervisor") || undefined,
    payrollGroup: s("payrollGroup") || undefined,
    payrollFrequency: (s("payrollFrequency") || undefined) as PayrollFrequency | undefined,
    dormitory: s("dormitory") || undefined,
    dormitoryAddress: s("dormitoryAddress") || undefined,
    remarks: s("remarks") || undefined,
    internalNotes: s("internalNotes") || undefined,
    photoUrl: s("photoUrl") || undefined,
    ipaDocumentUrl: s("ipaDocumentUrl") || undefined,
    declaredSalary: fd.has("declaredSalary") && s("declaredSalary") !== "" ? n("declaredSalary") : undefined,
    fixedAllowance: fd.has("fixedAllowance") && s("fixedAllowance") !== "" ? n("fixedAllowance") : undefined,
    ipaIssueDate: date("ipaIssueDate"),
    ipaExpiryDate: date("ipaExpiryDate"),
    pFileUrl: s("pFileUrl") || undefined,
    safetyCourseType: s("safetyCourseType") || undefined,
    safetyCourseNo: s("safetyCourseNo") || undefined,
    safetyCourseExpiry: date("safetyCourseExpiry"),
  };
  // Drop keys whose input was not rendered in this form, so a partial form
  // never overwrites existing data with blanks.
  for (const k of Object.keys(out)) {
    if (!fd.has(k) && out[k] === undefined) delete out[k];
  }
  return out as Partial<Employee>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2" data-field={label}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Pick({
  name,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ field: string; value: string }>).detail;
      if (detail.field === name && !selected && options.includes(detail.value)) setSelected(detail.value);
    };
    document.addEventListener("employee-autofill", handler);
    return () => document.removeEventListener("employee-autofill", handler);
  }, [name, selected, options]);
  return (
    <Select name={name} value={selected} onValueChange={setSelected}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const dateValue = (v?: string) => (v && v !== "-" ? v : "");

export function EmployeeForm({
  employee,
  onSubmit,
  submitLabel,
  initialValues,
}: {
  employee?: Employee;
  initialValues?: Partial<Employee>;
  onSubmit: (data: FormData) => void;
  submitLabel?: string;
}) {
  const values = employee ?? initialValues;
  const prefixes = useMemo(() => getBranchPrefixes(), []);
  const [branch, setBranch] = useState(values?.branch ?? prefixes[0]?.name ?? "Unassigned");
  const [code, setCode] = useState(
    values?.employeeCode ?? nextEmployeeCode(values?.branch ?? prefixes[0]?.name),
  );
  const [ipaUrl, setIpaUrl] = useState(values?.ipaDocumentUrl ?? "");
  const [scanning, setScanning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [documentReading, setDocumentReading] = useState(0);
  const [documentRefs, setDocumentRefs] = useState<Partial<Record<EmployeeDocumentKind, string>>>({ particular: values?.pFileUrl });
  const readingKinds = useRef(new Set<EmployeeDocumentKind>());

  const taken = code.trim() ? isEmployeeCodeTaken(code, employee?.id) : false;
  const expectedPrefix = prefixForBranch(branch);
  const staff = isOfficeStaff({ department: values?.department, trade: values?.trade });
  const idFieldLabel = staff ? "Employee ID" : "Particular Number (primary identifier)";
  const prefixMismatch =
    !staff &&
    code.trim().length > 0 &&
    !new RegExp(`^${expectedPrefix}\\d+$`, "i").test(code.trim());

  function suggest(nextBranch: string) {
    setBranch(nextBranch);
    if (!employee) setCode(nextEmployeeCode(nextBranch));
  }

  /** Write a value into an uncontrolled input without clobbering user edits. */
  function fill(field: string, value?: string) {
    if (!value) return 0;
    const el = formRef.current?.elements.namedItem(field);
    if (el instanceof HTMLSelectElement) {
      if (el.value || !Array.from(el.options).some((option) => option.value === value)) return 0;
      document.dispatchEvent(new CustomEvent("employee-autofill", { detail: { field, value } }));
      return 1;
    }
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return 0;
    if (!el || el.value) return 0;
    if (el.type === "date") {
      const v = value.trim();
      const mon = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
      let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
      let iso = m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
      if (!iso && (m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(v)))
        iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!iso && (m = /^(\d{1,2})[\s\-/]([A-Za-z]{3})[A-Za-z]*[\s\-/,]+(\d{4})$/.exec(v))) {
        const mi = mon.indexOf(m[2].toLowerCase());
        if (mi >= 0) iso = `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      }
      if (!iso) return 0;
      value = iso;
    }
    const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return el.value === value ? 1 : 0;
  }

  async function autoFillFromIpa(url = ipaUrl) {
    if (!url || scanning) {
      toast.error("Upload the IPA copy first");
      return;
    }
    setScanning(true);
    const result = await extractIpaData(url);
    setScanning(false);
    if (!result.ok) {
      toast.error(result.reason || OCR_NOT_CONFIGURED);
      return;
    }
    const mapped = ipaEmployeeDefaults(result.data, url);
    const filled = Object.entries(mapped).reduce((count, [field, value]) =>
      count + (typeof value === "string" || typeof value === "number" ? fill(field, String(value)) : 0), 0);
    if (filled === 0) toast.info("Nothing new to fill — check the values against the document");
    else toast.success(`${filled} field(s) filled from the IPA — verify before saving`);
  }

  async function autoFillDocument(kind: EmployeeDocumentKind, url: string) {
    if (!url || readingKinds.current.has(kind)) return;
    readingKinds.current.add(kind);
    setDocumentRefs((refs) => ({ ...refs, [kind]: url }));
    setDocumentReading((count) => count + 1);
    try {
      const result = kind === "particular" ? await extractParticularData(url) : kind === "csoc" ? await extractCsocData(url) : await extractPassportData(url);
      if (!result.ok) { toast.error(result.reason); return; }
      const fields = documentEmployeeFields(kind, result.data);
      const filled = Object.entries(fields).reduce((count, [field, value]) => count + fill(field, value), 0);
      toast.info(filled ? `${filled} field(s) filled — verify before saving` : "No empty fields could be filled — check the document and enter missing details manually");
    } finally {
      readingKinds.current.delete(kind);
      setDocumentReading((count) => count - 1);
    }
  }

  function readAgain(kind: EmployeeDocumentKind) {
    const url = documentRefs[kind];
    return <Button type="button" size="sm" variant="outline" disabled={!url || documentReading > 0} onClick={() => url && void autoFillDocument(kind, url)}><Sparkles className="mr-1 h-4 w-4" />Read {kind === "workpermit" ? "Work Permit" : kind === "particular" ? "Particular" : kind === "csoc" ? "CSOC" : "Passport"}</Button>;
  }


  function ipaFields(section: string) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{IPA_DETAIL_FIELDS.filter((field) => field.section === section).map((field) => <Field key={field.key} label={field.label}>
      {field.kind === "yesno" ? <Pick name={field.key} options={["Yes", "No"]} defaultValue={values?.[field.key] as string | undefined} /> : <Input name={field.key} type={field.kind === "number" ? "number" : "text"} step={field.kind === "number" ? "0.01" : undefined} min={field.kind === "number" ? "0" : undefined} defaultValue={values?.[field.key] ?? ""} />}
    </Field>)}</div>;
  }

  const [tab, setTab] = useState("personal");
  const invalidToastRef = useRef(false);

  return (
    <form
      ref={formRef}
      onInvalidCapture={(e) => {
        const el = e.target as HTMLElement;
        const panel = el.closest("[data-tab-panel]") as HTMLElement | null;
        const t = panel?.dataset.tabPanel;
        if (t && t !== tab) setTab(t);
        if (!invalidToastRef.current) {
          invalidToastRef.current = true;
          const label = el.closest("[data-field]")?.getAttribute("data-field") || (el as HTMLInputElement).name;
          toast.error(`Please fill in "${label}"${t ? ` on the ${t === "pass" ? "Work pass" : t === "pay" ? "Compensation" : t[0].toUpperCase() + t.slice(1)} tab` : ""}`);
          setTimeout(() => { invalidToastRef.current = false; }, 300);
          setTimeout(() => el.focus?.(), 50);
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (documentReading > 0 || scanning) return;
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
        <Field label={idFieldLabel}>
          <Input
            name="employeeCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
        </Field>
        <Field label="Branch / company">
          <Select name="branch" value={branch} onValueChange={suggest}>
            <SelectTrigger>
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {prefixes.map((p) => (
                <SelectItem key={p.id} value={p.name}>
                  {p.name} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {taken ? (
          <Alert variant="destructive" className="sm:col-span-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {staff ? "Employee ID" : "Particular Number"} {code} is already in use. Choose another.
            </AlertDescription>
          </Alert>
        ) : prefixMismatch ? (
          <Alert className="sm:col-span-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This Particular Number does not match the {branch} prefix ({expectedPrefix}). Allowed, but please confirm
              it is intentional. Suggested: {nextEmployeeCode(branch)}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="pass">Work pass</TabsTrigger>
          <TabsTrigger value="pay">Compensation</TabsTrigger>
          <TabsTrigger value="agency">Agency</TabsTrigger>
          <TabsTrigger value="employer">Employer / application</TabsTrigger>
        </TabsList>

        <TabsContent forceMount data-tab-panel="personal" value="personal" className="mt-4 space-y-4 data-[state=inactive]:hidden">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full legal name">
              <Input name="name" defaultValue={values?.name} required />
            </Field>
            <Field label="Preferred name">
              <Input name="preferredName" defaultValue={values?.preferredName ?? ""} />
            </Field>
            <Field label="Date of birth">
              <Input name="dateOfBirth" type="date" defaultValue={dateValue(values?.dateOfBirth)} />
            </Field>
            <Field label="Gender">
              <Pick name="gender" options={["Male", "Female", "Other"]} defaultValue={values?.gender} />
            </Field>
            <Field label="Nationality">
              <Input name="nationality" defaultValue={values?.nationality} required />
            </Field>
            <Field label="Marital status">
              <Pick
                name="maritalStatus"
                options={["Single", "Married", "Divorced", "Widowed"]}
                defaultValue={values?.maritalStatus}
              />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={values?.email ?? ""} />
            </Field>
            <Field label="Mobile phone">
              <Input name="phone" defaultValue={values?.phone ?? ""} />
            </Field>
            <Field label="Alternative phone">
              <Input name="altPhone" defaultValue={values?.altPhone ?? ""} />
            </Field>
            <Field label="Postal code">
              <Input name="postalCode" defaultValue={values?.postalCode ?? ""} />
            </Field>
          </div>
          {ipaFields("personal")}
          <Field label="Singapore address">
            <Input name="address" defaultValue={values?.address ?? ""} />
          </Field>
          <Field label="Home-country address">
            <Input name="homeCountryAddress" defaultValue={values?.homeCountryAddress ?? ""} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Emergency contact name">
              <Input name="emergencyContact" defaultValue={values?.emergencyContact ?? ""} />
            </Field>
            <Field label="Relationship">
              <Input name="emergencyRelation" defaultValue={values?.emergencyRelation ?? ""} />
            </Field>
            <Field label="Emergency phone">
              <Input name="emergencyPhone" defaultValue={values?.emergencyPhone ?? ""} />
            </Field>
            <Field label="Emergency email">
              <Input name="emergencyEmail" defaultValue={values?.emergencyEmail ?? ""} />
            </Field>
          </div>
          <FileUpload
            name="photoUrl"
            label="Profile photo"
            folder="photos"
            display="photo"
            accept=".jpg,.jpeg,.png,.webp,.heic"
            defaultValue={values?.photoUrl || ""}
          />
          <FileUpload
            name="passportUpload"
            label="Passport upload"
            folder="documents"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onUploaded={(url) => void autoFillDocument("passport", url)}
          />
          {readAgain("passport")}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Passport number"><Input name="passportNumber" defaultValue={values?.passportNumber ?? ""} /></Field>
            <Field label="Passport expiry"><Input name="passportExpiry" type="date" defaultValue={dateValue(values?.passportExpiry)} /></Field>
          </div>
          <FileUpload
            name="pFileUrl"
            label="Particular document (PDF)"
            folder="p-files"
            display="particular"
            accept=".pdf"
            hint="Upload the employee's scanned Particular as a PDF"
            defaultValue={values?.pFileUrl || ""}
            onUploaded={(url) => void autoFillDocument("particular", url)}
          />
          {readAgain("particular")}
        </TabsContent>

        <TabsContent forceMount data-tab-panel="employment" value="employment" className="mt-4 space-y-4 data-[state=inactive]:hidden">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Input name="department" defaultValue={values?.department ?? ""} />
            </Field>
            <Field label="Employment type">
              <Pick name="employmentType" options={EMPLOYMENT_TYPES} defaultValue={values?.employmentType ?? "Full Time"} />
            </Field>
            <Field label="Worker category">
              <Pick name="workerCategory" options={WORKER_CATEGORIES} defaultValue={values?.workerCategory ?? "General Worker"} />
            </Field>
            <Field label="Job title">
              <Input name="jobTitle" defaultValue={values?.jobTitle ?? ""} />
            </Field>
            <Field label="Designation">
              <Pick name="trade" options={values?.trade && !TRADES.includes(values.trade) ? [values.trade, ...TRADES] : TRADES} defaultValue={values?.trade || TRADES[0]} />
            </Field>
            <Field label="Secondary skills">
              <Input name="secondarySkills" defaultValue={values?.secondarySkills ?? ""} placeholder="Comma separated" />
            </Field>
            <Field label="Application date">
              <Input name="applicationDate" type="date" defaultValue={dateValue(values?.applicationDate)} />
            </Field>
            <Field label="Joining date">
              <Input name="joinedOn" type="date" defaultValue={dateValue(values?.joinedOn)} required />
            </Field>
            <Field label="Confirmation date">
              <Input name="confirmationDate" type="date" defaultValue={dateValue(values?.confirmationDate)} />
            </Field>
            <Field label="Contract start">
              <Input name="contractStart" type="date" defaultValue={dateValue(values?.contractStart)} />
            </Field>
            <Field label="Contract end">
              <Input name="contractEnd" type="date" defaultValue={dateValue(values?.contractEnd)} />
            </Field>
            <Field label="Employment status">
              <Pick name="status" options={EMPLOYEE_STATUSES} defaultValue={values?.status || "Active"} />
            </Field>
            <Field label="Deployment status">
              <Pick name="deploymentStatus" options={DEPLOYMENT_STATUSES} defaultValue={values?.deploymentStatus ?? "Available"} />
            </Field>
            <Field label="Reporting manager">
              <Input name="reportingManager" defaultValue={values?.reportingManager ?? ""} />
            </Field>
            <Field label="Site supervisor">
              <Input name="siteSupervisor" defaultValue={values?.siteSupervisor ?? ""} />
            </Field>
            <Field label="Last working date">
              <Input name="lastWorkingDate" type="date" defaultValue={dateValue(values?.lastWorkingDate)} />
            </Field>
            <Field label="Exit reason">
              <Input name="exitReason" defaultValue={values?.exitReason ?? ""} />
            </Field>
          </div>
          {ipaFields("employment")}
          <Field label="Internal notes (HR only)">
            <Textarea name="internalNotes" defaultValue={values?.internalNotes ?? ""} rows={3} />
          </Field>
        </TabsContent>

        <TabsContent forceMount data-tab-panel="pass" value="pass" className="mt-4 space-y-4 data-[state=inactive]:hidden">
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">IPA copy (In-Principle Approval)</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!isOcrConfigured() || !ipaUrl || scanning}
                        onClick={() => void autoFillFromIpa()}
                      >
                        {scanning ? (
                          <Wand2 className="mr-1 h-4 w-4 animate-pulse" />
                        ) : (
                          <Sparkles className="mr-1 h-4 w-4" />
                        )}
                        {scanning ? "Reading IPA…" : "Auto-fill from IPA"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {ipaUrl
                      ? "Reads the uploaded IPA and fills empty fields only — always verify."
                      : "Upload the IPA copy first"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <FileUpload
              name="ipaDocumentUrl"
              label="Upload IPA copy (PDF)"
              folder="ipa"
              display="document"
              documentLabel="IPA"
              accept=".pdf"
              defaultValue={ipaUrl}
              onUploaded={(url) => { setIpaUrl(url); void autoFillFromIpa(url); }}
            />
          </div>
          <FileUpload name="workPermitUpload" label="Work Permit upload" folder="documents" display="document" documentLabel="Work Permit" accept=".pdf,.jpg,.jpeg,.png,.webp" onUploaded={(url) => void autoFillDocument("workpermit", url)} />
          {readAgain("workpermit")}
          <FileUpload name="csocUpload" label="CSOC upload" folder="documents" display="document" documentLabel="CSOC" accept=".pdf,.jpg,.jpeg,.png,.webp" onUploaded={(url) => void autoFillDocument("csoc", url)} />
          {readAgain("csoc")}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="IPA approval date">
              <Input name="ipaIssueDate" type="date" defaultValue={dateValue(values?.ipaIssueDate)} />
            </Field>
            <Field label="IPA approval expiry">
              <Input name="ipaExpiryDate" type="date" defaultValue={dateValue(values?.ipaExpiryDate)} />
            </Field>
            <Field label="FIN / NRIC">
              <Input name="fin" defaultValue={values?.fin} required />
            </Field>
            <Field label="Pass type">
              <Pick name="passType" options={PASS_TYPES} defaultValue={values?.passType || "Work Permit"} />
            </Field>
            <Field label="Citizenship / PR status (CPF)">
              <Pick
                name="prStatus"
                options={["Citizen", "PR Year 1", "PR Year 2", "PR Year 3+"]}
                defaultValue={values?.prStatus || "Citizen"}
              />
            </Field>
            <Field label="Ethnic group (SHG fund)">
              <Pick
                name="ethnicGroup"
                options={["Chinese", "Malay", "Indian", "Eurasian", "Others"]}
                defaultValue={values?.ethnicGroup || "Others"}
              />
            </Field>
            <Field label="Religion (MBMF)">
              <Pick
                name="religion"
                options={["Non-Muslim", "Muslim"]}
                defaultValue={values?.religion || "Non-Muslim"}
              />
            </Field>
            <Field label="Work Permit number">
              <Input name="workPermitNumber" defaultValue={values?.workPermitNumber ?? ""} />
            </Field>
            <Field label="Work Permit issue date">
              <Input name="workPermitIssueDate" type="date" defaultValue={dateValue(values?.workPermitIssueDate)} />
            </Field>
            <Field label="Work Permit expiry date">
              <Input name="workPermitExpiryDate" type="date" defaultValue={dateValue(values?.workPermitExpiryDate)} />
            </Field>
            <Field label="Pass expiry">
              <Input name="passExpiry" type="date" defaultValue={dateValue(values?.passExpiry)} />
            </Field>
            <Field label="CSOC / SCOS course type"><Input name="safetyCourseType" defaultValue={values?.safetyCourseType ?? ""} /></Field>
            <Field label="CSOC / SCOS certificate number"><Input name="safetyCourseNo" defaultValue={values?.safetyCourseNo ?? ""} /></Field>
            <Field label="CSOC / SCOS expiry"><Input name="safetyCourseExpiry" type="date" defaultValue={dateValue(values?.safetyCourseExpiry)} /></Field>
            <Field label="Dormitory / accommodation">
              <Input name="dormitory" defaultValue={values?.dormitory ?? ""} />
            </Field>
            <Field label="Dormitory address">
              <Input name="dormitoryAddress" defaultValue={values?.dormitoryAddress ?? ""} />
            </Field>
            <Field label="Medical insurance expiry">
              <Input name="medicalInsuranceExpiry" type="date" defaultValue={dateValue(values?.medicalInsuranceExpiry)} />
            </Field>
            <Field label="Medical examination due">
              <Input name="medicalCheckupDue" type="date" defaultValue={dateValue(values?.medicalCheckupDue)} />
            </Field>
            <Field label="Levy tier (MOM)">
              <Pick
                name="levyTier"
                options={["Higher Skilled", "Basic Skilled"]}
                defaultValue={values?.levyTier ?? "Basic Skilled"}
              />
            </Field>
          </div>
          {ipaFields("pass")}
        </TabsContent>

        <TabsContent forceMount data-tab-panel="pay" value="pay" className="mt-4 space-y-4 data-[state=inactive]:hidden">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={staff ? "Monthly salary ($)" : "Basic rate / day ($)"}>
              <Input name="basicSalary" type="number" step="0.01" defaultValue={values?.basicSalary ?? ""} required />
            </Field>
            {staff ? null : (
              <Field label="OT rate per hour ($)">
                <Input name="otRate" type="number" step="0.01" defaultValue={values?.otRate ?? 0} />
              </Field>
            )}
            <Field label="Normal working hours / day">
              <Input name="normalHours" type="number" step="0.5" defaultValue={values?.normalHours ?? 8} />
            </Field>
            <Field label="Monthly levy ($)">
              <Input name="levyRate" type="number" step="0.01" defaultValue={values?.levyRate ?? 0} />
            </Field>
            <Field label="MOM declared monthly salary ($)">
              <Input name="declaredSalary" type="number" step="0.01" defaultValue={values?.declaredSalary ?? ""} />
            </Field>
            <Field label="Fixed monthly allowances ($)">
              <Input name="fixedAllowance" type="number" step="0.01" defaultValue={values?.fixedAllowance ?? ""} />
            </Field>
            <Field label="Payroll group">
              <Input name="payrollGroup" defaultValue={values?.payrollGroup ?? ""} />
            </Field>
            <Field label="Payroll frequency">
              <Pick name="payrollFrequency" options={PAYROLL_FREQUENCIES} defaultValue={values?.payrollFrequency ?? "Monthly"} />
            </Field>
            <Field label="Bank name">
              <Input name="bankName" defaultValue={values?.bankName ?? ""} />
            </Field>
            <Field label="Bank account reference">
              <Input name="bankAccount" defaultValue={values?.bankAccount ?? ""} />
            </Field>
            <Field label="Account holder name">
              <Input name="accountHolderName" defaultValue={values?.accountHolderName ?? ""} />
            </Field>
            <Field label="Payment method">
              <Pick name="paymentMethod" options={PAYMENT_METHODS} defaultValue={values?.paymentMethod ?? "Bank Transfer"} />
            </Field>
          </div>
          {ipaFields("pay")}
          <Field label="Remarks">
            <Textarea name="remarks" defaultValue={values?.remarks ?? ""} rows={2} />
          </Field>
        </TabsContent>
        <TabsContent forceMount data-tab-panel="agency" value="agency" className="mt-4 space-y-4 data-[state=inactive]:hidden">
          {ipaFields("agency")}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-2">
        {documentReading > 0 && <span role="status" className="mr-3 text-sm text-muted-foreground">Reading document…</span>}
        <Button type="submit" disabled={documentReading > 0 || scanning}>{submitLabel ?? (employee ? "Save changes" : "Register employee")}</Button>
      </div>
    </form>
  );
}