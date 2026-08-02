import { addInvoice, getClients, getProjects, getCurrentCompany } from "./store";

export function seedDemoBilling() {
  const clients = getClients();
  const projects = getProjects();
  const companyId = getCurrentCompany();

  if (clients.length === 0 || projects.length === 0) {
    console.warn("Cannot seed billing: No clients or projects found in store.");
    return;
  }

  const clientId = clients[0].id;
  const projectId = projects[0].id;
  const now = new Date();
  const year = now.getFullYear();
  
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  // Paid Invoice
  addInvoice({
    companyId,
    clientId,
    projectId,
    invoiceNo: `INV-${year}-0001`,
    periodStart: lastMonth,
    periodEnd: lastMonthEnd,
    issueDate: now.toISOString().slice(0, 10),
    dueDate: now.toISOString().slice(0, 10),
    lines: [
      { id: 'l1', description: 'Manpower Supply (Demo)', quantity: 22, unit: 'Daily', rate: 100, amount: 2200, createdAt: now.toISOString() }
    ],
    gstRate: 9,
    amountPaid: 2398, // Fully paid
    status: 'Paid',
    notes: 'Demo fully paid invoice'
  });

  // Overdue Invoice
  const overdueDate = new Date(now.getTime() - 10 * 86400000).toISOString().slice(0, 10);
  addInvoice({
    companyId,
    clientId,
    projectId,
    invoiceNo: `INV-${year}-0002`,
    periodStart: lastMonth,
    periodEnd: lastMonthEnd,
    issueDate: overdueDate,
    dueDate: overdueDate,
    lines: [
      { id: 'l2', description: 'OT Charges (Demo)', quantity: 45, unit: 'Hourly', rate: 20, amount: 900, createdAt: now.toISOString() }
    ],
    gstRate: 9,
    amountPaid: 0,
    status: 'Overdue',
    notes: 'Demo overdue invoice'
  });

  // Sent Invoice
  addInvoice({
    companyId,
    clientId,
    projectId,
    invoiceNo: `INV-${year}-0003`,
    periodStart: now.toISOString().slice(0, 10),
    periodEnd: new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10),
    issueDate: now.toISOString().slice(0, 10),
    dueDate: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10),
    lines: [
      { id: 'l3', description: 'Progress Claim 1', quantity: 1, unit: 'Monthly', rate: 5000, amount: 5000, createdAt: now.toISOString() }
    ],
    gstRate: 9,
    amountPaid: 0,
    status: 'Sent',
    notes: 'Demo sent invoice'
  });
}
