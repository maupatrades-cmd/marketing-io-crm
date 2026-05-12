import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendEmail(to, subject, bodyHtml) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) { console.error('[sendOnboardingReminders] RESEND_API_KEY missing'); return; }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to, subject, html: wrapEmail(bodyHtml)
  });
  if (result.error) console.error('[sendOnboardingReminders] Email failed:', result.error);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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

      const clients = await base44.asServiceRole.entities.Client.filter({ id: sub.client_id });
      const client = Array.isArray(clients) ? clients[0] : clients;
      if (!client) continue;

      // Send reminder at 3 days
      if (createdDate <= threeDaysAgo && createdDate > fiveDaysAgo && !sub.reminder_sent_3days) {
        try {
          const contactName = client.contact_person?.split(" ")[0] || "there";
          const formUrl = `https://app.base44.com/client-onboarding/${sub.submission_token}`;

          const bodyHtml = `
            <p style="margin:0 0 16px 0;">Hi ${contactName},</p>
            <p style="margin:0 0 16px 0;">Just a friendly reminder! We're waiting for your onboarding form to get your project started.</p>
            <p style="margin:0 0 16px 0;">This only takes 15–20 minutes, and we need it within the next 2 days to stay on track.</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
              <a href="${formUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Complete Onboarding Form →</a>
            </td></tr></table>
            <p style="margin:0;color:#94a3b8;font-size:14px;">Or copy this link: <a href="${formUrl}" style="color:#a764e6;">${formUrl}</a></p>`;

          await sendEmail(client.email, `Reminder: Complete Your Marketing iO Onboarding Form`, bodyHtml);

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
          const onboardings = await base44.asServiceRole.entities.ClientOnboarding.filter({ client_id: sub.client_id });
          const onboarding = Array.isArray(onboardings) ? onboardings[0] : onboardings;

          if (onboarding && onboarding.assigned_admin_id) {
            await base44.asServiceRole.entities.Task.create({
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

    return Response.json({ success: true, remindersSent, tasksCreated });
  } catch (error) {
    console.error("Error sending reminders:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});