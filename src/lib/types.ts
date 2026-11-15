export type AppRole = "admin" | "manager" | "supervisor" | "client" | "hr" | "payroll";

export interface User {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive";
  branch?: string;
  createdAt: string;
}


export type PassType = "Work Permit" | "S Pass" | "Employment Pass" | "Singaporean/PR";

/** MOM work pass lifecycle stages, in order. */
export type WpStage =
  | "IPA Issued"
  | "Arrived"
  | "Medical Cleared"
  | "Card Issued"
  | "Active"
  | "Cancellation Pending"
  | "Cancelled"
  | "Repatriated";

export type SecurityBondStatus = "Not Required" | "Active" | "Discharged" | "Forfeited";

/** Construction/Process WP skill classification (MOM). */
export type SkillLevel = "Basic Skilled" | "Higher Skilled";
/** Certificate that supports a Higher Skilled upgrade. */
export type SkillCertType = "TCTO" | "SETO" | "Multi-Skilling (MSC)" | "Skills Evaluation (SEC(K))" | "Other";
/** IR21 tax clearance state for departing foreign employees. */
export type Ir21Status = "Not Required" | "Pending" | "Filed" | "Cleared";
/** Sectors covered by the Progressive Wage Model. */
export type PwmSector = "None" | "Cleaning" | "Security" | "Landscape" | "Lift & Escalator" | "Waste Management" | "Retail" | "Food Services" | "Administration" | "Drivers";

export type EmployeeStatus =
  | "Draft"
  | "Pending Approval"
  | "Pending Profile Completion"
  | "Pending Verification"
  | "Active"
  | "Inactive"
  | "On Leave"
  | "Deployed"
  | "Suspended"
  | "Resigned"
  | "Terminated"
  | "Repatriated"
  | "Archived";

