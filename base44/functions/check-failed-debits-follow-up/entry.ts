import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'owner') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Find all invoices marked as failed in the last 48 hours
    const invoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const failedInvoices = invoices
      .filter(inv => 
        inv.status === 'failed' &&
        inv.last_failed_date &&
        new Date(inv.last_failed_date) >= fortyEightHoursAgo
      );

    let taskCount = 0;

    for (const invoice of failedInvoices) {
      // Check if task already exists for this invoice
      const existingTasks = await base44.asServiceRole.entities.Task.filter({
        client_id: invoice.client_id,
        status: 'open',
        priority: 'urgent',
        auto_generated: true,
      });

      const taskExists = existingTasks.some(t => 
        t.description?.includes(invoice.invoice_number)
      );

      if (!taskExists) {
        const clients = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
        const client = clients?.[0];

        if (client) {
          await base44.asServiceRole.entities.Task.create({
            title: `🔴 URGENT: Failed Debit Follow-up - ${client.business_name}`,
            description: `Invoice ${invoice.invoice_number} (R${invoice.amount?.toLocaleString('en-ZA')}) still unpaid after 48 hours. Failed attempts: ${client.failed_debits_count || 1}. Action required.`,
            client_id: client.id,
            client_name: client.business_name,
            status: 'open',
            priority: 'urgent',
            due_date: new Date().toISOString().split('T')[0],
            auto_generated: true,
          });

          taskCount++;
        }
      }
    }

    return Response.json({
      success: true,
      checked_invoices: failedInvoices.length,
      tasks_created: taskCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});