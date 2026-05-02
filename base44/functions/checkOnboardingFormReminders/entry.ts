import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Scheduled daily check for onboarding forms due in 3 days
 * Sends reminder emails and portal notifications
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all in-progress onboarding submissions created 4+ days ago
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const submissions = await base44.asServiceRole.entities.ClientOnboardingSubmission.filter({
      submission_status: 'not_started',
      created_date: { $lte: fourDaysAgo.toISOString() },
      reminder_sent_3days: false,
    });

    let reminded = 0;

    for (const sub of submissions) {
      // Get client details
      const client = await base44.asServiceRole.entities.Client.get('Client', sub.client_id);
      if (!client) continue;

      // Send email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: client.email,
        subject: `${client.business_name} — Complete Your Onboarding Form`,
        body: `Hi ${client.contact_person},\n\nYour onboarding form is due in 3 days. Please complete it at your earliest convenience:\n\nhttps://your-app.com/client/onboarding-form\n\nThis helps us get your campaign moving!\n\nBest,\nMarketing iO`,
      });

      // Create portal notification
      await base44.asServiceRole.entities.ClientNotification.create({
        client_id: sub.client_id,
        notification_type: 'onboarding_step_complete',
        title: 'Onboarding Form Reminder',
        body: 'Please complete your onboarding form within the next 3 days to keep your timeline on track.',
        action_url: '/client/onboarding-form',
        related_entity_type: 'ClientOnboardingSubmission',
        related_entity_id: sub.id,
      });

      // Mark reminder sent
      await base44.asServiceRole.entities.ClientOnboardingSubmission.update(sub.id, {
        reminder_sent_3days: true,
      });

      reminded++;
    }

    return Response.json({ success: true, reminders_sent: reminded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});