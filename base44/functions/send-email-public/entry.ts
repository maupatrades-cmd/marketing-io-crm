import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const WHITELIST = ['forgot_password'];

// Simple in-memory rate limit
const rateLimitMap = new Map();
function checkRateLimit(to, purpose) {
  const key = `${to}|${purpose}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxSends = 5;
  const timestamps = (rateLimitMap.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxSends) return false;
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

function buildCtaButton(cta) {
  if (!cta) return '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
    <a href="${cta.url}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">${cta.text}</a>
  </td></tr></table>`;
}

function wrapEmail(bodyHtml, preheader, cta) {
  const pre = preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#0f172a;">${preheader}</div>` : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto;" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">
  ${bodyHtml}${buildCtaButton(cta)}
</td></tr>
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

async function sendViaResend(to, subject, bodyHtml, preheader, cta, base44) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    if (base44) await base44.asServiceRole.entities.SecurityEvent.create({ event_type: 'email_send_failed', email: to, details: 'RESEND_API_KEY missing' }).catch(() => {});
    return { success: false, error: 'Email service not configured' };
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from: 'Marketing iO Team <hello@marketingio.co.za>', to, subject, html: wrapEmail(bodyHtml, preheader, cta) });
  if (result.error) {
    const msg = result.error.message || JSON.stringify(result.error);
    if (base44) await base44.asServiceRole.entities.SecurityEvent.create({ event_type: 'email_send_failed', email: to, details: msg }).catch(() => {});
    return { success: false, error: msg };
  }
  return { success: true, message_id: result.data?.id };
}

function renderForgotPassword(payload) {
  const { full_name = 'there', reset_url = '#' } = payload;
  return {
    subject: 'Reset your Marketing iO password',
    preheader: 'Reset your password — link expires in 30 minutes.',
    cta: { text: 'Reset Password →', url: reset_url },
    bodyHtml: `
      <p style="margin:0 0 16px 0;">Hi ${full_name},</p>
      <p style="margin:0 0 16px 0;">We received a request to reset your Marketing iO password.</p>
      <p style="margin:0 0 16px 0;">Click the button below to set a new password. The link expires in <strong>30 minutes</strong>.</p>
      <p style="margin:0 0 8px 0;color:#64748b;font-size:14px;">Or copy this link:<br><a href="${reset_url}" style="color:#a764e6;word-break:break-all;">${reset_url}</a></p>
      <p style="margin:16px 0 0 0;color:#94a3b8;font-size:14px;">If you didn't request this, ignore this email — your account is safe.</p>`
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { purpose, to, payload = {} } = await req.json();

  if (!WHITELIST.includes(purpose)) {
    return Response.json({ error: 'Unknown email purpose' }, { status: 400 });
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return Response.json({ error: 'Valid recipient email required' }, { status: 400 });
  }
  if (!checkRateLimit(to, purpose)) {
    return Response.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  const emailData = purpose === 'forgot_password' ? renderForgotPassword(payload) : null;
  const result = await sendViaResend(to, emailData.subject, emailData.bodyHtml, emailData.preheader, emailData.cta, base44);

  return Response.json(result, { status: result.success ? 200 : 500 });
});