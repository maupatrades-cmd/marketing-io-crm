import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find submissions not_started or in_progress older than 3 days
    const submissions = await base44.asServiceRole.entities.ClientOnboardingSubmission.list("-created_date", 500);
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    let remindersSent = 0;
    let tasksCreated = 0;

    for (const sub of submissions) {
      if (sub.submission_status !== "not_started" && sub.submission_status !== "in_progress") {
        continue;
      }

      const createdDate = new Date(sub.created_date);

      // Fetch client to get email and admin assignment
      const clients = await base44.entities.Client.filter({ id: sub.client_id });
      const client = Array.isArray(clients) ? clients[0] : clients;

      if (!client) continue;

      // Send reminder at 3 days
      if (createdDate <= threeDaysAgo && createdDate > fiveDaysAgo && !sub.reminder_sent_3days) {
        try {
          const contactName = client.contact_person?.split(" ")[0] || "there";
          const formUrl = `https://app.base44.com/client-onboarding/${sub.submission_token}`;

          await base44.integrations.Core.SendEmail({
            to: client.email,
            subject: `Reminder: Complete Your Marketing iO Onboarding Form`,
            body: `Hi ${contactName},

Just a friendly reminder! We're waiting for your onboarding form to get your project started.

📋 Complete it here: ${formUrl}

This only takes 15-20 minutes, and we need it by end of business in 2 days to stay on track.

Thanks!
Marketing iO Team`,
            from_name: "Marketing iO"
          });

          // Mark reminder as sent
          await base44.asServiceRole.entities.ClientOnboardingSubmission.update(sub.id, {
            reminder_sent_3days: true
          });

          remindersSent++;
        } catch (err) {
          console.error(`Failed to send 3-day reminder for ${client.business_name}:`, err);
        }
      }

      // Create task for admin at 5 days
      if (createdDate <= fiveDaysAgo && sub.submission_status === "not_started") {
        try {
          // Fetch onboarding to get assigned admin
          const onboardings = await base44.entities.ClientOnboarding.filter({ client_id: sub.client_id });
          const onboarding = Array.isArray(onboardings) ? onboardings[0] : onboardings;

          if (onboarding && onboarding.assigned_admin_id) {
            await base44.entities.Task.create({
              title: `Follow up: Onboarding form not submitted — ${client.business_name}`,
              client_id: sub.client_id,
              client_name: client.business_name,
              assigned_to: onboarding.assigned_admin_id,
              assigned_to_name: onboarding.assigned_admin_name,
              priority: "urgent",
              status: "open",
              description: `Client has not submitted their onboarding form within 5 days. Please follow up.`,
              auto_generated: true
            });

            tasksCreated++;
          }
        } catch (err) {
          console.error(`Failed to create task for ${client.business_name}:`, err);
        }
      }
    }

    return Response.json({
      success: true,
      remindersSent,
      tasksCreated
    });

  } catch (error) {
    console.error("Error sending reminders:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});