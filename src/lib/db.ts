// Supabase data layer: maps DB rows (snake_case) <-> app types (camelCase).
import { supabase } from "@/integrations/supabase/client";
import type {
  Employee, Client, Project, Site, Assignment, EmployeeDocument,
  Attendance, PayrollEntry, Approval, AuditLog, Company, User,
  LeaveRequest, RateAgreement, Invoice, InvoiceLine,
  Dormitory, BedAllocation, Vehicle, Trip,
  Asset, AssetIssuance,
} from "@/lib/types";
import type { TrainingCourse, TrainingRecord, SafetyIncident } from "@/lib/types";
import type { JobRequisition, Candidate } from "@/lib/types";
import type { Lead, CrmActivity } from "@/lib/types";
import type { Expense, PaymentReceipt } from "@/lib/types";
import type { InventoryItem, StockMovement, PurchaseOrder } from "@/lib/types";
import type {
  BranchPrefix, EmployeeCertification, TimeCard, ClaimSheet,
  TimeCardEntry, ClaimSheetRow,
} from "@/lib/types";
import type { ClientContract } from "@/lib/types";
import type { MedicalClaim } from "@/lib/types";
import type { EmployeeLoan, LoanRepayment } from "@/lib/types";
import type { Department, Designation } from "@/lib/types";

type Row = Record<string, any>;

const d = (v: any) => (v ? String(v).slice(0, 10) : undefined);