export type DeploymentStatus = "Available" | "Deployed" | "On Leave" | "Blocked" | "Not Deployable";
export type EmploymentType = "Full Time" | "Part Time" | "Contract" | "Casual" | "Project Based";
export type WorkerCategory = "Skilled" | "Semi-Skilled" | "General Worker" | "Supervisor" | "Office Staff" | "Driver";
export type PaymentMethod = "Bank Transfer" | "GIRO" | "PayNow" | "Cash" | "Cheque";
export type PayrollFrequency = "Monthly" | "Bi-Weekly" | "Weekly" | "Daily";

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  nationality: string;
  fin: string;
  passType: PassType;
  passExpiry: string; // ISO date or "-"
  trade: string;
  site: string | null;
  status: EmployeeStatus;
  basicSalary: number;
  joinedOn: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  levyRate?: number;
  dormitory?: string;
  photoUrl?: string;
  branch?: string;
  companyId?: string;
  remarks?: string;
  // --- Phase 2: personal information ---
  preferredName?: string;
  dateOfBirth?: string;
  gender?: "Male" | "Female" | "Other";
  maritalStatus?: "Single" | "Married" | "Divorced" | "Widowed";
  altPhone?: string;
  homeCountryAddress?: string;
  postalCode?: string;
  emergencyRelation?: string;
  emergencyEmail?: string;
  bankName?: string;
  bankAccount?: string;
  paymentMethod?: PaymentMethod;
  // --- Phase 2: employment information ---
  department?: string;
  employmentType?: EmploymentType;
  workerCategory?: WorkerCategory;
  jobTitle?: string;
  secondarySkills?: string;
  applicationDate?: string;
  confirmationDate?: string;
  contractStart?: string;
  contractEnd?: string;
  deploymentStatus?: DeploymentStatus;
  reportingManager?: string;
  siteSupervisor?: string;
  payrollGroup?: string;
  payrollFrequency?: PayrollFrequency;
  lastWorkingDate?: string;
  exitReason?: string;
  internalNotes?: string;
  // Printed IPA particulars; independent of operational payroll settings.
  highestQualification?: string;
  fatherName?: string;
  motherName?: string;
  criminalRecord?: "Yes" | "No";
  industry?: string;
  occupationCode?: string;
  housingProvided?: "Yes" | "No";
  basicMonthlySalary?: number;
  housingDeduction?: number;
  otherDeduction?: number;
  monthlySalaryAfterDeductions?: number;
  normalHoursPerWeek?: number;
  workingDaysPerWeek?: number;
  dailyRestDayRate?: number;
  agencyName?: string;
  agencyLicence?: string;
  agencyAddress?: string;
  agencyPhone?: string;
  agencyFee?: number;
  overseasCosts?: number;
  employeePaidFees?: "Yes" | "No";
  countryOfBirth?: string;
  raceAsDeclared?: string;
  previouslySingaporeCitizenPr?: "Yes" | "No";
  everArrested?: "Yes" | "No";
  everConvicted?: "Yes" | "No";
  addressHistory?: string;
  travelDocumentType?: string;
  immigrationStatusAtApplication?: string;
  employerName?: string;
  employerCpfSubmissionNumber?: string;
  employerUen?: string;
  employerBusinessActivity?: string;
  employerRegisteredAddress?: string;
  employerCorrespondenceAddress?: string;
  employerPhone?: string;
  sbTransmissionReference?: string;
  temporaryPermitUponApproval?: "Yes" | "No";
  monthlyHousingAllowance?: number;
  monthlyTransportAllowance?: number;
  otherMonthlyAllowances?: number;
  hasFixedMonthlyAllowances?: "Yes" | "No";
  hasFixedMonthlyDeductions?: "Yes" | "No";
  totalFixedMonthlyDeductions?: number;
  agencyUsed?: "Yes" | "No";

  // --- Phase 2: identity / compensation ---
  passportNumber?: string;
  passportExpiry?: string;
  workPermitNumber?: string;
  otRate?: number;
  normalHours?: number;
  userId?: string;
  workPermitIssueDate?: string;
  workPermitExpiryDate?: string;
  dormitoryAddress?: string;
  accountHolderName?: string;
  ipaDocumentUrl?: string;
  /** Scanned P-File (PDF) stored in Cloudflare R2. */
  pFileUrl?: string;
  // --- Singapore statutory payroll ---
  /** Ethnic group drives the Self-Help Group fund (CDAC/MBMF/SINDA/ECF). */
  ethnicGroup?: "Chinese" | "Malay" | "Indian" | "Eurasian" | "Others";
  religion?: "Muslim" | "Non-Muslim";
  /** PR year determines graduated CPF rates. */
  prStatus?: "Citizen" | "PR Year 1" | "PR Year 2" | "PR Year 3+";
  // --- MOM levy & insurance ---
  /** Overrides the tier derived from worker category. */
  levyTier?: "Higher Skilled" | "Basic Skilled";
  medicalInsuranceExpiry?: string;
  medicalCheckupDue?: string;
  // --- Salary compliance (Employment Act / EFMA) ---
  /** Monthly salary declared to MOM on the IPA / Work Permit. */
  declaredSalary?: number;
  /** Fixed monthly allowances counted towards the declared salary. */
  fixedAllowance?: number;
  /** Date the Key Employment Terms were issued in writing. */
  ketIssuedOn?: string;
  /** How salary is actually disbursed (overrides paymentMethod for audits). */
  salaryPaymentMode?: PaymentMethod;
  // --- Work Permit lifecycle (IPA -> card -> cancellation -> repatriation) ---
  wpStage?: WpStage;
  ipaIssueDate?: string;
  ipaExpiryDate?: string;
  arrivalDate?: string;
  medicalCompletedDate?: string;
  wpCardCollectedDate?: string;
  cancellationNotifiedOn?: string;
  cancellationDate?: string;
  repatriationDate?: string;
  securityBondRequired?: boolean;
  securityBondAmount?: number;
  securityBondInsurer?: string;
  securityBondExpiry?: string;
  securityBondStatus?: SecurityBondStatus;
  // --- MYE & skills upgrade (construction / process sector) ---
  skillLevel?: SkillLevel;
  skillCertType?: SkillCertType;
  skillCertNo?: string;
  skillCertExpiry?: string;
  /** Safety course (SCOS / CSOC / SOC) details. */
  safetyCourseType?: string;
  safetyCourseNo?: string;
  safetyCourseExpiry?: string;
  /** MYE (Man-Year Entitlement) allocation reference from the prior project. */
  myeRef?: string;
  /** Man-years consumed by this worker under the MYE allocation. */
  myeManYears?: number;
  // --- Foreign Worker Medical Insurance (FWMI) ---
  insuranceCoverage?: number;
  insuranceInsurer?: string;
  insurancePolicyNo?: string;
  // --- IR21 tax clearance ---
  ir21Required?: boolean;
  ir21FiledOn?: string;
  ir21Status?: Ir21Status;
  ir21AmountWithheld?: number;
  // --- Progressive Wage Model ---
  pwmSector?: PwmSector;
  pwmLevel?: string;
  createdAt: string;
  updatedAt: string;
}

