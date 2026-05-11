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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { clientId, clientName } = await req.json();

    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[notifyAdminFormSubmitted] RESEND_API_KEY missing');
      return Response.json({ error: 'Email service not configured' }, { status: 500 });
    }
    const resend = new Resend(apiKey);

    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === "admin" || u.role === "owner");

    let notified = 0;
    for (const admin of admins) {
      try {
        const bodyHtml = `
          <p style="margin:0 0 16px 0;">Hi ${admin.full_name},</p>
          <p style="margin:0 0 16px 0;"><strong>${clientName}</strong> has submitted their onboarding form. Please review it at your earliest convenience.</p>
          <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
            <a href="https://app.base44.com/onboarding-submissions" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Review Submissions →</a>
          </td></tr></table>`;

        const result = await resend.emails.send({
          from: 'Marketing iO Team <hello@marketingio.co.za>',
          to: admin.email,
          subject: `New Onboarding Form Submission — ${clientName}`,
          html: wrapEmail(bodyHtml)
        });
        if (!result.error) notified++;

        // Also write an in-app ClientNotification for this admin
        try {
          // Look up AppUser for this admin by email to get their ID
          const appUsers = await base44.asServiceRole.entities.AppUser.filter({ email: admin.email });
          const appUser = Array.isArray(appUsers) ? appUsers[0] : appUsers;
          if (appUser?.id) {
            await base44.asServiceRole.entities.ClientNotification.create({
              recipient_user_id: appUser.id,
              client_id: clientId,
              notification_type: "onboarding_submission",
              title: `New onboarding form: ${clientName}`,
              body: `${clientName} has submitted their onboarding form and is awaiting review.`,
              related_entity_type: "ClientOnboardingSubmission",
              action_url: "/onboarding-submissions",
              is_read: false,
            });
          }
        } catch (notifErr) {
          console.error(`[notifyAdminFormSubmitted] In-app notify failed for ${admin.email}:`, notifErr);
        }
      } catch (err) {
        console.error(`Failed to notify ${admin.email}:`, err);
      }
    }

    return Response.json({ success: true, message: `Notification sent to ${notified} admin(s)` });
  } catch (error) {
    console.error("Error notifying admin:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});