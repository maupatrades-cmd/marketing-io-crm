import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto;" />
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