export type ManpowerRequestStatus = "Pending" | "Partially Filled" | "Filled" | "Cancelled";

export interface ManpowerRequest {
  id: string;
  clientId: string;
  projectId?: string;
  title: string;
  startDate: string;
  endDate?: string;
  status: ManpowerRequestStatus;
  requestedBy: string;
  items: ManpowerRequestItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ManpowerRequestItem {
  id: string;
  requestId: string;
  designation: string; // trade
  count: number;
  countFilled: number;
  startDate: string;
  endDate?: string;
  remarks?: string;
}

export type ClientStatus = "Active" | "Inactive" | "Prospect";

export interface Client {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  status: ClientStatus;
  industry?: string;
  contractStart?: string;
  contractEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed" | "Cancelled";

export interface Project {
  id: string;
  clientId: string;
  code: string;
  name: string;
  location: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  requiredWorkers: number;
  projectManager?: string;
  safetyOfficer?: string;
  createdAt: string;
  updatedAt: string;
}

export type SiteStatus = "Active" | "Inactive" | "Completed";

export interface Site {
  id: string;
  projectId: string;
  code: string;
  name: string;
  location: string;
  status: SiteStatus;
  supervisorId?: string;
  requiredWorkers: number;
  /** Geofence centre — punches are measured against this point. */
  lat?: number;
  lng?: number;
  /** Allowed punch radius in metres (default 300). */
  geofenceRadiusM?: number;
  /** Reject punches made outside the radius instead of only flagging them. */
  geofenceEnforced?: boolean;
  /** Selfie proof is mandatory when punching at this site. */
  selfieRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AssignmentStatus = "Pending" | "Approved" | "Rejected" | "Active" | "Ended" | "Transferred";

export interface Assignment {
  id: string;
  employeeId: string;
  siteId: string;
  projectId: string;
  startDate: string;
  endDate?: string;
  status: AssignmentStatus;
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType =
  | "Passport"
  | "Work Permit"
  | "S Pass"
  | "Employment Pass"
  | "IC"
  | "Safety Certificate"
  | "P-File"
  | "Medical Report"
  | "Insurance"
  | "IPA Letter"
  | "In-Principle Approval"
  | "Training Certificate"
  | "Contract"
  | "Bank Letter"
  | "Bank Document"
  | "Other";

export type DocumentStatus = "Valid" | "Expiring Soon" | "Expired" | "Pending" | "Superseded";

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: DocumentType;
  name: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  status: DocumentStatus;
  // --- Phase 3: compliance metadata ---
  docNumber?: string;
  issuingAuthority?: string;
  reminderDays?: number;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  remarks?: string;
  version?: number;
  replacesId?: string;
  uploadedAt: string;
  updatedAt: string;
}

export type AttendanceStatus = "Present" | "Absent" | "On Leave" | "MC" | "Half Day" | "Off" | "Public Holiday" | "Pending";

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  siteId?: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  hoursWorked: number;
  overtimeHours: number;
  notes?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkInAddress?: string;
  checkOutLat?: number;
  checkOutLng?: number;
  checkOutAddress?: string;
  /** Selfie proof keys (R2 object keys) captured with each punch. */
  checkInSelfieKey?: string;
  checkOutSelfieKey?: string;
  /** Punch verification verdict: verified / flagged / unverified. */
  checkInVerification?: string;
  checkOutVerification?: string;
  /** Metres from the site geofence centre at punch time. */
  checkInDistanceM?: number;
  checkOutDistanceM?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BranchPrefix {
  id: string;
  code: string;
  name: string;
  companyId?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeCertification {
  id: string;
  employeeId: string;
  courseName: string;
  issuingBody?: string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimeCardEntry {
  date: string;
  workerName?: string;
  employeeCode?: string;
  fin?: string;
  normalHours?: number;
  otHours?: number;
  reviewApproved?: boolean;
  ocrReviewed?: boolean;
  projectId?: string;
  siteId?: string;
  projectName?: string;
  siteName?: string;
  checkIn?: string;
  checkOut?: string;
  resolution?: "Accepted" | "Corrected" | "Ignored";
  remarks?: string;
  confidence?: number;
  suggestion?: { checkIn?: string; checkOut?: string };
}

export interface TimeCard {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  fileUrl?: string;
  fileName?: string;
  status: "Draft" | "Verified" | "Has Mismatches";
  entries: TimeCardEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ClaimSheetRow {
  date: string;
  workerName?: string;
  employeeCode?: string;
  sourceCardId?: string;
  projectId?: string;
  projectName?: string;
  siteId?: string;
  employeeId?: string;
  checkIn?: string;
  checkOut?: string;
  normalHours: number;
  otHours: number;
  status: string;
  site?: string;
}

export interface ClaimSheet {
  id: string;
  reference: string;
  employeeId?: string;
  companyId?: string;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  totalNormalHours: number;
  totalOtHours: number;
  snapshot: ClaimSheetRow[];
  createdAt?: string;
  updatedAt?: string;
}

export type PayrollStatus = "Draft" | "Pending Approval" | "Approved" | "Paid" | "Rejected";

export type LeaveType =
  | "Annual Leave"
  | "Medical Leave"
  | "Hospitalisation Leave"
  | "Unpaid Leave"
  | "Home Leave"
  | "Compassionate Leave";

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  /** MC / supporting document references stored in R2. */
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  basicSalary: number;
  overtimePay: number;
  allowances: number;
  deductions: number;
  /** Employment Act s.27 deduction breakdown. */
  accommodationDeduction?: number;
  loanRepayment?: number;
  otherDeductions?: number;
  /** Written consent obtained for accommodation/amenity deductions. */
  deductionConsent?: boolean;
  cpfEmployee: number;
  cpfEmployer: number;
  levies: number;
  /** Skills Development Levy (employer). */
  sdl?: number;
  /** Self-Help Group fund name and employee contribution. */
  shgFund?: "CDAC" | "MBMF" | "SINDA" | "ECF" | "None";
  shgAmount?: number;
  /** Gross + employer CPF + SDL + FWL. */
  employerCost?: number;
  /** Overtime hours worked in the month (MOM cap: 72 h). */
  overtimeHours?: number;
  /** When the itemised payslip was issued. */
  payslipIssuedAt?: string;
  netPay: number;
  status: PayrollStatus;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalType = "Assignment" | "Leave" | "Payroll" | "Overtime" | "Transfer" | "Termination" | "Document" | "Other";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Escalated";

export interface Approval {
  id: string;
  type: ApprovalType;
  title: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: ApprovalStatus;
  payload: string;
  approverId?: string;
  approverName?: string;
  approverNotes?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
}

export interface AppBranch {
  id: string;
  name: string;
  location: string;
  status: "Active" | "Inactive";
}

export interface Company {
  id: string;
  code: string;
  name: string;
  legalName: string;
  uen: string;
  industry: string;
  address: string;
  phone: string;
  email: string;
  status: "Active" | "Inactive";
  accent: "primary" | "success" | "warning" | "info" | "destructive";
  /** R2 object key or link for the company logo. */
  logoUrl?: string;
  /** MOM sector — drives levy rates and Dependency Ratio Ceiling. */
  sector?: string;
  /* ---- Manual payment collection (PayNow / bank transfer) ---- */
  paynowType?: "UEN" | "Mobile";
  paynowUen?: string;
  paynowPhone?: string;
  /** Allow the payer to edit the amount in their banking app. */
  paynowEditable?: boolean;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankCode?: string;
  bankSwift?: string;
  paymentInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- Phase 6: Billing & Invoicing ---------------- */
// Types moved to src/lib/billing-types.ts to avoid circular deps and manage complexity.
export type {
  RateUnit, RateAgreement, InvoiceLine, InvoiceStatus, Invoice,
  BillingCycle, BillingSource, ContractStatus, ClientContract,
  QuotationStatus, QuotationLine, Quotation
} from "./billing-types";


export type DormStatus = "Active" | "Inactive" | "Full";

export type MedicalClaimType =
  | "Inpatient" | "Day Surgery" | "Outpatient" | "Specialist" | "Dental" | "Work Injury" | "Other";
export type MedicalClaimStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid";

/** Hospital bill / medical claim raised against a worker's FWMI or WICA cover. */
export interface MedicalClaim {
  id: string;
  companyId?: string;
  employeeId: string;
  claimNo: string;
  claimType: MedicalClaimType;
  treatmentDate?: string;
  provider?: string;
  diagnosis?: string;
  totalAmount: number;
  insurer?: string;
  policyNo?: string;
  insurerPaid: number;
  employerPaid: number;
  employeePaid: number;
  /** WICA work-injury claim (employer bears the cost, MOM reporting applies). */
  workInjury: boolean;
  momReported: boolean;
  status: MedicalClaimStatus;
  submittedOn?: string;
  settledOn?: string;
  documentUrl?: string;
  /** All uploaded hospital bill files (images/PDFs) for this claim. */
  documentUrls?: string[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dormitory {
  id: string;
  companyId?: string;
  name: string;
  address: string;
  operator?: string;
  contactPerson?: string;
  contactPhone?: string;
  capacity: number;
  monthlyRent: number;
  licenseNo?: string;
  /** Total sleeping-area floor space, used for the MOM 4.5 m²/resident rule. */
  floorAreaSqm?: number;
  rooms?: number;
  licenseExpiry?: string;
  lastInspection?: string;
  status: DormStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DormitoryInvoice {
  id: string;
  companyId?: string;
  dormitoryId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string;
  totalAmount: number;
  amountPaid: number;
  status: "Draft" | "Pending" | "Paid" | "Overdue";
  documentUrl?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DormitoryInspection {
  id: string;
  dormitoryId: string;
  inspectionDate: string;
  inspectorName?: string;
  findings?: string;
  documentUrls?: string[];
  status: "Passed" | "Failed" | "Needs Rectification";
  rectificationDeadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DormitoryMovement {
  id: string;
  employeeId: string;
  fromDormitoryId?: string;
  toDormitoryId?: string;
  fromRoom?: string;
  toRoom?: string;
  moveDate: string;
  reason?: string;
  createdAt: string;
}

export type BedStatus = "Occupied" | "Reserved" | "Vacated";

export interface BedAllocation {
  id: string;
  dormitoryId: string;
  employeeId: string;
  roomNo: string;
  bedNo?: string;
  checkInDate: string;
  checkOutDate?: string;
  monthlyRent: number;
  status: BedStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type VehicleStatus = "Active" | "In Workshop" | "Inactive";
export type VehicleType = "Lorry" | "Van" | "Bus" | "Car" | "Pickup";

export interface Vehicle {
  id: string;
  companyId?: string;
  plateNo: string;
  type: VehicleType;
  makeModel?: string;
  capacity: number;
  driverEmployeeId?: string;
  roadTaxExpiry?: string;
  insuranceExpiry?: string;
  inspectionDue?: string;
  status: VehicleStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = "Scheduled" | "Completed" | "Cancelled";

export interface Trip {
  id: string;
  vehicleId: string;
  driverEmployeeId?: string;
  siteId?: string;
  date: string;
  departureTime?: string;
  returnTime?: string;
  route?: string;
  passengers: number;
  status: TripStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Phase 8: assets & PPE ---------- */
export type DriverStatus = "Active" | "Suspended" | "Inactive";
export type DriverIncidentType = "Traffic Offence" | "Accident" | "Damage" | "Summons" | "Other";

export interface DriverProfile {
  id: string;
  employeeId: string;
  licenceNo?: string;
  licenceClasses?: string;
  licenceIssueDate?: string;
  licenceExpiry?: string;
  vocationalLicenceType?: string;
  vocationalLicenceNo?: string;
  vocationalLicenceExpiry?: string;
  yearsExperience: number;
  demeritPoints: number;
  assignedVehicleId?: string;
  medicalCheckupDue?: string;
  status: DriverStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriverIncident {
  id: string;
  employeeId: string;
  vehicleId?: string;
  date: string;
  incidentType: DriverIncidentType;
  description: string;
  demeritPoints: number;
  fineAmount: number;
  paidBy: "Company" | "Driver";
  status: "Open" | "Settled" | "Appealed";
  createdAt: string;
  updatedAt: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  employeeId?: string;
  date: string;
  odometer: number;
  litres: number;
  amount: number;
  station?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetCategory = "PPE" | "Tool" | "Equipment" | "Machinery" | "IT" | "Vehicle Part" | "Other";
export type AssetStatus = "Available" | "Issued" | "Under Repair" | "Lost" | "Damaged" | "Retired";
export type IssuanceStatus = "Issued" | "Returned" | "Lost" | "Damaged";
export type AssetCondition = "New" | "Good" | "Fair" | "Poor" | "Unusable";

export interface Asset {
  id: string;
  companyId?: string;
  assetCode: string;
  name: string;
  category: AssetCategory;
  serialNo?: string;
  brand?: string;
  quantity: number;
  unitCost: number;
  purchaseDate?: string;
  warrantyExpiry?: string;
  calibrationDue?: string;
  location?: string;
  status: AssetStatus;
  remarks?: string;
  reissueMonths?: number;
  minStock?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetIssuance {
  id: string;
  assetId: string;
  employeeId: string;
  siteId?: string;
  quantity: number;
  issueDate: string;
  dueDate?: string;
  returnDate?: string;
  conditionOut: AssetCondition;
  conditionIn?: AssetCondition;
  status: IssuanceStatus;
  remarks?: string;
  size?: string;
  issuedBy?: string;
  receiptNo?: string;
  acknowledged?: boolean;
  ackDate?: string;
  ackSignatureUrl?: string;
  replacementDue?: string;
  costRecovery?: number;
  deductFromSalary?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Phase 9: training & safety ---------- */
export type CourseCategory =
  | "Basic" | "Process Sites" | "Lifting" | "Scaffolding" | "Trade Skills" | "Supervisor"
  | "Safety" | "Statutory" | "Skill" | "Induction" | "Other";
export type TrainingStatus = "Scheduled" | "Completed" | "Failed" | "Expired";
export type IncidentType =
  | "Near Miss" | "First Aid" | "Injury" | "Property Damage" | "Dangerous Occurrence" | "Fatality" | "Other";
export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";
export type IncidentStatus = "Open" | "Under Investigation" | "Closed";

export interface TrainingCourse {
  id: string;
  companyId?: string;
  code?: string;
  name: string;
  category: CourseCategory;
  provider?: string;
  validityMonths?: number;
  mandatory: boolean;
  cost: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingRecord {
  id: string;
  courseId: string;
  employeeId: string;
  completionDate?: string;
  expiryDate?: string;
  certificateNo?: string;
  score?: number;
  cost?: number;
  status: TrainingStatus;
  documentUrl?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyIncident {
  id: string;
  companyId?: string;
  siteId?: string;
  employeeId?: string;
  incidentDate: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description: string;
  actionTaken?: string;
  momReported: boolean;
  lostDays: number;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Phase 10: recruitment ---------- */
export type RequisitionStatus = "Open" | "On Hold" | "Filled" | "Cancelled";
export type CandidateStage =
  | "Applied" | "Screening" | "Interview" | "Selected" | "Offer Sent"
  | "Offer Accepted" | "Onboarding" | "Hired" | "Rejected" | "Withdrawn";
export type CandidateSource = "Agent" | "Referral" | "Walk-in" | "Job Portal" | "Direct" | "Other";

export interface JobRequisition {
  id: string;
  companyId?: string;
  code: string;
  title: string;
  trade: string;
  clientId?: string;
  siteId?: string;
  headcount: number;
  passType?: PassType;
  budgetSalary: number;
  targetDate?: string;
  status: RequisitionStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  requisitionId?: string;
  companyId?: string;
  name: string;
  nationality?: string;
  phone?: string;
  email?: string;
  passportNumber?: string;
  trade?: string;
  experienceYears?: number;
  expectedSalary?: number;
  source: CandidateSource;
  agentName?: string;
  stage: CandidateStage;
  interviewDate?: string;
  offerDate?: string;
  joinDate?: string;
  resumeUrl?: string;
  employeeId?: string;
  /** Agent placement commission agreed for this candidate ($). */
  agentCommission?: number;
  commissionStatus?: "Unbilled" | "Payable" | "Paid";
  commissionPaidOn?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Phase 11: client CRM ---------- */
export type LeadStage =
  | "New" | "Contacted" | "Qualified" | "Quotation Sent" | "Negotiation" | "Won" | "Lost";
export type LeadSource = "Referral" | "Cold Call" | "Website" | "Existing Client" | "Tender" | "Other";
export type ActivityType = "Call" | "Email" | "Meeting" | "Site Visit" | "Quotation" | "Note";

export interface Lead {
  id: string;
  companyId?: string;
  clientId?: string;
  companyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  industry?: string;
  trade?: string;
  headcountNeeded?: number;
  monthlyValue: number;
  source: LeadSource;
  stage: LeadStage;
  probability: number;
  expectedCloseDate?: string;
  ownerName?: string;
  lostReason?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmActivity {
  id: string;
  leadId?: string;
  clientId?: string;
  companyId?: string;
  activityDate: string;
  activityType: ActivityType;
  subject: string;
  notes?: string;
  followUpDate?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Phase 12: finance ---------- */
export type ExpenseCategory =
  | "Levy" | "Salary" | "Dormitory" | "Transport" | "Insurance" | "Medical"
  | "PPE & Assets" | "Training" | "Agent Fee" | "Office" | "Government Fee" | "Other";
export type ExpenseStatus = "Pending" | "Approved" | "Paid" | "Rejected";
export type PaymentMode = "Bank Transfer" | "GIRO" | "Cheque" | "Cash" | "PayNow" | "Other";

export interface Expense {
  id: string;
  companyId?: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  vendor?: string;
  projectId?: string;
  employeeId?: string;
  amount: number;
  gstAmount: number;
  paymentMode?: PaymentMode;
  referenceNo?: string;
  status: ExpenseStatus;
  paidOn?: string;
  documentUrl?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReceipt {
  id: string;
  companyId?: string;
  invoiceId?: string;
  clientId?: string;
  receiptNo: string;
  receivedOn: string;
  amount: number;
  paymentMode: PaymentMode;
  referenceNo?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Phase 13: inventory & procurement ---------- */
export type InventoryCategory =
  | "PPE" | "Consumable" | "Tool" | "Spare Part" | "Stationery" | "Dormitory" | "Other";
export type StockMovementType = "In" | "Out" | "Adjustment" | "Damaged" | "Return";
export type PurchaseOrderStatus = "Draft" | "Sent" | "Partially Received" | "Received" | "Cancelled";

export interface InventoryItem {
  id: string;
  companyId?: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  openingQty: number;
  reorderLevel: number;
  unitCost: number;
  location?: string;
  supplier?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  movementType: StockMovementType;
  quantity: number;
  movementDate: string;
  siteId?: string;
  employeeId?: string;
  poId?: string;
  referenceNo?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  companyId?: string;
  poNo: string;
  supplier: string;
  itemId?: string;
  quantity: number;
  unitCost: number;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  status: PurchaseOrderStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- loan / salary advance ledger ---------- */
export type LoanType = "Salary Advance" | "Personal Loan" | "Air Ticket" | "Agent Fee" | "Other";
export type LoanStatus = "Active" | "Settled" | "Written Off" | "Cancelled";
export type RepaymentSource = "Payroll" | "Cash" | "Bank Transfer" | "Adjustment";

export interface EmployeeLoan {
  id: string;
  companyId?: string;
  employeeId: string;
  loanNo: string;
  loanType: LoanType;
  principal: number;
  issuedOn?: string;
  /** YYYY-MM of the first payroll deduction. */
  firstDeductionMonth?: string;
  monthlyInstallment: number;
  purpose?: string;
  /** MOM requires written worker consent for any loan recovery. */
  consentSigned: boolean;
  consentDocumentUrl?: string;
  status: LoanStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  employeeId: string;
  paidOn?: string;
  /** YYYY-MM payroll month this repayment belongs to. */
  month?: string;
  amount: number;
  source: RepaymentSource;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- Organisation: departments & designations ---------------- */

export interface Department {
  id: string;
  companyId?: string;
  code?: string;
  name: string;
  description?: string;
  headEmployeeId?: string;
  status: "Active" | "Inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Designation {
  id: string;
  companyId?: string;
  departmentId?: string;
  code?: string;
  title: string;
  level?: string;
  description?: string;
  status: "Active" | "Inactive";
  createdAt: string;
  updatedAt: string;
}
