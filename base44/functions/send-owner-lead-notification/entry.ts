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
