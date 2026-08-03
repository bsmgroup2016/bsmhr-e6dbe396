
export type InvoiceStatus = "Draft" | "Sent" | "Partially Paid" | "Paid" | "Overdue" | "Cancelled";
export type RateUnit = "Hourly" | "Daily" | "Monthly";
export type BillingCycle = "Weekly" | "Fortnightly" | "Monthly";
export type BillingSource = "Timesheet" | "Fixed";
export type ContractStatus = "Draft" | "Active" | "Expired" | "Terminated";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  employeeId?: string; // Kept for traceability
  trade?: string;      // Kept for traceability
  quantity: number;
  unit: RateUnit;
  rate: number;
  otQuantity?: number;
  otRate?: number;
  amount: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  clientId: string;
  projectId?: string;
  companyId?: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  notes?: string;
  lines: InvoiceLine[];
  createdAt: string;
  updatedAt: string;
}

export interface RateAgreement {
  id: string;
  clientId: string;
  projectId?: string;
  trade: string; // Designation
  unit: RateUnit;
  normalRate: number;
  otRate: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "Active" | "Inactive";
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientContract {
  id: string;
  companyId?: string;
  clientId: string;
  projectId?: string;
  contractNo: string;
  title: string;
  startDate?: string;
  endDate?: string;
  billingCycle: BillingCycle;
  billingDay: number;
  billingSource: BillingSource;
  fixedAmount: number;
  gstRate: number;
  paymentTermsDays: number;
  autoInvoice: boolean;
  lastInvoicedOn?: string;
  nextInvoiceOn?: string;
  status: ContractStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}


/* ---------------- Quotation management ---------------- */
export type QuotationStatus =
  | "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired" | "Converted";

export interface QuotationLine {
  id: string;
  designation: string;
  description?: string;
  headcount: number;
  unit: RateUnit;
  normalRate: number;
  otRate: number;
  /** Billable units per headcount for the quoted period (e.g. hours/month). */
  unitsPerPeriod: number;
  amount: number;
}

export interface Quotation {
  id: string;
  companyId?: string;
  /** Existing client — empty for a brand-new prospect. */
  clientId?: string;
  /** Prospect (not yet a client) details captured on the quotation itself. */
  prospectCompany?: string;
  prospectContact?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  prospectAddress?: string;
  projectId?: string;
  quoteNo: string;
  title: string;
  contactPerson?: string;
  quoteDate: string;
  validUntil?: string;
  lines: QuotationLine[];
  subtotal: number;
  discount: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  status: QuotationStatus;
  paymentTermsDays: number;
  preparedBy?: string;
  sentOn?: string;
  decidedOn?: string;
  convertedContractId?: string;
  terms?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
