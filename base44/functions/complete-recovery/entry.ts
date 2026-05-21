import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { Resend } from 'npm:resend@3.2.0';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function parseDevice(ua) {
  ua = ua || '';
  let os = 'Unknown OS';
  let browser = 'Unknown browser';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (/Edg\//.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  return { os, browser };
}

function formatSAST(date) {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(date) + ' SAST';
}

async function sendConfirmationEmail(to, fullName, ip, ua, lockdownLink) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return;
  const { os, browser } = parseDevice(ua);
  const dateStr = formatSAST(new Date());

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${fullName},</p>
    <p style="margin:0 0 16px 0;">Your Marketing iO account password was just changed.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px 0;">
      <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:40%;">When</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${dateStr}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Browser</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${browser} on ${os}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">IP Address</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${ip || 'Unknown'}</td></tr>
    </table>
    <p style="margin:0 0 16px 0;">If this was you, no action needed.</p>
    <p style="margin:0 0 16px 0;font-weight:600;">If this wasn't you, click below immediately to secure your account:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${lockdownLink}" style="display:inline-block;background:linear-gradient(135deg,#a764e6,#ec4899);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">🔒 This wasn't me — secure my account now</a>
    </div>
    <p style="color:#94a3b8;font-size:13px;margin:24px 0 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">— The Marketing iO Team<br>Marketing iO (Pty) Ltd · <a href="https://marketingio.co.za" style="color:#a764e6;">marketingio.co.za</a> · info@marketingio.co.za</p>`;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to,
    subject: 'Your Marketing iO password was just changed',
    html: wrapEmail(bodyHtml)
  }).catch(err => console.error('[complete-recovery] confirmation email failed:', err));
}

function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { recovery_token, new_password } = await req.json();

  if (!recovery_token || !new_password) {
    return Response.json({ error: 'Recovery token and new password are required.' }, { status: 400 });
  }

  const pwError = validatePassword(new_password);
  if (pwError) return Response.json({ error: pwError }, { status: 400 });

  // Find user by recovery token
  const users = await base44.asServiceRole.entities.AppUser.filter({ recovery_token });
  const user = users?.[0];
  if (!user) {
    return Response.json({ error: 'invalid_token', message: 'This recovery session is invalid or has already been used.' }, { status: 404 });
  }

  // Check expiry (15 min)
  if (!user.recovery_token_expires_at || new Date(user.recovery_token_expires_at) < new Date()) {
    return Response.json({ error: 'expired_token', message: 'Your recovery session has expired. Please start the recovery process again.' }, { status: 410 });
  }

  // Hash new password
  const newHash = await bcrypt.hash(new_password, 12);

  // Generate new lockdown token for the confirmation email "wasn't me" link
  const lockdownToken = crypto.randomUUID();
  const lockdownExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const lockdownLink = `https://app.marketingio.co.za/account-locked-down?token=${lockdownToken}`;

  const now = new Date().toISOString();
  await base44.asServiceRole.entities.AppUser.update(user.id, {
    password_hash: newHash,
    password_changed_at: now,
    password_reset_required: false,
    recovery_token: null,
    recovery_token_expires_at: null,
    recovery_attempts_count: 0,
    recovery_attempts_locked_until: null,
    failed_login_count: 0,
    lockout_until: null,
    lockdown_token: lockdownToken,
    lockdown_token_expires_at: lockdownExpires
  });

  // Send confirmation email (non-fatal)
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const ua = req.headers.get('user-agent') || '';
  try { await sendConfirmationEmail(user.email, user.full_name || 'there', ip, ua, lockdownLink); } catch (_) {}

  return Response.json({ success: true, email: user.email });
});