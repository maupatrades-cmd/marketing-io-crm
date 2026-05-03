import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all active deliverables with due dates
    const allDeliverables = await base44.asServiceRole.entities.Deliverable.filter({});
    const deliverables = (allDeliverables || []).filter(d =>
      ['in_progress', 'awaiting_client', 'client_reviewing'].includes(d.status)
    );

    if (!deliverables || deliverables.length === 0) {
      return Response.json({ success: true, checked: 0, notified: 0 });
    }

    const now = new Date();
    let notified = 0;

    for (const deliv of deliverables) {
      if (!deliv.due_date) continue;

      const dueDate = new Date(deliv.due_date);
      if (dueDate > now) continue; // Not overdue yet

      // Check if already notified today
      const client = await base44.asServiceRole.entities.Client.read(deliv.client_id);
      const existingNotifs = await base44.asServiceRole.entities.ClientNotification.filter({
        client_id: deliv.client_id,
        related_entity_id: deliv.id,
        notification_type: 'deliverable_ready', // Reusing this type
      });

      const hasRecentNotif = existingNotifs.some(n => {
        const notifDate = new Date(n.created_date);
        const daysDiff = (now - notifDate) / (1000 * 60 * 60 * 24);
        return daysDiff < 1; // Already notified today
      });

      if (hasRecentNotif) continue;

      // Create notification
      try {
        await base44.asServiceRole.entities.ClientNotification.create({
          client_id: deliv.client_id,
          notification_type: 'deliverable_ready',
          title: 'Deliverable Overdue',
          body: `${deliv.title} is overdue for review (due ${dueDate.toLocaleDateString('en-ZA')}).`,
          related_entity_type: 'Deliverable',
          related_entity_id: deliv.id,
          action_url: '/client/deliverables',
        });

        // Send email
        const prefs = client.notification_preferences ? JSON.parse(client.notification_preferences) : {};
        if (prefs.email_deliverable_overdue !== false && client.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: client.email,
            from_name: 'Marketing iO',
            subject: `⚠️ Deliverable Overdue: ${deliv.title}`,
            body: `
              <h2 style="color: #ef4444;">Deliverable Overdue</h2>
              <p>Hi ${client.contact_person},</p>
              <p><strong>${deliv.title}</strong> was due on <strong>${dueDate.toLocaleDateString('en-ZA')}</strong> and is still awaiting your review.</p>
              <p>Please review and approve at your earliest convenience.</p>
              <p><a href="https://app.marketingio.co.za/client/deliverables" style="background: #ef4444; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Review Now</a></p>
              <p>Best regards,<br>Marketing iO Team</p>
            `,
          });
        }

        notified++;
      } catch (err) {
        console.error(`Failed to notify for deliverable ${deliv.id}:`, err);
      }
    }

    return Response.json({ success: true, checked: deliverables.length, notified });
  } catch (error) {
    console.error('[checkOverdueDeliverables]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});