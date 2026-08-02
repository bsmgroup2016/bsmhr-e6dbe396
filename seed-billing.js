import { supabase } from "./src/integrations/supabase/client.js";

async function seed() {
  console.log("Checking for existing invoices...");
  const { data: invoices, error: invError } = await supabase.from('invoices').select('id').limit(1);
  if (invError) {
    console.error("Error checking invoices:", invError.message);
    return;
  }

  if (invoices && invoices.length > 0) {
    console.log("Invoices already exist. Skipping seed.");
    return;
  }

  console.log("No invoices found. Starting seed...");

  // Get first company, client, project
  const { data: companies } = await supabase.from('companies').select('id').limit(1);
  const { data: clients } = await supabase.from('clients').select('id, company_id').limit(1);
  const { data: projects } = await supabase.from('projects').select('id, client_id').limit(1);

  if (!companies?.length || !clients?.length || !projects?.length) {
    console.error("Missing prerequisite data (companies/clients/projects) to seed billing.");
    return;
  }

  const compId = companies[0].id;
  const clientId = clients[0].id;
  const projectId = projects[0].id;

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const demoInvoices = [
    {
      company_id: compId,
      client_id: clientId,
      project_id: projectId,
      invoice_no: `INV-${now.getFullYear()}-0001`,
      period_start: lastMonth.toISOString().slice(0, 10),
      period_end: lastMonthEnd.toISOString().slice(0, 10),
      issue_date: now.toISOString().slice(0, 10),
      due_date: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10),
      lines: [
        { id: '1', description: 'General Worker Services', quantity: 20, unit: 'Daily', rate: 100, amount: 2000 }
      ],
      subtotal: 2000,
      gst_rate: 9,
      gst_amount: 180,
      total: 2180,
      amount_paid: 2180,
      status: 'Paid',
      notes: 'Demo paid invoice'
    },
    {
      company_id: compId,
      client_id: clientId,
      project_id: projectId,
      invoice_no: `INV-${now.getFullYear()}-0002`,
      period_start: lastMonth.toISOString().slice(0, 10),
      period_end: lastMonthEnd.toISOString().slice(0, 10),
      issue_date: now.toISOString().slice(0, 10),
      due_date: new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10),
      lines: [
        { id: '2', description: 'Welder Services', quantity: 15, unit: 'Daily', rate: 150, amount: 2250 }
      ],
      subtotal: 2250,
      gst_rate: 9,
      gst_amount: 202.5,
      total: 2452.5,
      amount_paid: 0,
      status: 'Overdue',
      notes: 'Demo overdue invoice'
    }
  ];

  const { error: seedError } = await supabase.from('invoices').insert(demoInvoices);
  if (seedError) {
    console.error("Seed failed:", seedError.message);
  } else {
    console.log("Successfully seeded demo billing data.");
  }
}

seed();
