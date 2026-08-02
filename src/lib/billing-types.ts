
export type InvoiceStatus = "Draft" | "Sent" | "Partially Paid" | "Paid" | "Overdue" | "Cancelled";
export type RateUnit = "Hourly" | "Daily" | "Monthly";
export type BillingCycle = "Weekly" | "Fortnightly" | "Monthly";
export type BillingSource = "Timesheet" | "Fixed";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
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
  startDate: string;
  endDate?: string;
  billingCycle: BillingCycle;
  billingDay: number;
  billingSource: BillingSource;
  fixedAmount: number;
  gstRate: number;
  paymentTermsDays: number;
  autoInvoice: boolean;
  nextInvoiceOn?: string;
  status: "Active" | "Expired" | "Terminated";
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}
