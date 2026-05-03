import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { deliverable_id } = await req.json();

    if (!deliverable_id) {
      return Response.json({ error: 'deliverable_id required' }, { status: 400 });
    }

    // Fetch deliverable
    const deliverables = await base44.asServiceRole.entities.Deliverable.filter({ id: deliverable_id });
    const deliverable = Array.isArray(deliverables) ? deliverables[0] : deliverables;
    if (!deliverable || !deliverable.due_date) {
      return Response.json({ error: 'Deliverable not found or has no due date' }, { status: 404 });
    }

    // Check if actually overdue
    const dueDate = new Date(deliverable.due_date);
    if (dueDate > new Date()) {
      return Response.json({ success: true, message: 'Not yet overdue' });
    }

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: deliverable.client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Create in-app notification
    await base44.asServiceRole.entities.ClientNotification.create({
      client_id: deliverable.client_id,
      notification_type: 'deliverable_ready',
      title: 'Deliverable Overdue',
      body: `${deliverable.title} is overdue for review (due ${dueDate.toLocaleDateString('en-ZA')}).`,
      related_entity_type: 'Deliverable',
      related_entity_id: deliverable_id,
      action_url: '/client/deliverables',
    });

    // Send email if client preferences allow
    const prefs = client.notification_preferences ? JSON.parse(client.notification_preferences) : {};
    if (prefs.email_deliverable_overdue !== false) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: client.email,
          from_name: 'Marketing iO',
          subject: `⚠️ Deliverable Overdue: ${deliverable.title}`,
          body: `
            <h2 style="color: #ef4444;">Deliverable Overdue</h2>
            <p>Hi ${client.contact_person},</p>
            <p><strong>${deliverable.title}</strong> was due on <strong>${dueDate.toLocaleDateString('en-ZA')}</strong> and is still awaiting your review.</p>
            <p>Please review and approve at your earliest convenience.</p>
            <p><a href="https://app.marketingio.co.za/client/deliverables" style="background: #ef4444; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Review Now</a></p>
            <p>Best regards,<br>Marketing iO Team</p>
          `,
        });
      } catch (emailErr) {
        console.warn('Email send failed:', emailErr.message);
      }
    }

    return Response.json({ success: true, notification_created: true });
  } catch (error) {
    console.error('[notifyDeliverableOverdue]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});