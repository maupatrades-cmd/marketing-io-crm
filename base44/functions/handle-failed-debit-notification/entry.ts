import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id required' }, { status: 400 });
    }

    // Fetch invoice and client
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id });
    if (!invoices || invoices.length === 0) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoices[0];
    const clients = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
    const client = clients?.[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Increment failed debit count
    const newFailCount = (client.failed_debits_count || 0) + 1;
    const shouldTriggerAcceleration = newFailCount >= 3;

    // Update client with failed debit tracking
    await base44.asServiceRole.entities.Client.update(client.id, {
      failed_debits_count: newFailCount,
      acceleration_triggered: shouldTriggerAcceleration,
    });

    // Create a secure payment link (using existing payfast-invoice-init)
    const paymentRes = await base44.asServiceRole.functions.invoke('payfast-invoice-init', {
      invoice_id,
      client_id: client.id,
    });
    const paymentLink = paymentRes?.data?.payment_url || '#';

    // Send notification to client via email
    const emailSubject = shouldTriggerAcceleration 
      ? `⚠️ Urgent: Payment Required - Debit Failed (3 Attempts)`
      : `Payment Failed - Action Required`;

    const emailBody = `
      <h2 style="color:#ec4899;">${emailSubject}</h2>
      <p>Hi ${client.contact_person},</p>
      <p>Your recurring payment of <strong>R${invoice.amount?.toLocaleString('en-ZA')}</strong> failed on ${new Date().toLocaleDateString('en-ZA')}.</p>
      
      <p><strong>Payment Details:</strong></p>
      <ul>
        <li>Invoice: ${invoice.invoice_number}</li>
        <li>Amount: R${invoice.amount?.toLocaleString('en-ZA')}</li>
        <li>Amount Due: R${(invoice.amount * (newFailCount >= 3 ? 1 : 1))?.toLocaleString('en-ZA')}</li>
        <li>Failed Attempts: ${newFailCount}/3</li>
      </ul>

      ${shouldTriggerAcceleration ? `
        <div style="background:#fee2e2;border:2px solid #dc2626;padding:12px;border-radius:6px;margin:20px 0;">
          <p style="color:#991b1b;font-weight:bold;">⚠️ ACCELERATION CLAUSE TRIGGERED</p>
          <p>Due to 3 failed debit attempts, the full outstanding balance is now immediately due.</p>
        </div>
      ` : ''}

      <p><strong>Secure Payment Link:</strong></p>
      <p><a href="${paymentLink}" style="display:inline-block;padding:10px 20px;background:#a764e6;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Pay Now</a></p>

      <p>If you have any questions or need assistance, contact our finance team.</p>
      <p>Best regards,<br/>Marketing iO Finance Team</p>
    `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: client.email,
      subject: emailSubject,
      body: emailBody,
    });

    // Create follow-up task for finance team (48-hour reminder)
    const followUpDate = new Date();
    followUpDate.setHours(followUpDate.getHours() + 48);

    await base44.asServiceRole.entities.Task.create({
      title: `⚠️ Follow-up: Failed Debit - ${client.business_name}`,
      description: `Client failed debit payment. Invoice: ${invoice.invoice_number} (R${invoice.amount?.toLocaleString('en-ZA')}). Failed attempts: ${newFailCount}${shouldTriggerAcceleration ? ' - ACCELERATION TRIGGERED' : ''}. Check payment status and escalate if needed.`,
      client_id: client.id,
      client_name: client.business_name,
      status: 'open',
      priority: shouldTriggerAcceleration ? 'urgent' : 'high',
      due_date: followUpDate.toISOString().split('T')[0],
      auto_generated: true,
    });

    // Log activity
    await base44.asServiceRole.functions.invoke('log-client-activity', {
      client_id: client.id,
      event_type: 'payment_failed',
      event_label: 'Payment Failed',
      event_summary: `Debit payment failed (attempt ${newFailCount}/3)${shouldTriggerAcceleration ? ' - Acceleration triggered' : ''}`,
      event_category: 'payment',
      actor_role: 'system',
    });

    return Response.json({
      success: true,
      invoice_id,
      client_id: client.id,
      failed_count: newFailCount,
      acceleration_triggered: shouldTriggerAcceleration,
      notification_sent: true,
      follow_up_task_created: true,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});