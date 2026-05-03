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
    if (!deliverable) {
      return Response.json({ error: 'Deliverable not found' }, { status: 404 });
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
      title: 'Deliverable Approved',
      body: `${deliverable.title} has been approved and signed off by your team.`,
      related_entity_type: 'Deliverable',
      related_entity_id: deliverable_id,
      action_url: '/client/deliverables',
    });

    // Send email if client preferences allow
    const prefs = client.notification_preferences ? JSON.parse(client.notification_preferences) : {};
    if (prefs.email_deliverable_approved !== false) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: client.email,
          from_name: 'Marketing iO',
          subject: `✓ Deliverable Approved: ${deliverable.title}`,
          body: `
            <h2 style="color: #10b981;">Deliverable Approved</h2>
            <p>Hi ${client.contact_person},</p>
            <p><strong>${deliverable.title}</strong> has been successfully reviewed and approved by your team.</p>
            <p>This deliverable is now complete and marked as signed off.</p>
            <p><a href="https://app.marketingio.co.za/client/deliverables" style="background: #10b981; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">View Details</a></p>
            <p>Best regards,<br>Marketing iO Team</p>
          `,
        });
      } catch (emailErr) {
        console.warn('Email send failed:', emailErr.message);
      }
    }

    return Response.json({ success: true, notification_created: true });
  } catch (error) {
    console.error('[notifyDeliverableApproved]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});