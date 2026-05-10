import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEAD_EMAIL = 'head@marketingio.co.za';
const FROM = 'Marketing iO Team <hello@marketingio.co.za>';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const APP_URL = 'https://app.marketingio.co.za';

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396498/marketing_io_email_header_zmlvtg.jpg" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396673/marketing_io_email_footer_b9dkwm.jpg" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  // Service-role context not strictly needed (this is a notification-only
  // endpoint), but instantiate so we can attribute future log writes.
  const _base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { lead_id, business_name, contact_person, email, phone, signup_at } = body || {};
  if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[send-owner-lead-notification] RESEND_API_KEY missing');
    return Response.json({ success: false, reason: 'resend_not_configured' });
  }
  const resend = new Resend(apiKey);

  const allocateUrl = `${APP_URL}/owner/leads/${lead_id}`;
  const subject = `[NEW LEAD] ${business_name || 'New lead'} — needs consultant allocation`;
  const signupHuman = signup_at
    ? new Date(signup_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
    : 'just now';

  const html = wrapEmail(`
    <h1 style="margin:0 0 8px 0;font-size:22px;color:#0f172a;">🟡 New lead — needs consultant allocation</h1>
    <p style="margin:0 0 16px 0;color:#475569;">A new self-signup landed in the portal and needs you to allocate a consultant.</p>

    <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 20px 0;">
      <tr><td style="color:#64748b;width:140px;">Business</td><td><strong>${escapeHtml(business_name || '—')}</strong></td></tr>
      <tr><td style="color:#64748b;">Contact</td><td>${escapeHtml(contact_person || '—')}</td></tr>
      <tr><td style="color:#64748b;">Email</td><td><a href="mailto:${escapeHtml(email || '')}" style="color:#a764e6;">${escapeHtml(email || '—')}</a></td></tr>
      <tr><td style="color:#64748b;">Phone</td><td>${escapeHtml(phone || '—')}</td></tr>
      <tr><td style="color:#64748b;">Signed up</td><td>${escapeHtml(signupHuman)}</td></tr>
    </table>

    <a href="${allocateUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Allocate now →</a>

    <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;">Lead is currently attributed to the owner. You have 7 days to reassign closer commission to a Field Agent on allocation.</p>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: HEAD_EMAIL,
      subject,
      html
    });
    return Response.json({ success: true, sent_to: HEAD_EMAIL });
  } catch (err: any) {
    console.error('[send-owner-lead-notification] resend failed:', err?.message);
    return Response.json({ success: false, reason: 'resend_send_failed', detail: err?.message }, { status: 500 });
  }
});
