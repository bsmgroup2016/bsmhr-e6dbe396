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
import { useMemo, useRef, useState } from "react";
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
import { OCR_NOT_CONFIGURED, extractIpaData, isOcrConfigured } from "@/lib/ocr";
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
  return {
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
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
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
  return (
    <Select name={name} defaultValue={defaultValue}>
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
}: {
  employee?: Employee;
  onSubmit: (data: FormData) => void;
  submitLabel?: string;
}) {
  const prefixes = useMemo(() => getBranchPrefixes(), []);
  const [branch, setBranch] = useState(employee?.branch ?? prefixes[0]?.name ?? "Unassigned");
  const [code, setCode] = useState(
    employee?.employeeCode ?? nextEmployeeCode(employee?.branch ?? prefixes[0]?.name),
  );
  const [ipaUrl, setIpaUrl] = useState(employee?.ipaDocumentUrl ?? "");
  const [scanning, setScanning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const taken = code.trim() ? isEmployeeCodeTaken(code, employee?.id) : false;
  const expectedPrefix = prefixForBranch(branch);
  const prefixMismatch =
    code.trim().length > 0 &&
    !new RegExp(`^${expectedPrefix}\\d+$`, "i").test(code.trim());

  function suggest(nextBranch: string) {
    setBranch(nextBranch);
    if (!employee) setCode(nextEmployeeCode(nextBranch));
  }

  /** Write a value into an uncontrolled input without clobbering user edits. */
  function fill(field: string, value?: string) {
    if (!value) return 0;
    const el = formRef.current?.elements.namedItem(field) as HTMLInputElement | null;
    if (!el || el.value) return 0;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return 1;
  }

  async function autoFillFromIpa() {
    if (!ipaUrl) {
      toast.error("Upload the IPA copy first");
      return;
    }
    setScanning(true);
    const result = await extractIpaData(ipaUrl);
    setScanning(false);
    if (!result.ok) {
      toast.error(result.reason || OCR_NOT_CONFIGURED);
      return;
    }
    const d = result.data;
    let filled = 0;
    filled += fill("name", d.name);
    filled += fill("fin", d.fin);
    filled += fill("passportNumber", d.passportNumber);
    filled += fill("workPermitNumber", d.workPermitNumber);
    filled += fill("nationality", d.nationality);
    filled += fill("dateOfBirth", d.dateOfBirth);
    filled += fill("workPermitIssueDate", d.issueDate);
    filled += fill("workPermitExpiryDate", d.expiryDate);
    filled += fill("passExpiry", d.expiryDate);
    if (filled === 0) toast.info("Nothing new to fill — check the values against the document");
    else toast.success(`${filled} field(s) filled from the IPA — verify before saving`);
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
        <Field label="P-File Number (primary identifier)">
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
            <AlertDescription>P-File Number {code} is already in use. Choose another.</AlertDescription>
          </Alert>
        ) : prefixMismatch ? (
          <Alert className="sm:col-span-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This P-File Number does not match the {branch} prefix ({expectedPrefix}). Allowed, but please confirm
              it is intentional. Suggested: {nextEmployeeCode(branch)}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="pass">Work pass</TabsTrigger>
          <TabsTrigger value="pay">Compensation</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full legal name">
              <Input name="name" defaultValue={employee?.name} required />
            </Field>
            <Field label="Preferred name">
              <Input name="preferredName" defaultValue={employee?.preferredName ?? ""} />
            </Field>
            <Field label="Date of birth">
              <Input name="dateOfBirth" type="date" defaultValue={dateValue(employee?.dateOfBirth)} />
            </Field>
            <Field label="Gender">
              <Pick name="gender" options={["Male", "Female", "Other"]} defaultValue={employee?.gender} />
            </Field>
            <Field label="Nationality">
              <Input name="nationality" defaultValue={employee?.nationality} required />
            </Field>
            <Field label="Marital status">
              <Pick
                name="maritalStatus"
                options={["Single", "Married", "Divorced", "Widowed"]}
                defaultValue={employee?.maritalStatus}
              />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={employee?.email ?? ""} />
            </Field>
            <Field label="Mobile phone">
              <Input name="phone" defaultValue={employee?.phone ?? ""} />
            </Field>
            <Field label="Alternative phone">
              <Input name="altPhone" defaultValue={employee?.altPhone ?? ""} />
            </Field>
            <Field label="Postal code">
              <Input name="postalCode" defaultValue={employee?.postalCode ?? ""} />
            </Field>
          </div>
          <Field label="Singapore address">
            <Input name="address" defaultValue={employee?.address ?? ""} />
          </Field>
          <Field label="Home-country address">
            <Input name="homeCountryAddress" defaultValue={employee?.homeCountryAddress ?? ""} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Emergency contact name">
              <Input name="emergencyContact" defaultValue={employee?.emergencyContact ?? ""} />
            </Field>
            <Field label="Relationship">
              <Input name="emergencyRelation" defaultValue={employee?.emergencyRelation ?? ""} />
            </Field>
            <Field label="Emergency phone">
              <Input name="emergencyPhone" defaultValue={employee?.emergencyPhone ?? ""} />
            </Field>
            <Field label="Emergency email">
              <Input name="emergencyEmail" defaultValue={employee?.emergencyEmail ?? ""} />
            </Field>
          </div>
          <FileUpload
            name="photoUrl"
            label="Profile photo (stored in Cloudflare R2)"
            folder="photos"
            defaultValue={employee?.photoUrl || ""}
          />
        </TabsContent>

        <TabsContent value="employment" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Input name="department" defaultValue={employee?.department ?? ""} />
            </Field>
            <Field label="Employment type">
              <Pick name="employmentType" options={EMPLOYMENT_TYPES} defaultValue={employee?.employmentType ?? "Full Time"} />
            </Field>
            <Field label="Worker category">
              <Pick name="workerCategory" options={WORKER_CATEGORIES} defaultValue={employee?.workerCategory ?? "General Worker"} />
            </Field>
            <Field label="Job title">
              <Input name="jobTitle" defaultValue={employee?.jobTitle ?? ""} />
            </Field>
            <Field label="Designation">
              <Pick name="trade" options={TRADES} defaultValue={employee?.trade || TRADES[0]} />
            </Field>
            <Field label="Secondary skills">
              <Input name="secondarySkills" defaultValue={employee?.secondarySkills ?? ""} placeholder="Comma separated" />
            </Field>
            <Field label="Application date">
              <Input name="applicationDate" type="date" defaultValue={dateValue(employee?.applicationDate)} />
            </Field>
            <Field label="Joining date">
              <Input name="joinedOn" type="date" defaultValue={dateValue(employee?.joinedOn)} required />
            </Field>
            <Field label="Confirmation date">
              <Input name="confirmationDate" type="date" defaultValue={dateValue(employee?.confirmationDate)} />
            </Field>
            <Field label="Contract start">
              <Input name="contractStart" type="date" defaultValue={dateValue(employee?.contractStart)} />
            </Field>
            <Field label="Contract end">
              <Input name="contractEnd" type="date" defaultValue={dateValue(employee?.contractEnd)} />
            </Field>
            <Field label="Employment status">
              <Pick name="status" options={EMPLOYEE_STATUSES} defaultValue={employee?.status || "Active"} />
            </Field>
            <Field label="Deployment status">
              <Pick name="deploymentStatus" options={DEPLOYMENT_STATUSES} defaultValue={employee?.deploymentStatus ?? "Available"} />
            </Field>
            <Field label="Reporting manager">
              <Input name="reportingManager" defaultValue={employee?.reportingManager ?? ""} />
            </Field>
            <Field label="Site supervisor">
              <Input name="siteSupervisor" defaultValue={employee?.siteSupervisor ?? ""} />
            </Field>
            <Field label="Last working date">
              <Input name="lastWorkingDate" type="date" defaultValue={dateValue(employee?.lastWorkingDate)} />
            </Field>
            <Field label="Exit reason">
              <Input name="exitReason" defaultValue={employee?.exitReason ?? ""} />
            </Field>
          </div>
          <Field label="Internal notes (HR only)">
            <Textarea name="internalNotes" defaultValue={employee?.internalNotes ?? ""} rows={3} />
          </Field>
        </TabsContent>

        <TabsContent value="pass" className="mt-4 space-y-4">
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
              defaultValue={ipaUrl}
              onUploaded={(url) => setIpaUrl(url)}
            />
            {ipaUrl ? (
              <div className="mt-3 overflow-hidden rounded-md border">
                <iframe src={ipaUrl} title="IPA preview" className="h-[420px] w-full bg-muted" />
                <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                  Use “Auto-fill from IPA” to read this document, then check every value below.
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="FIN / NRIC">
              <Input name="fin" defaultValue={employee?.fin} required />
            </Field>
            <Field label="Pass type">
              <Pick name="passType" options={PASS_TYPES} defaultValue={employee?.passType || "Work Permit"} />
            </Field>
            <Field label="Citizenship / PR status (CPF)">
              <Pick
                name="prStatus"
                options={["Citizen", "PR Year 1", "PR Year 2", "PR Year 3+"]}
                defaultValue={employee?.prStatus || "Citizen"}
              />
            </Field>
            <Field label="Ethnic group (SHG fund)">
              <Pick
                name="ethnicGroup"
                options={["Chinese", "Malay", "Indian", "Eurasian", "Others"]}
                defaultValue={employee?.ethnicGroup || "Others"}
              />
            </Field>
            <Field label="Religion (MBMF)">
              <Pick
                name="religion"
                options={["Non-Muslim", "Muslim"]}
                defaultValue={employee?.religion || "Non-Muslim"}
              />
            </Field>
            <Field label="Work Permit number">
              <Input name="workPermitNumber" defaultValue={employee?.workPermitNumber ?? ""} />
            </Field>
            <Field label="Work Permit issue date">
              <Input name="workPermitIssueDate" type="date" defaultValue={dateValue(employee?.workPermitIssueDate)} />
            </Field>
            <Field label="Work Permit expiry date">
              <Input name="workPermitExpiryDate" type="date" defaultValue={dateValue(employee?.workPermitExpiryDate)} />
            </Field>
            <Field label="Pass expiry">
              <Input name="passExpiry" type="date" defaultValue={dateValue(employee?.passExpiry)} />
            </Field>
            <Field label="Passport number">
              <Input name="passportNumber" defaultValue={employee?.passportNumber ?? ""} />
            </Field>
            <Field label="Passport expiry">
              <Input name="passportExpiry" type="date" defaultValue={dateValue(employee?.passportExpiry)} />
            </Field>
            <Field label="Dormitory / accommodation">
              <Input name="dormitory" defaultValue={employee?.dormitory ?? ""} />
            </Field>
            <Field label="Dormitory address">
              <Input name="dormitoryAddress" defaultValue={employee?.dormitoryAddress ?? ""} />
            </Field>
            <Field label="Medical insurance expiry">
              <Input name="medicalInsuranceExpiry" type="date" defaultValue={dateValue(employee?.medicalInsuranceExpiry)} />
            </Field>
            <Field label="Medical examination due">
              <Input name="medicalCheckupDue" type="date" defaultValue={dateValue(employee?.medicalCheckupDue)} />
            </Field>
            <Field label="Levy tier (MOM)">
              <Pick
                name="levyTier"
                options={["Higher Skilled", "Basic Skilled"]}
                defaultValue={employee?.levyTier ?? "Basic Skilled"}
              />
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="pay" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Basic salary (S$)">
              <Input name="basicSalary" type="number" step="0.01" defaultValue={employee?.basicSalary ?? 0} required />
            </Field>
            <Field label="OT rate per hour (S$)">
              <Input name="otRate" type="number" step="0.01" defaultValue={employee?.otRate ?? 0} />
            </Field>
            <Field label="Normal working hours / day">
              <Input name="normalHours" type="number" step="0.5" defaultValue={employee?.normalHours ?? 8} />
            </Field>
            <Field label="Monthly levy (S$)">
              <Input name="levyRate" type="number" step="0.01" defaultValue={employee?.levyRate ?? 0} />
            </Field>
            <Field label="Payroll group">
              <Input name="payrollGroup" defaultValue={employee?.payrollGroup ?? ""} />
            </Field>
            <Field label="Payroll frequency">
              <Pick name="payrollFrequency" options={PAYROLL_FREQUENCIES} defaultValue={employee?.payrollFrequency ?? "Monthly"} />
            </Field>
            <Field label="Bank name">
              <Input name="bankName" defaultValue={employee?.bankName ?? ""} />
            </Field>
            <Field label="Bank account reference">
              <Input name="bankAccount" defaultValue={employee?.bankAccount ?? ""} />
            </Field>
            <Field label="Account holder name">
              <Input name="accountHolderName" defaultValue={employee?.accountHolderName ?? ""} />
            </Field>
            <Field label="Payment method">
              <Pick name="paymentMethod" options={PAYMENT_METHODS} defaultValue={employee?.paymentMethod ?? "Bank Transfer"} />
            </Field>
          </div>
          <Field label="Remarks">
            <Textarea name="remarks" defaultValue={employee?.remarks ?? ""} rows={2} />
          </Field>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-2">
        <Button type="submit">{submitLabel ?? (employee ? "Save changes" : "Register employee")}</Button>
      </div>
    </form>
  );
}