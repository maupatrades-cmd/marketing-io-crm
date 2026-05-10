import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td align="center" valign="middle" background="https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg" bgcolor="#0f172a" style="background-color:#0f172a;background-image:url('https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg');background-position:center center;background-size:cover;background-repeat:no-repeat;padding:60px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="280" style="width:280px;max-width:80%;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 0 24px rgba(167,100,230,0.85)) drop-shadow(0 0 48px rgba(236,72,153,0.55));" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">${bodyHtml}</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="140" style="width:140px;height:auto;display:block;margin:0 auto 12px auto;" />
  <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Marketing iO (Pty) Ltd &middot; CIPC 2026303502</div>
  <div style="font-size:12px;color:#94a3b8;line-height:1.8;">75 Marshall Street, Polokwane 0699<br>☎ 010 102 0534 &bull; <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
  <div style="height:1px;background:linear-gradient(90deg,transparent,#a764e6,#ec4899,transparent);margin:16px 0;"></div>
  <div style="font-size:12px;font-style:italic;color:#a764e6;">Too good to stay hidden.</div>
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