/* ---------- mappers: row -> app ---------- */
export const fromCompany = (r: Row): Company => ({
  id: r.id, code: r.code, name: r.name, legalName: r.legal_name ?? "", uen: r.uen ?? "",
  industry: r.industry ?? "", address: r.address ?? "", phone: r.phone ?? "", email: r.email ?? "",
  status: (r.status ?? "Active") as Company["status"], accent: (r.accent ?? "primary") as Company["accent"],
  sector: r.sector ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromEmployee = (r: Row): Employee => ({
  id: r.id, employeeCode: r.employee_code, name: r.name, nationality: r.nationality ?? "",
  fin: r.fin ?? "", passType: (r.pass_type ?? "Work Permit") as Employee["passType"],
  passExpiry: d(r.pass_expiry) ?? "-", trade: r.trade ?? "", site: null,
  status: (r.status ?? "Active") as Employee["status"],
  basicSalary: Number(r.basic_salary ?? 0), levyRate: Number(r.levy_rate ?? 0),
  joinedOn: d(r.joined_on) ?? "", phone: r.phone ?? undefined, email: r.email ?? undefined,
  address: r.address ?? undefined, emergencyContact: r.emergency_contact ?? undefined,
  emergencyPhone: r.emergency_phone ?? undefined, dormitory: r.dormitory ?? undefined,
  photoUrl: r.photo_url ?? undefined,
  branch: r.branch ?? undefined, companyId: r.company_id ?? undefined, remarks: r.remarks ?? undefined,
  preferredName: r.preferred_name ?? undefined, dateOfBirth: d(r.date_of_birth),
  gender: r.gender ?? undefined, maritalStatus: r.marital_status ?? undefined,
  altPhone: r.alt_phone ?? undefined, homeCountryAddress: r.home_country_address ?? undefined,
  postalCode: r.postal_code ?? undefined, emergencyRelation: r.emergency_relation ?? undefined,
  emergencyEmail: r.emergency_email ?? undefined, bankName: r.bank_name ?? undefined,
  bankAccount: r.bank_account ?? undefined, paymentMethod: r.payment_method ?? undefined,
  department: r.department ?? undefined, employmentType: r.employment_type ?? undefined,
  workerCategory: r.worker_category ?? undefined, jobTitle: r.job_title ?? undefined,
  secondarySkills: r.secondary_skills ?? undefined, applicationDate: d(r.application_date),
  confirmationDate: d(r.confirmation_date), contractStart: d(r.contract_start),
  contractEnd: d(r.contract_end), deploymentStatus: r.deployment_status ?? undefined,
  reportingManager: r.reporting_manager ?? undefined, siteSupervisor: r.site_supervisor ?? undefined,
  payrollGroup: r.payroll_group ?? undefined, payrollFrequency: r.payroll_frequency ?? undefined,
  lastWorkingDate: d(r.last_working_date), exitReason: r.exit_reason ?? undefined,
  internalNotes: r.internal_notes ?? undefined, passportNumber: r.passport_number ?? undefined,
  passportExpiry: d(r.passport_expiry), workPermitNumber: r.work_permit_number ?? undefined,
  otRate: r.ot_rate != null ? Number(r.ot_rate) : undefined,
  normalHours: r.normal_hours != null ? Number(r.normal_hours) : undefined,
  userId: r.user_id ?? undefined,
  workPermitIssueDate: d(r.work_permit_issue_date),
  workPermitExpiryDate: d(r.work_permit_expiry_date),
  dormitoryAddress: r.dormitory_address ?? undefined,
  accountHolderName: r.account_holder_name ?? undefined,
  ipaDocumentUrl: r.ipa_document_url ?? undefined,
  ethnicGroup: r.ethnic_group ?? undefined,
  religion: r.religion ?? undefined,
  prStatus: r.pr_status ?? undefined,
  levyTier: r.levy_tier ?? undefined,
  medicalInsuranceExpiry: d(r.medical_insurance_expiry),
  medicalCheckupDue: d(r.medical_checkup_due),
  declaredSalary: r.declared_salary != null ? Number(r.declared_salary) : undefined,
  fixedAllowance: r.fixed_allowance != null ? Number(r.fixed_allowance) : undefined,
  ketIssuedOn: d(r.ket_issued_on),
  salaryPaymentMode: r.salary_payment_mode ?? undefined,
  wpStage: r.wp_stage ?? undefined,
  ipaIssueDate: d(r.ipa_issue_date),
  ipaExpiryDate: d(r.ipa_expiry_date),
  arrivalDate: d(r.arrival_date),
  medicalCompletedDate: d(r.medical_completed_date),
  wpCardCollectedDate: d(r.wp_card_collected_date),
  cancellationNotifiedOn: d(r.cancellation_notified_on),
  cancellationDate: d(r.cancellation_date),
  repatriationDate: d(r.repatriation_date),
  securityBondRequired: r.security_bond_required ?? undefined,
  securityBondAmount: r.security_bond_amount != null ? Number(r.security_bond_amount) : undefined,
  securityBondInsurer: r.security_bond_insurer ?? undefined,
  securityBondExpiry: d(r.security_bond_expiry),
  securityBondStatus: r.security_bond_status ?? undefined,
  skillLevel: r.skill_level ?? undefined,
  skillCertType: r.skill_cert_type ?? undefined,
  skillCertNo: r.skill_cert_no ?? undefined,
  skillCertExpiry: d(r.skill_cert_expiry),
  myeRef: r.mye_ref ?? undefined,
  myeManYears: r.mye_man_years != null ? Number(r.mye_man_years) : undefined,
  insuranceCoverage: r.insurance_coverage != null ? Number(r.insurance_coverage) : undefined,
  insuranceInsurer: r.insurance_insurer ?? undefined,
  insurancePolicyNo: r.insurance_policy_no ?? undefined,
  ir21Required: r.ir21_required ?? undefined,
  ir21FiledOn: d(r.ir21_filed_on),
  ir21Status: r.ir21_status ?? undefined,
  ir21AmountWithheld: r.ir21_amount_withheld != null ? Number(r.ir21_amount_withheld) : undefined,
  pwmSector: r.pwm_sector ?? undefined,
  pwmLevel: r.pwm_level ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromClient = (r: Row): Client => ({
  id: r.id, code: r.code, name: r.name, contactPerson: r.contact_person ?? "", email: r.email ?? "",
  phone: r.phone ?? "", address: r.address ?? "", status: (r.status ?? "Active") as Client["status"],
  industry: r.industry ?? undefined, contractStart: d(r.contract_start), contractEnd: d(r.contract_end),
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromProject = (r: Row): Project => ({
  id: r.id, clientId: r.client_id, code: r.code, name: r.name, location: r.location ?? "",
  status: (r.status ?? "Planning") as Project["status"], startDate: d(r.start_date), endDate: d(r.end_date),
  requiredWorkers: r.required_workers ?? 0, projectManager: r.project_manager ?? undefined,
  safetyOfficer: r.safety_officer ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromSite = (r: Row): Site => ({
  id: r.id, projectId: r.project_id, code: r.code, name: r.name, location: r.location ?? "",
  status: (r.status ?? "Active") as Site["status"], supervisorId: r.supervisor_id ?? undefined,
  requiredWorkers: r.required_workers ?? 0, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromAssignment = (r: Row): Assignment => ({
  id: r.id, employeeId: r.employee_id, siteId: r.site_id, projectId: r.project_id,
  startDate: d(r.start_date) ?? "", endDate: d(r.end_date),
  status: (r.status ?? "Pending") as Assignment["status"], approvedBy: r.approved_by ?? undefined,
  approvedAt: r.approved_at ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromDocument = (r: Row): EmployeeDocument => ({
  id: r.id, employeeId: r.employee_id, type: r.doc_type as EmployeeDocument["type"], name: r.name,
  fileUrl: r.file_url ?? undefined, issueDate: d(r.issue_date), expiryDate: d(r.expiry_date),
  status: (r.status ?? "Valid") as EmployeeDocument["status"],
  docNumber: r.doc_number ?? undefined, issuingAuthority: r.issuing_authority ?? undefined,
  reminderDays: r.reminder_days ?? undefined, verified: r.verified ?? undefined,
  verifiedBy: r.verified_by ?? undefined, verifiedAt: r.verified_at ?? undefined,
  remarks: r.remarks ?? undefined, version: r.version ?? undefined, replacesId: r.replaces_id ?? undefined,
  uploadedAt: r.uploaded_at, updatedAt: r.updated_at,
});

export const fromAttendance = (r: Row): Attendance => ({
  id: r.id, employeeId: r.employee_id, date: d(r.date) ?? "", siteId: r.site_id ?? undefined,
  status: (r.status ?? "Present") as Attendance["status"], checkIn: r.check_in ?? undefined,
  checkOut: r.check_out ?? undefined, hoursWorked: Number(r.hours_worked ?? 0),
  overtimeHours: Number(r.overtime_hours ?? 0), notes: r.notes ?? undefined,
  checkInLat: r.check_in_lat != null ? Number(r.check_in_lat) : undefined,
  checkInLng: r.check_in_lng != null ? Number(r.check_in_lng) : undefined,
  checkInAddress: r.check_in_address ?? undefined,
  checkOutLat: r.check_out_lat != null ? Number(r.check_out_lat) : undefined,
  checkOutLng: r.check_out_lng != null ? Number(r.check_out_lng) : undefined,
  checkOutAddress: r.check_out_address ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromPayroll = (r: Row): PayrollEntry => ({
  id: r.id, employeeId: r.employee_id, month: r.month, basicSalary: Number(r.basic_salary ?? 0),
  overtimePay: Number(r.overtime_pay ?? 0), allowances: Number(r.allowances ?? 0),
  deductions: Number(r.deductions ?? 0), cpfEmployee: Number(r.cpf_employee ?? 0),
  accommodationDeduction: Number(r.accommodation_deduction ?? 0),
  loanRepayment: Number(r.loan_repayment ?? 0),
  otherDeductions: Number(r.other_deductions ?? 0),
  deductionConsent: Boolean(r.deduction_consent ?? false),
  cpfEmployer: Number(r.cpf_employer ?? 0), levies: Number(r.levies ?? 0), netPay: Number(r.net_pay ?? 0),
  sdl: Number(r.sdl ?? 0), shgFund: (r.shg_fund ?? "None") as PayrollEntry["shgFund"],
  shgAmount: Number(r.shg_amount ?? 0), employerCost: Number(r.employer_cost ?? 0),
  overtimeHours: Number(r.overtime_hours ?? 0),
  payslipIssuedAt: r.payslip_issued_at ?? undefined,
  status: (r.status ?? "Draft") as PayrollEntry["status"], approvedBy: r.approved_by ?? undefined,
  approvedAt: r.approved_at ?? undefined, paidAt: r.paid_at ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromApproval = (r: Row): Approval => ({
  id: r.id, type: r.type as Approval["type"], title: r.title, requestedBy: r.requested_by ?? "",
  requestedByName: r.requested_by_name ?? "", requestedAt: r.requested_at,
  status: (r.status ?? "Pending") as Approval["status"],
  payload: typeof r.payload === "string" ? r.payload : (r.payload?.text ?? JSON.stringify(r.payload ?? {})),
  approverId: r.approver_id ?? undefined, approverName: r.approver_name ?? undefined,
  approverNotes: r.approver_notes ?? undefined, decidedAt: r.decided_at ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromAuditLog = (r: Row): AuditLog => ({
  id: r.id, action: r.action, entityType: r.entity_type, entityId: r.entity_id ?? "",
  userId: r.user_id ?? "", userName: r.user_name ?? "System", timestamp: r.created_at,
  details: typeof r.details === "string" ? r.details : (r.details?.text ?? ""),
});

/* ---------- mappers: app -> row ---------- */
const nullDate = (v?: string | null) => (v && v !== "-" ? v.slice(0, 10) : null);

export const toEmployee = (e: Partial<Employee>): Row => ({
  employee_code: e.employeeCode, name: e.name, nationality: e.nationality, fin: e.fin,
  pass_type: e.passType, pass_expiry: nullDate(e.passExpiry), trade: e.trade, status: e.status,
  basic_salary: e.basicSalary, levy_rate: e.levyRate, joined_on: nullDate(e.joinedOn),
  phone: e.phone, email: e.email, address: e.address, emergency_contact: e.emergencyContact,
  emergency_phone: e.emergencyPhone, dormitory: e.dormitory, branch: e.branch,
  photo_url: e.photoUrl || null,
  company_id: e.companyId || null, remarks: e.remarks,
  preferred_name: e.preferredName ?? null, date_of_birth: nullDate(e.dateOfBirth),
  gender: e.gender ?? null, marital_status: e.maritalStatus ?? null,
  alt_phone: e.altPhone ?? null, home_country_address: e.homeCountryAddress ?? null,
  postal_code: e.postalCode ?? null, emergency_relation: e.emergencyRelation ?? null,
  emergency_email: e.emergencyEmail ?? null, bank_name: e.bankName ?? null,
  bank_account: e.bankAccount ?? null, payment_method: e.paymentMethod ?? null,
  department: e.department ?? null, employment_type: e.employmentType ?? null,
  worker_category: e.workerCategory ?? null, job_title: e.jobTitle ?? null,
  secondary_skills: e.secondarySkills ?? null, application_date: nullDate(e.applicationDate),
  confirmation_date: nullDate(e.confirmationDate), contract_start: nullDate(e.contractStart),
  contract_end: nullDate(e.contractEnd), deployment_status: e.deploymentStatus ?? null,
  reporting_manager: e.reportingManager ?? null, site_supervisor: e.siteSupervisor ?? null,
  payroll_group: e.payrollGroup ?? null, payroll_frequency: e.payrollFrequency ?? null,
  last_working_date: nullDate(e.lastWorkingDate), exit_reason: e.exitReason ?? null,
  internal_notes: e.internalNotes ?? null, passport_number: e.passportNumber ?? null,
  passport_expiry: nullDate(e.passportExpiry), work_permit_number: e.workPermitNumber ?? null,
  ot_rate: e.otRate ?? null, normal_hours: e.normalHours ?? null,
  work_permit_issue_date: nullDate(e.workPermitIssueDate),
  work_permit_expiry_date: nullDate(e.workPermitExpiryDate),
  dormitory_address: e.dormitoryAddress ?? null,
  account_holder_name: e.accountHolderName ?? null,
  ipa_document_url: e.ipaDocumentUrl ?? null,
  ethnic_group: e.ethnicGroup ?? null,
  religion: e.religion ?? null,
  pr_status: e.prStatus ?? null,
  levy_tier: e.levyTier ?? null,
  medical_insurance_expiry: nullDate(e.medicalInsuranceExpiry),
  medical_checkup_due: nullDate(e.medicalCheckupDue),
  declared_salary: e.declaredSalary ?? null,
  fixed_allowance: e.fixedAllowance ?? null,
  ket_issued_on: nullDate(e.ketIssuedOn),
  salary_payment_mode: e.salaryPaymentMode ?? null,
  wp_stage: e.wpStage ?? null,
  ipa_issue_date: nullDate(e.ipaIssueDate),
  ipa_expiry_date: nullDate(e.ipaExpiryDate),
  arrival_date: nullDate(e.arrivalDate),
  medical_completed_date: nullDate(e.medicalCompletedDate),
  wp_card_collected_date: nullDate(e.wpCardCollectedDate),
  cancellation_notified_on: nullDate(e.cancellationNotifiedOn),
  cancellation_date: nullDate(e.cancellationDate),
  repatriation_date: nullDate(e.repatriationDate),
  security_bond_required: e.securityBondRequired ?? null,
  security_bond_amount: e.securityBondAmount ?? null,
  security_bond_insurer: e.securityBondInsurer ?? null,
  security_bond_expiry: nullDate(e.securityBondExpiry),
  security_bond_status: e.securityBondStatus ?? null,
  skill_level: e.skillLevel ?? null,
  skill_cert_type: e.skillCertType ?? null,
  skill_cert_no: e.skillCertNo ?? null,
  skill_cert_expiry: nullDate(e.skillCertExpiry),
  mye_ref: e.myeRef ?? null,
  mye_man_years: e.myeManYears ?? null,
  insurance_coverage: e.insuranceCoverage ?? null,
  insurance_insurer: e.insuranceInsurer ?? null,
  insurance_policy_no: e.insurancePolicyNo ?? null,
  ir21_required: e.ir21Required ?? null,
  ir21_filed_on: nullDate(e.ir21FiledOn),
  ir21_status: e.ir21Status ?? null,
  ir21_amount_withheld: e.ir21AmountWithheld ?? null,
  pwm_sector: e.pwmSector ?? null,
  pwm_level: e.pwmLevel ?? null,
});

export const toClient = (c: Partial<Client>): Row => ({
  code: c.code, name: c.name, contact_person: c.contactPerson, email: c.email, phone: c.phone,
  address: c.address, industry: c.industry, status: c.status,
  contract_start: nullDate(c.contractStart), contract_end: nullDate(c.contractEnd),
});

export const toProject = (p: Partial<Project>): Row => ({
  client_id: p.clientId, code: p.code, name: p.name, location: p.location, status: p.status,
  start_date: nullDate(p.startDate), end_date: nullDate(p.endDate),
  required_workers: p.requiredWorkers, project_manager: p.projectManager, safety_officer: p.safetyOfficer,
});

export const toSite = (s: Partial<Site>): Row => ({
  project_id: s.projectId, code: s.code, name: s.name, location: s.location, status: s.status,
  supervisor_id: s.supervisorId || null, required_workers: s.requiredWorkers,
});

export const toAssignment = (a: Partial<Assignment>): Row => ({
  employee_id: a.employeeId, site_id: a.siteId, project_id: a.projectId,
  start_date: nullDate(a.startDate), end_date: nullDate(a.endDate), status: a.status,
  approved_by: a.approvedBy || null, approved_at: a.approvedAt || null, remarks: a.remarks,
});

export const toDocument = (x: Partial<EmployeeDocument>): Row => ({
  employee_id: x.employeeId, doc_type: x.type, name: x.name, file_url: x.fileUrl,
  issue_date: nullDate(x.issueDate), expiry_date: nullDate(x.expiryDate), status: x.status,
  doc_number: x.docNumber || null, issuing_authority: x.issuingAuthority || null,
  reminder_days: x.reminderDays ?? null, verified: x.verified ?? false,
  verified_by: x.verifiedBy || null, verified_at: x.verifiedAt || null,
  remarks: x.remarks || null, version: x.version ?? 1, replaces_id: x.replacesId || null,
});

export const toAttendance = (a: Partial<Attendance>): Row => ({
  employee_id: a.employeeId, site_id: a.siteId || null, date: nullDate(a.date), status: a.status,
  check_in: a.checkIn || null, check_out: a.checkOut || null,
  hours_worked: a.hoursWorked ?? 0, overtime_hours: a.overtimeHours ?? 0, notes: a.notes,
  check_in_lat: a.checkInLat ?? null, check_in_lng: a.checkInLng ?? null,
  check_in_address: a.checkInAddress ?? null,
  check_out_lat: a.checkOutLat ?? null, check_out_lng: a.checkOutLng ?? null,
  check_out_address: a.checkOutAddress ?? null,
});

export const toPayroll = (p: Partial<PayrollEntry>): Row => ({
  employee_id: p.employeeId, month: p.month, basic_salary: p.basicSalary ?? 0,
  overtime_pay: p.overtimePay ?? 0, allowances: p.allowances ?? 0, deductions: p.deductions ?? 0,
  accommodation_deduction: p.accommodationDeduction ?? 0,
  loan_repayment: p.loanRepayment ?? 0,
  other_deductions: p.otherDeductions ?? 0,
  deduction_consent: p.deductionConsent ?? false,
  cpf_employee: p.cpfEmployee ?? 0, cpf_employer: p.cpfEmployer ?? 0, levies: p.levies ?? 0,
  sdl: p.sdl ?? 0, shg_fund: p.shgFund ?? "None", shg_amount: p.shgAmount ?? 0,
  employer_cost: p.employerCost ?? 0,
  overtime_hours: p.overtimeHours ?? 0,
  payslip_issued_at: p.payslipIssuedAt || null,
  net_pay: p.netPay ?? 0, status: p.status, approved_by: p.approvedBy || null,
  approved_at: p.approvedAt || null, paid_at: p.paidAt || null,
});

export const toApproval = (a: Partial<Approval>): Row => ({
  type: a.type, title: a.title, requested_by: a.requestedBy || null,
  requested_by_name: a.requestedByName, status: a.status,
  payload: { text: a.payload ?? "" }, approver_id: a.approverId || null,
  approver_name: a.approverName, approver_notes: a.approverNotes, decided_at: a.decidedAt || null,
});

export const toCompany = (c: Partial<Company>): Row => ({
  code: c.code, name: c.name, legal_name: c.legalName, uen: c.uen, industry: c.industry,
  address: c.address, phone: c.phone, email: c.email, status: c.status, accent: c.accent,
  sector: c.sector ?? null,
});

export const fromLeave = (r: Row): LeaveRequest => ({
  id: r.id, employeeId: r.employee_id, type: (r.leave_type ?? "Annual Leave") as LeaveRequest["type"],
  startDate: d(r.start_date) ?? "", endDate: d(r.end_date) ?? "", days: Number(r.days ?? 0),
  reason: r.reason ?? undefined, status: (r.status ?? "Pending") as LeaveRequest["status"],
  approvedBy: r.approved_by ?? undefined, approvedAt: r.approved_at ?? undefined,
  remarks: r.remarks ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toLeave = (l: Partial<LeaveRequest>): Row => ({
  employee_id: l.employeeId, leave_type: l.type, start_date: nullDate(l.startDate),
  end_date: nullDate(l.endDate), days: l.days ?? 0, reason: l.reason ?? null,
  status: l.status, approved_by: l.approvedBy || null, approved_at: l.approvedAt || null,
  remarks: l.remarks ?? null,
});

/* ---------- billing ---------- */
export const fromRate = (r: Row): RateAgreement => ({
  id: r.id, clientId: r.client_id, projectId: r.project_id ?? undefined,
  trade: r.trade ?? "", unit: (r.unit ?? "Hourly") as RateAgreement["unit"],
  normalRate: Number(r.normal_rate ?? 0), otRate: Number(r.ot_rate ?? 0),
  effectiveFrom: d(r.effective_from) ?? "", effectiveTo: d(r.effective_to),
  status: (r.status ?? "Active") as RateAgreement["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toRate = (a: Partial<RateAgreement>): Row => ({
  client_id: a.clientId, project_id: a.projectId || null, trade: a.trade, unit: a.unit,
  normal_rate: a.normalRate ?? 0, ot_rate: a.otRate ?? 0,
  effective_from: nullDate(a.effectiveFrom), effective_to: nullDate(a.effectiveTo),
  status: a.status, remarks: a.remarks ?? null,
});

export const fromInvoice = (r: Row): Invoice => ({
  id: r.id, companyId: r.company_id ?? "", clientId: r.client_id,
  projectId: r.project_id ?? undefined, invoiceNo: r.invoice_no ?? "",
  periodStart: d(r.period_start) ?? "", periodEnd: d(r.period_end) ?? "",
  issueDate: d(r.issue_date) ?? "", dueDate: d(r.due_date) ?? "",
  lines: Array.isArray(r.lines) ? (r.lines as InvoiceLine[]) : [],
  subtotal: Number(r.subtotal ?? 0), gstRate: Number(r.gst_rate ?? 0),
  gstAmount: Number(r.gst_amount ?? 0), total: Number(r.total ?? 0),
  amountPaid: Number(r.amount_paid ?? 0),
  status: (r.status ?? "Draft") as Invoice["status"], notes: r.notes ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toInvoice = (i: Partial<Invoice>): Row => ({
  company_id: i.companyId || null, client_id: i.clientId, project_id: i.projectId || null,
  invoice_no: i.invoiceNo, period_start: nullDate(i.periodStart), period_end: nullDate(i.periodEnd),
  issue_date: nullDate(i.issueDate), due_date: nullDate(i.dueDate), lines: i.lines ?? [],
  subtotal: i.subtotal ?? 0, gst_rate: i.gstRate ?? 0, gst_amount: i.gstAmount ?? 0,
  total: i.total ?? 0, amount_paid: i.amountPaid ?? 0, status: i.status, notes: i.notes ?? null,
});


/* ---------- Phase 11: client CRM ---------- */
export const fromLead = (r: Row): Lead => ({
  id: r.id, companyId: r.company_id ?? undefined, clientId: r.client_id ?? undefined,
  companyName: r.company_name ?? "", contactPerson: r.contact_person ?? undefined,
  phone: r.phone ?? undefined, email: r.email ?? undefined, industry: r.industry ?? undefined,
  trade: r.trade ?? undefined,
  headcountNeeded: r.headcount_needed == null ? undefined : Number(r.headcount_needed),
  monthlyValue: Number(r.monthly_value ?? 0),
  source: (r.source ?? "Other") as Lead["source"],
  stage: (r.stage ?? "New") as Lead["stage"],
  probability: Number(r.probability ?? 0),
  expectedCloseDate: d(r.expected_close_date), ownerName: r.owner_name ?? undefined,
  lostReason: r.lost_reason ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toLead = (x: Partial<Lead>): Row => ({
  company_id: x.companyId || null, client_id: x.clientId || null,
  company_name: x.companyName ?? "", contact_person: x.contactPerson ?? null,
  phone: x.phone ?? null, email: x.email ?? null, industry: x.industry ?? null,
  trade: x.trade ?? null, headcount_needed: x.headcountNeeded ?? null,
  monthly_value: x.monthlyValue ?? 0, source: x.source, stage: x.stage,
  probability: x.probability ?? 0, expected_close_date: nullDate(x.expectedCloseDate),
  owner_name: x.ownerName ?? null, lost_reason: x.lostReason ?? null, remarks: x.remarks ?? null,
});

export const fromActivity = (r: Row): CrmActivity => ({
  id: r.id, leadId: r.lead_id ?? undefined, clientId: r.client_id ?? undefined,
  companyId: r.company_id ?? undefined, activityDate: d(r.activity_date) ?? "",
  activityType: (r.activity_type ?? "Note") as CrmActivity["activityType"],
  subject: r.subject ?? "", notes: r.notes ?? undefined,
  followUpDate: d(r.follow_up_date), done: !!r.done,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toActivity = (x: Partial<CrmActivity>): Row => ({
  lead_id: x.leadId || null, client_id: x.clientId || null, company_id: x.companyId || null,
  activity_date: nullDate(x.activityDate), activity_type: x.activityType,
  subject: x.subject ?? "", notes: x.notes ?? null,
  follow_up_date: nullDate(x.followUpDate), done: !!x.done,
});

/* ---------- bulk load ---------- */
export const fromRequisition = (r: Row): JobRequisition => ({
  id: r.id, companyId: r.company_id ?? undefined, code: r.code ?? "", title: r.title,
  trade: r.trade ?? "", clientId: r.client_id ?? undefined, siteId: r.site_id ?? undefined,
  headcount: Number(r.headcount ?? 1), passType: (r.pass_type ?? undefined) as JobRequisition["passType"],
  budgetSalary: Number(r.budget_salary ?? 0), targetDate: d(r.target_date),
  status: (r.status ?? "Open") as JobRequisition["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toRequisition = (x: Partial<JobRequisition>): Row => ({
  company_id: x.companyId || null, code: x.code ?? "", title: x.title, trade: x.trade ?? "",
  client_id: x.clientId || null, site_id: x.siteId || null, headcount: x.headcount ?? 1,
  pass_type: x.passType || null, budget_salary: x.budgetSalary ?? 0,
  target_date: nullDate(x.targetDate), status: x.status, remarks: x.remarks ?? null,
});

export const fromCandidate = (r: Row): Candidate => ({
  id: r.id, requisitionId: r.requisition_id ?? undefined, companyId: r.company_id ?? undefined,
  name: r.name, nationality: r.nationality ?? undefined, phone: r.phone ?? undefined,
  email: r.email ?? undefined, passportNumber: r.passport_number ?? undefined,
  trade: r.trade ?? undefined,
  experienceYears: r.experience_years == null ? undefined : Number(r.experience_years),
  expectedSalary: r.expected_salary == null ? undefined : Number(r.expected_salary),
  source: (r.source ?? "Direct") as Candidate["source"], agentName: r.agent_name ?? undefined,
  stage: (r.stage ?? "Applied") as Candidate["stage"], interviewDate: d(r.interview_date),
  offerDate: d(r.offer_date), joinDate: d(r.join_date), resumeUrl: r.resume_url ?? undefined,
  employeeId: r.employee_id ?? undefined, remarks: r.remarks ?? undefined,
  agentCommission: r.agent_commission == null ? undefined : Number(r.agent_commission),
  commissionStatus: (r.commission_status ?? "Unbilled") as Candidate["commissionStatus"],
  commissionPaidOn: d(r.commission_paid_on),
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toCandidate = (x: Partial<Candidate>): Row => ({
  requisition_id: x.requisitionId || null, company_id: x.companyId || null, name: x.name,
  nationality: x.nationality ?? null, phone: x.phone ?? null, email: x.email ?? null,
  passport_number: x.passportNumber ?? null, trade: x.trade ?? null,
  experience_years: x.experienceYears ?? null, expected_salary: x.expectedSalary ?? null,
  source: x.source, agent_name: x.agentName ?? null, stage: x.stage,
  interview_date: nullDate(x.interviewDate), offer_date: nullDate(x.offerDate),
  join_date: nullDate(x.joinDate), resume_url: x.resumeUrl ?? null,
  employee_id: x.employeeId || null, remarks: x.remarks ?? null,
  agent_commission: x.agentCommission ?? 0,
  commission_status: x.commissionStatus ?? "Unbilled",
  commission_paid_on: nullDate(x.commissionPaidOn),
});

/* ---------- bulk load ---------- */
/* ---------- accommodation & transport ---------- */
export const fromDormitory = (r: Row): Dormitory => ({
  id: r.id, companyId: r.company_id ?? undefined, name: r.name, address: r.address ?? "",
  operator: r.operator ?? undefined, contactPerson: r.contact_person ?? undefined,
  contactPhone: r.contact_phone ?? undefined, capacity: Number(r.capacity ?? 0),
  monthlyRent: Number(r.monthly_rent ?? 0), licenseNo: r.license_no ?? undefined,
  floorAreaSqm: Number(r.floor_area_sqm ?? 0), rooms: Number(r.rooms ?? 0),
  licenseExpiry: d(r.license_expiry), lastInspection: d(r.last_inspection),
  status: (r.status ?? "Active") as Dormitory["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toDormitory = (x: Partial<Dormitory>): Row => ({
  company_id: x.companyId || null, name: x.name, address: x.address ?? "",
  operator: x.operator ?? null, contact_person: x.contactPerson ?? null,
  contact_phone: x.contactPhone ?? null, capacity: x.capacity ?? 0,
  monthly_rent: x.monthlyRent ?? 0, license_no: x.licenseNo ?? null,
  floor_area_sqm: x.floorAreaSqm ?? 0, rooms: x.rooms ?? 0,
  license_expiry: nullDate(x.licenseExpiry), last_inspection: nullDate(x.lastInspection),
  status: x.status, remarks: x.remarks ?? null,
});

export const fromAllocation = (r: Row): BedAllocation => ({
  id: r.id, dormitoryId: r.dormitory_id, employeeId: r.employee_id, roomNo: r.room_no ?? "",
  bedNo: r.bed_no ?? undefined, checkInDate: d(r.check_in_date) ?? "",
  checkOutDate: d(r.check_out_date), monthlyRent: Number(r.monthly_rent ?? 0),
  status: (r.status ?? "Occupied") as BedAllocation["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toAllocation = (x: Partial<BedAllocation>): Row => ({
  dormitory_id: x.dormitoryId, employee_id: x.employeeId, room_no: x.roomNo ?? "",
  bed_no: x.bedNo ?? null, check_in_date: nullDate(x.checkInDate),
  check_out_date: nullDate(x.checkOutDate), monthly_rent: x.monthlyRent ?? 0,
  status: x.status, remarks: x.remarks ?? null,
});

export const fromVehicle = (r: Row): Vehicle => ({
  id: r.id, companyId: r.company_id ?? undefined, plateNo: r.plate_no,
  type: (r.vehicle_type ?? "Lorry") as Vehicle["type"], makeModel: r.make_model ?? undefined,
  capacity: Number(r.capacity ?? 0), driverEmployeeId: r.driver_employee_id ?? undefined,
  roadTaxExpiry: d(r.road_tax_expiry), insuranceExpiry: d(r.insurance_expiry),
  inspectionDue: d(r.inspection_due), status: (r.status ?? "Active") as Vehicle["status"],
  remarks: r.remarks ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toVehicle = (x: Partial<Vehicle>): Row => ({
  company_id: x.companyId || null, plate_no: x.plateNo, vehicle_type: x.type,
  make_model: x.makeModel ?? null, capacity: x.capacity ?? 0,
  driver_employee_id: x.driverEmployeeId || null, road_tax_expiry: nullDate(x.roadTaxExpiry),
  insurance_expiry: nullDate(x.insuranceExpiry), inspection_due: nullDate(x.inspectionDue),
  status: x.status, remarks: x.remarks ?? null,
});

export const fromTrip = (r: Row): Trip => ({
  id: r.id, vehicleId: r.vehicle_id, driverEmployeeId: r.driver_employee_id ?? undefined,
  siteId: r.site_id ?? undefined, date: d(r.date) ?? "", departureTime: r.departure_time ?? undefined,
  returnTime: r.return_time ?? undefined, route: r.route ?? undefined,
  passengers: Number(r.passengers ?? 0), status: (r.status ?? "Scheduled") as Trip["status"],
  notes: r.notes ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toTrip = (x: Partial<Trip>): Row => ({
  vehicle_id: x.vehicleId, driver_employee_id: x.driverEmployeeId || null,
  site_id: x.siteId || null, date: nullDate(x.date), departure_time: x.departureTime || null,
  return_time: x.returnTime || null, route: x.route ?? null, passengers: x.passengers ?? 0,
  status: x.status, notes: x.notes ?? null,
});

/* ---------- assets & PPE ---------- */
export const fromAsset = (r: Row): Asset => ({
  id: r.id, companyId: r.company_id ?? undefined, assetCode: r.asset_code ?? "",
  name: r.name, category: (r.category ?? "Tool") as Asset["category"],
  serialNo: r.serial_no ?? undefined, brand: r.brand ?? undefined,
  quantity: Number(r.quantity ?? 0), unitCost: Number(r.unit_cost ?? 0),
  purchaseDate: d(r.purchase_date), warrantyExpiry: d(r.warranty_expiry),
  calibrationDue: d(r.calibration_due), location: r.location ?? undefined,
  status: (r.status ?? "Available") as Asset["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toAsset = (x: Partial<Asset>): Row => ({
  company_id: x.companyId || null, asset_code: x.assetCode ?? "", name: x.name,
  category: x.category, serial_no: x.serialNo ?? null, brand: x.brand ?? null,
  quantity: x.quantity ?? 0, unit_cost: x.unitCost ?? 0,
  purchase_date: nullDate(x.purchaseDate), warranty_expiry: nullDate(x.warrantyExpiry),
  calibration_due: nullDate(x.calibrationDue), location: x.location ?? null,
  status: x.status, remarks: x.remarks ?? null,
});

export const fromIssuance = (r: Row): AssetIssuance => ({
  id: r.id, assetId: r.asset_id, employeeId: r.employee_id, siteId: r.site_id ?? undefined,
  quantity: Number(r.quantity ?? 1), issueDate: d(r.issue_date) ?? "", dueDate: d(r.due_date),
  returnDate: d(r.return_date), conditionOut: (r.condition_out ?? "Good") as AssetIssuance["conditionOut"],
  conditionIn: (r.condition_in ?? undefined) as AssetIssuance["conditionIn"],
  status: (r.status ?? "Issued") as AssetIssuance["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toIssuance = (x: Partial<AssetIssuance>): Row => ({
  asset_id: x.assetId, employee_id: x.employeeId, site_id: x.siteId || null,
  quantity: x.quantity ?? 1, issue_date: nullDate(x.issueDate), due_date: nullDate(x.dueDate),
  return_date: nullDate(x.returnDate), condition_out: x.conditionOut ?? "Good",
  condition_in: x.conditionIn ?? null, status: x.status, remarks: x.remarks ?? null,
});

/* ---------- Phase 9: training & safety ---------- */
export const fromCourse = (r: Row): TrainingCourse => ({
  id: r.id, companyId: r.company_id ?? undefined, code: r.code ?? "", name: r.name,
  category: (r.category ?? "Safety") as TrainingCourse["category"], provider: r.provider ?? undefined,
  validityMonths: r.validity_months ?? undefined, mandatory: !!r.mandatory,
  cost: Number(r.cost ?? 0), remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toCourse = (x: Partial<TrainingCourse>): Row => ({
  company_id: x.companyId || null, code: x.code ?? "", name: x.name, category: x.category,
  provider: x.provider ?? null, validity_months: x.validityMonths ?? null,
  mandatory: !!x.mandatory, cost: x.cost ?? 0, remarks: x.remarks ?? null,
});

export const fromTraining = (r: Row): TrainingRecord => ({
  id: r.id, courseId: r.course_id, employeeId: r.employee_id,
  completionDate: d(r.completion_date), expiryDate: d(r.expiry_date),
  certificateNo: r.certificate_no ?? undefined,
  score: r.score === null || r.score === undefined ? undefined : Number(r.score),
  cost: r.cost === null || r.cost === undefined ? undefined : Number(r.cost),
  status: (r.status ?? "Completed") as TrainingRecord["status"],
  documentUrl: r.document_url ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toTraining = (x: Partial<TrainingRecord>): Row => ({
  course_id: x.courseId, employee_id: x.employeeId,
  completion_date: nullDate(x.completionDate), expiry_date: nullDate(x.expiryDate),
  certificate_no: x.certificateNo ?? null, score: x.score ?? null, cost: x.cost ?? null,
  status: x.status, document_url: x.documentUrl ?? null, remarks: x.remarks ?? null,
});

export const fromIncident = (r: Row): SafetyIncident => ({
  id: r.id, companyId: r.company_id ?? undefined, siteId: r.site_id ?? undefined,
  employeeId: r.employee_id ?? undefined, incidentDate: d(r.incident_date) ?? "",
  incidentType: (r.incident_type ?? "Near Miss") as SafetyIncident["incidentType"],
  severity: (r.severity ?? "Low") as SafetyIncident["severity"],
  description: r.description ?? "", actionTaken: r.action_taken ?? undefined,
  momReported: !!r.mom_reported, lostDays: Number(r.lost_days ?? 0),
  status: (r.status ?? "Open") as SafetyIncident["status"],
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toIncident = (x: Partial<SafetyIncident>): Row => ({
  company_id: x.companyId || null, site_id: x.siteId || null, employee_id: x.employeeId || null,
  incident_date: nullDate(x.incidentDate), incident_type: x.incidentType, severity: x.severity,
  description: x.description ?? "", action_taken: x.actionTaken ?? null,
  mom_reported: !!x.momReported, lost_days: x.lostDays ?? 0, status: x.status,
});

/* ---------- bulk load ---------- */
export interface LoadedData {
  companies: Company[]; employees: Employee[]; clients: Client[]; projects: Project[];
  sites: Site[]; assignments: Assignment[]; documents: EmployeeDocument[];
  attendance: Attendance[]; payroll: PayrollEntry[]; approvals: Approval[];
  auditLogs: AuditLog[]; users: User[]; leaveRequests: LeaveRequest[];
  rateAgreements: RateAgreement[]; invoices: Invoice[];
  dormitories: Dormitory[]; allocations: BedAllocation[]; vehicles: Vehicle[]; trips: Trip[];
  assets: Asset[]; issuances: AssetIssuance[];
  courses: TrainingCourse[]; trainings: TrainingRecord[]; incidents: SafetyIncident[];
  requisitions: JobRequisition[]; candidates: Candidate[];
  leads: Lead[]; activities: CrmActivity[];
  expenses: Expense[]; receipts: PaymentReceipt[];
  inventory: InventoryItem[]; movements: StockMovement[]; purchaseOrders: PurchaseOrder[];
  branchPrefixes: BranchPrefix[]; certifications: EmployeeCertification[];
  timeCards: TimeCard[]; claimSheets: ClaimSheet[];
  contracts: ClientContract[];
  medicalClaims: MedicalClaim[];
  loans: EmployeeLoan[];
  loanRepayments: LoanRepayment[];
}

/* ---------- organisation: departments & designations ---------- */
/* eslint-disable-next-line */
export const fromDepartment = (r: Row): Department => ({
  id: r.id, companyId: r.company_id ?? undefined, code: r.code ?? "", name: r.name ?? "",
  description: r.description ?? undefined, headEmployeeId: r.head_employee_id ?? undefined,
  status: (r.status ?? "Active") as Department["status"],
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toDepartment = (x: Partial<Department>): Row => ({
  company_id: x.companyId || null, code: x.code ?? "", name: x.name ?? "",
  description: x.description ?? null, head_employee_id: x.headEmployeeId || null,
  status: x.status ?? "Active",
});

export const fromDesignation = (r: Row): Designation => ({
  id: r.id, companyId: r.company_id ?? undefined, departmentId: r.department_id ?? undefined,
  code: r.code ?? "", title: r.title ?? "", level: r.level ?? undefined,
  description: r.description ?? undefined,
  status: (r.status ?? "Active") as Designation["status"],
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toDesignation = (x: Partial<Designation>): Row => ({
  company_id: x.companyId || null, department_id: x.departmentId || null,
  code: x.code ?? "", title: x.title ?? "", level: x.level ?? null,
  description: x.description ?? null, status: x.status ?? "Active",
});


/* ---------- medical claims (FWMI / WICA) ---------- */
export const fromMedicalClaim = (r: Row): MedicalClaim => ({
  id: r.id, companyId: r.company_id ?? undefined, employeeId: r.employee_id,
  claimNo: r.claim_no ?? "", claimType: (r.claim_type ?? "Inpatient") as MedicalClaim["claimType"],
  treatmentDate: d(r.treatment_date), provider: r.provider ?? undefined,
  diagnosis: r.diagnosis ?? undefined, totalAmount: Number(r.total_amount ?? 0),
  insurer: r.insurer ?? undefined, policyNo: r.policy_no ?? undefined,
  insurerPaid: Number(r.insurer_paid ?? 0), employerPaid: Number(r.employer_paid ?? 0),
  employeePaid: Number(r.employee_paid ?? 0), workInjury: !!r.work_injury,
  momReported: !!r.mom_reported,
  status: (r.status ?? "Draft") as MedicalClaim["status"],
  submittedOn: d(r.submitted_on), settledOn: d(r.settled_on),
  documentUrl: r.document_url ?? undefined,
  documentUrls: Array.isArray(r.document_urls)
    ? (r.document_urls as string[]).filter(Boolean)
    : r.document_url ? [r.document_url] : [],
  remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toMedicalClaim = (x: Partial<MedicalClaim>): Row => ({
  company_id: x.companyId || null, employee_id: x.employeeId, claim_no: x.claimNo ?? "",
  claim_type: x.claimType, treatment_date: nullDate(x.treatmentDate),
  provider: x.provider ?? null, diagnosis: x.diagnosis ?? null,
  total_amount: x.totalAmount ?? 0, insurer: x.insurer ?? null, policy_no: x.policyNo ?? null,
  insurer_paid: x.insurerPaid ?? 0, employer_paid: x.employerPaid ?? 0,
  employee_paid: x.employeePaid ?? 0, work_injury: !!x.workInjury, mom_reported: !!x.momReported,
  status: x.status, submitted_on: nullDate(x.submittedOn), settled_on: nullDate(x.settledOn),
  document_url: x.documentUrls?.[0] ?? x.documentUrl ?? null,
  document_urls: x.documentUrls ?? (x.documentUrl ? [x.documentUrl] : []),
  remarks: x.remarks ?? null,
});

/* ---------- client contracts (recurring auto-invoicing) ---------- */
export const fromContract = (r: Row): ClientContract => ({
  id: r.id, companyId: r.company_id ?? undefined, clientId: r.client_id,
  projectId: r.project_id ?? undefined, contractNo: r.contract_no ?? "",
  title: r.title ?? "", startDate: d(r.start_date), endDate: d(r.end_date),
  billingCycle: (r.billing_cycle ?? "Monthly") as ClientContract["billingCycle"],
  billingDay: Number(r.billing_day ?? 1),
  billingSource: (r.billing_source ?? "Timesheet") as ClientContract["billingSource"],
  fixedAmount: Number(r.fixed_amount ?? 0), gstRate: Number(r.gst_rate ?? 9),
  paymentTermsDays: Number(r.payment_terms_days ?? 30),
  autoInvoice: r.auto_invoice ?? true,
  lastInvoicedOn: d(r.last_invoiced_on), nextInvoiceOn: d(r.next_invoice_on),
  status: (r.status ?? "Active") as ClientContract["status"],
  remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toContract = (c: Partial<ClientContract>): Row => ({
  company_id: c.companyId || null, client_id: c.clientId, project_id: c.projectId || null,
  contract_no: c.contractNo, title: c.title ?? "", start_date: nullDate(c.startDate),
  end_date: nullDate(c.endDate), billing_cycle: c.billingCycle ?? "Monthly",
  billing_day: c.billingDay ?? 1, billing_source: c.billingSource ?? "Timesheet",
  fixed_amount: c.fixedAmount ?? 0, gst_rate: c.gstRate ?? 9,
  payment_terms_days: c.paymentTermsDays ?? 30, auto_invoice: c.autoInvoice ?? true,
  last_invoiced_on: nullDate(c.lastInvoicedOn), next_invoice_on: nullDate(c.nextInvoiceOn),
  status: c.status ?? "Active", remarks: c.remarks ?? null,
});

/* ---------- branch prefixes / certifications / time cards / claim sheets ---------- */
export const fromBranchPrefix = (r: Row): BranchPrefix => ({
  id: r.id, code: r.code, name: r.name, companyId: r.company_id ?? undefined,
  active: r.active ?? true, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toBranchPrefix = (b: Partial<BranchPrefix>): Row => ({
  code: (b.code ?? "").toUpperCase(), name: b.name, company_id: b.companyId || null,
  active: b.active ?? true,
});

export const fromCertification = (r: Row): EmployeeCertification => ({
  id: r.id, employeeId: r.employee_id, courseName: r.course_name,
  issuingBody: r.issuing_body ?? undefined, issueDate: d(r.issue_date),
  expiryDate: d(r.expiry_date), fileUrl: r.file_url ?? undefined,
  remarks: r.remarks ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toCertification = (c: Partial<EmployeeCertification>): Row => ({
  employee_id: c.employeeId, course_name: c.courseName ?? "",
  issuing_body: c.issuingBody ?? null, issue_date: nullDate(c.issueDate),
  expiry_date: nullDate(c.expiryDate), file_url: c.fileUrl || null, remarks: c.remarks ?? null,
});

export const fromTimeCard = (r: Row): TimeCard => ({
  id: r.id, employeeId: r.employee_id, periodStart: d(r.period_start) ?? "",
  periodEnd: d(r.period_end) ?? "", fileUrl: r.file_url ?? undefined,
  fileName: r.file_name ?? undefined, status: (r.status ?? "Draft") as TimeCard["status"],
  entries: (Array.isArray(r.entries) ? r.entries : []) as TimeCardEntry[],
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toTimeCard = (t: Partial<TimeCard>): Row => ({
  employee_id: t.employeeId, period_start: nullDate(t.periodStart),
  period_end: nullDate(t.periodEnd), file_url: t.fileUrl || null,
  file_name: t.fileName ?? null, status: t.status ?? "Draft", entries: t.entries ?? [],
});

export const fromClaimSheet = (r: Row): ClaimSheet => ({
  id: r.id, reference: r.reference, employeeId: r.employee_id ?? undefined,
  companyId: r.company_id ?? undefined, periodStart: d(r.period_start) ?? "",
  periodEnd: d(r.period_end) ?? "", totalDays: Number(r.total_days ?? 0),
  totalNormalHours: Number(r.total_normal_hours ?? 0), totalOtHours: Number(r.total_ot_hours ?? 0),
  snapshot: (Array.isArray(r.snapshot) ? r.snapshot : []) as ClaimSheetRow[],
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toClaimSheet = (c: Partial<ClaimSheet>): Row => ({
  reference: c.reference, employee_id: c.employeeId || null, company_id: c.companyId || null,
  period_start: nullDate(c.periodStart), period_end: nullDate(c.periodEnd),
  total_days: c.totalDays ?? 0, total_normal_hours: c.totalNormalHours ?? 0,
  total_ot_hours: c.totalOtHours ?? 0, snapshot: c.snapshot ?? [],
});

async function all(table: string, order = "created_at") {
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false });
  if (error) { console.error(`[db] ${table}:`, error.message); return []; }
  return (data ?? []) as Row[];
}

export async function loadAll(): Promise<LoadedData> {
  const [
    companies, employees, clients, projects, sites, assignments,
    documents, attendance, payroll, approvals, auditLogs, profiles, roles, leaveRequests,
    rateAgreements, invoices, dormitories, allocations, vehicles, trips,
    assets, issuances, courses, trainings, incidents,
    requisitions, candidates, leads, activities, expenses, receipts,
    inventory, movements, purchaseOrders,
    branchPrefixes, certifications, timeCards, claimSheets, contracts,
    medicalClaims,
  ] = await Promise.all([
    all("companies"), all("employees"), all("clients"), all("projects"), all("sites"),
    all("assignments"), all("employee_documents"), all("attendance"), all("payroll_entries"),
    all("approvals"), all("audit_logs"), all("profiles"), all("user_roles"), all("leave_requests"),
    all("rate_agreements"), all("invoices"), all("dormitories"), all("bed_allocations"),
    all("vehicles"), all("trips"),
    all("assets"), all("asset_issuances"),
    all("training_courses"), all("training_records"), all("safety_incidents"),
    all("job_requisitions"), all("candidates"), all("leads"), all("crm_activities"),
    all("expenses"), all("payment_receipts"),
    all("inventory_items"), all("stock_movements"), all("purchase_orders"),
    all("branch_prefixes"), all("employee_certifications"), all("time_cards"), all("claim_sheets"),
    all("client_contracts"),
    all("medical_claims"),
  ]);

  const [loanRows, repaymentRows] = await Promise.all([
    all("employee_loans"),
    all("loan_repayments"),
  ]);

  const [departmentRows, designationRows] = await Promise.all([
    all("departments"),
    all("designations"),
  ]);

  const roleByUser = new Map<string, string>();
  for (const r of roles) if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);

  const users: User[] = profiles.map((p) => ({
    id: p.id,
    name: p.full_name ?? p.email ?? "User",
    email: p.email ?? "",
    role: (roleByUser.get(p.id) ?? "client") as User["role"],
    status: "active",
    createdAt: p.created_at,
  }));

  const siteById = new Map(sites.map((s) => [s.id, s.name]));
  const activeSiteByEmp = new Map<string, string>();
  for (const a of assignments) {
    if (a.status === "Active" && siteById.has(a.site_id)) activeSiteByEmp.set(a.employee_id, siteById.get(a.site_id)!);
  }

  return {
    companies: companies.map(fromCompany),
    employees: employees.map((r) => ({ ...fromEmployee(r), site: activeSiteByEmp.get(r.id) ?? null })),
    clients: clients.map(fromClient),
    projects: projects.map(fromProject),
    sites: sites.map(fromSite),
    assignments: assignments.map(fromAssignment),
    documents: documents.map(fromDocument),
    attendance: attendance.map(fromAttendance),
    payroll: payroll.map(fromPayroll),
    approvals: approvals.map(fromApproval),
    auditLogs: auditLogs.map(fromAuditLog),
    users,
    leaveRequests: leaveRequests.map(fromLeave),
    rateAgreements: rateAgreements.map(fromRate),
    invoices: invoices.map(fromInvoice),
    dormitories: dormitories.map(fromDormitory),
    allocations: allocations.map(fromAllocation),
    vehicles: vehicles.map(fromVehicle),
    trips: trips.map(fromTrip),
    assets: assets.map(fromAsset),
    issuances: issuances.map(fromIssuance),
    courses: courses.map(fromCourse),
    trainings: trainings.map(fromTraining),
    incidents: incidents.map(fromIncident),
    requisitions: requisitions.map(fromRequisition),
    candidates: candidates.map(fromCandidate),
    leads: leads.map(fromLead),
    activities: activities.map(fromActivity),
    expenses: expenses.map(fromExpense),
    receipts: receipts.map(fromPaymentReceipt),
    inventory: inventory.map(fromItem),
    movements: movements.map(fromMovement),
    purchaseOrders: purchaseOrders.map(fromPurchaseOrder),
    branchPrefixes: branchPrefixes.map(fromBranchPrefix),
    certifications: certifications.map(fromCertification),
    timeCards: timeCards.map(fromTimeCard),
    claimSheets: claimSheets.map(fromClaimSheet),
    contracts: contracts.map(fromContract),
    medicalClaims: medicalClaims.map(fromMedicalClaim),
    loans: loanRows.map(fromLoan),
    loanRepayments: repaymentRows.map(fromLoanRepayment),
  };
}

/* ---------- Phase 12: finance ---------- */
export const fromExpense = (r: Row): Expense => ({
  id: r.id, companyId: r.company_id ?? undefined, expenseDate: d(r.expense_date) ?? "",
  category: (r.category ?? "Other") as Expense["category"], description: r.description ?? "",
  vendor: r.vendor ?? undefined, projectId: r.project_id ?? undefined,
  employeeId: r.employee_id ?? undefined, amount: Number(r.amount ?? 0),
  gstAmount: Number(r.gst_amount ?? 0),
  paymentMode: (r.payment_mode ?? undefined) as Expense["paymentMode"],
  referenceNo: r.reference_no ?? undefined,
  status: (r.status ?? "Pending") as Expense["status"], paidOn: d(r.paid_on),
  documentUrl: r.document_url ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toExpense = (x: Partial<Expense>): Row => ({
  company_id: x.companyId || null, expense_date: nullDate(x.expenseDate),
  category: x.category, description: x.description ?? "", vendor: x.vendor ?? null,
  project_id: x.projectId || null, employee_id: x.employeeId || null,
  amount: x.amount ?? 0, gst_amount: x.gstAmount ?? 0,
  payment_mode: x.paymentMode ?? null, reference_no: x.referenceNo ?? null,
  status: x.status, paid_on: nullDate(x.paidOn), document_url: x.documentUrl ?? null,
  remarks: x.remarks ?? null,
});

export const fromPaymentReceipt = (r: Row): PaymentReceipt => ({
  id: r.id, companyId: r.company_id ?? undefined, invoiceId: r.invoice_id ?? undefined,
  clientId: r.client_id ?? undefined, receiptNo: r.receipt_no ?? "",
  receivedOn: d(r.received_on) ?? "", amount: Number(r.amount ?? 0),
  paymentMode: (r.payment_mode ?? "Bank Transfer") as PaymentReceipt["paymentMode"],
  referenceNo: r.reference_no ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toPaymentReceipt = (x: Partial<PaymentReceipt>): Row => ({
  company_id: x.companyId || null, invoice_id: x.invoiceId || null, client_id: x.clientId || null,
  receipt_no: x.receiptNo ?? "", received_on: nullDate(x.receivedOn), amount: x.amount ?? 0,
  payment_mode: x.paymentMode, reference_no: x.referenceNo ?? null, remarks: x.remarks ?? null,
});

/* ---------- Phase 13: inventory & procurement ---------- */
export const fromItem = (r: Row): InventoryItem => ({
  id: r.id, companyId: r.company_id ?? undefined, sku: r.sku ?? "", name: r.name ?? "",
  category: (r.category ?? "Other") as InventoryItem["category"], unit: r.unit ?? "pcs",
  openingQty: Number(r.opening_qty ?? 0), reorderLevel: Number(r.reorder_level ?? 0),
  unitCost: Number(r.unit_cost ?? 0), location: r.location ?? undefined,
  supplier: r.supplier ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toItem = (x: Partial<InventoryItem>): Row => ({
  company_id: x.companyId || null, sku: x.sku ?? "", name: x.name ?? "", category: x.category,
  unit: x.unit ?? "pcs", opening_qty: x.openingQty ?? 0, reorder_level: x.reorderLevel ?? 0,
  unit_cost: x.unitCost ?? 0, location: x.location ?? null, supplier: x.supplier ?? null,
  remarks: x.remarks ?? null,
});

export const fromMovement = (r: Row): StockMovement => ({
  id: r.id, itemId: r.item_id, movementType: (r.movement_type ?? "In") as StockMovement["movementType"],
  quantity: Number(r.quantity ?? 0), movementDate: d(r.movement_date) ?? "",
  siteId: r.site_id ?? undefined, employeeId: r.employee_id ?? undefined, poId: r.po_id ?? undefined,
  referenceNo: r.reference_no ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toMovement = (x: Partial<StockMovement>): Row => ({
  item_id: x.itemId, movement_type: x.movementType, quantity: x.quantity ?? 0,
  movement_date: nullDate(x.movementDate), site_id: x.siteId || null,
  employee_id: x.employeeId || null, po_id: x.poId || null,
  reference_no: x.referenceNo ?? null, remarks: x.remarks ?? null,
});

export const fromPurchaseOrder = (r: Row): PurchaseOrder => ({
  id: r.id, companyId: r.company_id ?? undefined, poNo: r.po_no ?? "", supplier: r.supplier ?? "",
  itemId: r.item_id ?? undefined, quantity: Number(r.quantity ?? 0), unitCost: Number(r.unit_cost ?? 0),
  orderDate: d(r.order_date) ?? "", expectedDate: d(r.expected_date), receivedDate: d(r.received_date),
  status: (r.status ?? "Draft") as PurchaseOrder["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toPurchaseOrder = (x: Partial<PurchaseOrder>): Row => ({
  company_id: x.companyId || null, po_no: x.poNo ?? "", supplier: x.supplier ?? "",
  item_id: x.itemId || null, quantity: x.quantity ?? 0, unit_cost: x.unitCost ?? 0,
  order_date: nullDate(x.orderDate), expected_date: nullDate(x.expectedDate),
  received_date: nullDate(x.receivedDate), status: x.status, remarks: x.remarks ?? null,
});

/* ---------- loan / salary advance ledger ---------- */
export const fromLoan = (r: Row): EmployeeLoan => ({
  id: r.id, companyId: r.company_id ?? undefined, employeeId: r.employee_id,
  loanNo: r.loan_no ?? "", loanType: (r.loan_type ?? "Salary Advance") as EmployeeLoan["loanType"],
  principal: Number(r.principal ?? 0), issuedOn: d(r.issued_on),
  firstDeductionMonth: r.first_deduction_month ?? undefined,
  monthlyInstallment: Number(r.monthly_installment ?? 0),
  purpose: r.purpose ?? undefined, consentSigned: !!r.consent_signed,
  consentDocumentUrl: r.consent_document_url ?? undefined,
  status: (r.status ?? "Active") as EmployeeLoan["status"],
  remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toLoan = (x: Partial<EmployeeLoan>): Row => ({
  company_id: x.companyId || null, employee_id: x.employeeId, loan_no: x.loanNo ?? "",
  loan_type: x.loanType, principal: x.principal ?? 0, issued_on: nullDate(x.issuedOn),
  first_deduction_month: x.firstDeductionMonth ?? null,
  monthly_installment: x.monthlyInstallment ?? 0, purpose: x.purpose ?? null,
  consent_signed: !!x.consentSigned, consent_document_url: x.consentDocumentUrl ?? null,
  status: x.status, remarks: x.remarks ?? null,
});

export const fromLoanRepayment = (r: Row): LoanRepayment => ({
  id: r.id, loanId: r.loan_id, employeeId: r.employee_id,
  paidOn: d(r.paid_on), month: r.month ?? undefined, amount: Number(r.amount ?? 0),
  source: (r.source ?? "Payroll") as LoanRepayment["source"],
  remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toLoanRepayment = (x: Partial<LoanRepayment>): Row => ({
  loan_id: x.loanId, employee_id: x.employeeId, paid_on: nullDate(x.paidOn),
  month: x.month ?? null, amount: x.amount ?? 0, source: x.source, remarks: x.remarks ?? null,
});
