import { supabase } from './src/integrations/supabase/client.ts';

async function seed() {
  console.log('Starting seed...');

  // 1. Get Companies
  const { data: companies, error: cErr } = await supabase.from('companies').select('id, name');
  if (cErr) throw cErr;
  if (!companies || companies.length === 0) {
    console.log('No companies found. Seed companies first.');
    return;
  }

  // 2. Get Clients
  const { data: clients, error: clErr } = await supabase.from('clients').select('id, name, company_id');
  if (clErr) throw clErr;
  if (!clients || clients.length === 0) {
    console.log('No clients found. Seed clients first.');
    return;
  }

  // 3. Get Projects
  const { data: projects, error: pErr } = await supabase.from('projects').select('id, name, client_id');
  if (pErr) throw pErr;
  
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const demoInvoices = [];
  
  // Seed for each company-client-project triplet we find
  for (const client of clients) {
    const companyProjects = projects?.filter(p => p.client_id === client.id) || [];
    const companyId = client.company_id || companies[0].id;

    for (const [idx, project] of companyProjects.entries()) {
      // Create a few invoices with different statuses
      const statuses = ['Paid', 'Partially Paid', 'Sent', 'Overdue', 'Draft'];
      const status = statuses[idx % statuses.length];
      
      const subtotal = 5000 + (Math.random() * 10000);
      const gstRate = 9;
      const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
      const total = subtotal + gstAmount;
      const amountPaid = status === 'Paid' ? total : (status === 'Partially Paid' ? Math.round(total / 2) : 0);

      demoInvoices.push({
        company_id: companyId,
        client_id: client.id,
        project_id: project.id,
        invoice_no: `INV-${today.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
        period_start: lastMonth.toISOString().slice(0, 10),
        period_end: lastMonthEnd.toISOString().slice(0, 10),
        issue_date: today.toISOString().slice(0, 10),
        due_date: new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10),
        subtotal: Math.round(subtotal * 100) / 100,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total: Math.round(total * 100) / 100,
        amount_paid: amountPaid,
        status: status,
        lines: [
          {
            description: 'Professional Manpower Services - General Workers',
            trade: 'General Worker',
            quantity: 20,
            unit: 'Daily',
            rate: 120,
            amount: 2400,
            createdAt: new Date().toISOString()
          },
          {
            description: 'Professional Manpower Services - Skilled Technicians',
            trade: 'Technician',
            quantity: 15,
            unit: 'Daily',
            rate: 180,
            amount: 2700,
            createdAt: new Date().toISOString()
          }
        ]
      });
    }
  }

  if (demoInvoices.length > 0) {
    console.log(`Inserting ${demoInvoices.length} demo invoices...`);
    const { error: insErr } = await supabase.from('invoices').insert(demoInvoices);
    if (insErr) {
      console.error('Insert error:', insErr);
    } else {
      console.log('Success! Demo invoices added.');
    }
  } else {
    console.log('No projects found to create invoices for.');
  }
}

seed().catch(console.error);
