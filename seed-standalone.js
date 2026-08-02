import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://thrfyeyqafmdnpexgmlc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocmZ5ZXlxYWZtZG5wZXhnbWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTMzNTcsImV4cCI6MjEwMDgyOTM1N30.4EGhaZVMSZYI2NPo6mdzBLgKbZJjlVqJ-cdm7VqDvrQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function seed() {
  console.log("Checking for existing data...");
  const { data: invoices } = await supabase.from('invoices').select('id').limit(1);
  if (invoices && invoices.length > 0) {
    console.log("Invoices already exist.");
    return;
  }

  const { data: companies } = await supabase.from('companies').select('id').limit(1);
  const { data: clients } = await supabase.from('clients').select('id').limit(1);
  const { data: projects } = await supabase.from('projects').select('id').limit(1);

  if (!companies?.length || !clients?.length || !projects?.length) {
    console.log("Prerequisite data missing.");
    return;
  }

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const issueDate = now.toISOString().slice(0, 10);
  const dueDate = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const overdueDate = new Date(now.getTime() - 10 * 86400000).toISOString().slice(0, 10);

  const demoInvoices = [
    {
      company_id: companies[0].id,
      client_id: clients[0].id,
      project_id: projects[0].id,
      invoice_no: `INV-${now.getFullYear()}-0001`,
      period_start: lastMonth,
      period_end: lastMonthEnd,
      issue_date: issueDate,
      due_date: dueDate,
      lines: [{ id: '1', description: 'Monthly Manpower', quantity: 1, unit: 'Monthly', rate: 5000, amount: 5000 }],
      subtotal: 5000,
      gst_rate: 9,
      gst_amount: 450,
      total: 5450,
      amount_paid: 5450,
      status: 'Paid'
    },
    {
      company_id: companies[0].id,
      client_id: clients[0].id,
      project_id: projects[0].id,
      invoice_no: `INV-${now.getFullYear()}-0002`,
      period_start: lastMonth,
      period_end: lastMonthEnd,
      issue_date: issueDate,
      due_date: overdueDate,
      lines: [{ id: '2', description: 'Equipment Rental', quantity: 1, unit: 'Monthly', rate: 3000, amount: 3000 }],
      subtotal: 3000,
      gst_rate: 9,
      gst_amount: 270,
      total: 3270,
      amount_paid: 0,
      status: 'Overdue'
    }
  ];

  const { error } = await supabase.from('invoices').insert(demoInvoices);
  if (error) console.error("Error:", error.message);
  else console.log("Seeded successfully.");
}

seed();
