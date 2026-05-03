import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
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
  const base44 = createClientFromRequest(req);

  // Handle token validation (GET-style via POST with action=validate)
  const body = await req.json();
  const { token, newPassword, action } = body;

  if (!token) {
    return Response.json({ error: 'Token is required.' }, { status: 400 });
  }

  // Look up the reset token in AppUser (client portal) first, then User (staff/CRM directory).
  // Each lookup is wrapped in its own try so a transient error on AppUser doesn't defeat the User fallback.
  let user;
  let userEntity;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ password_reset_token: token });
    if (appUsers?.[0]) {
      user = appUsers[0];
      userEntity = 'AppUser';
    }
  } catch (err) {
    console.error('[reset-password] AppUser lookup failed:', err);
  }

  if (!user) {
    try {
      const legacyUsers = await base44.asServiceRole.entities.User.filter({ password_reset_token: token });
      if (legacyUsers?.[0]) {
        user = legacyUsers[0];
        userEntity = 'User';
      }
    } catch (err) {
      console.error('[reset-password] User lookup failed:', err);
    }
  }

  if (!user || !user.password_reset_expires_at) {
    return Response.json({ error: 'invalid_token', message: 'This reset link is invalid or has already been used.' }, { status: 400 });
  }

  if (new Date(user.password_reset_expires_at) < new Date()) {
    return Response.json({ error: 'expired_token', message: 'This reset link has expired. Please request a new one.' }, { status: 400 });
  }

  // If just validating
  if (action === 'validate') {
    return Response.json({ valid: true, email: user.email });
  }

  // Resetting password
  if (!newPassword || newPassword.length < 10) {
    return Response.json({ error: 'Password must be at least 10 characters.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await base44.asServiceRole.entities[userEntity].update(user.id, {
    password_hash: passwordHash,
    password_reset_token: null,
    password_reset_expires_at: null,
    failed_login_count: 0,
    lockout_until: null
  });

  // Send confirmation email
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (apiKey) {
    const resend = new Resend(apiKey);
    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Hi ${user.full_name || 'there'},</p>
      <p style="margin:0 0 16px 0;">Your Marketing iO password was successfully reset.</p>
      <p style="color:#94a3b8;font-size:14px;margin:0;">If this wasn't you, contact <a href="mailto:hello@marketingio.co.za" style="color:#a764e6;">hello@marketingio.co.za</a> immediately.</p>`;
    await resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: user.email,
      subject: 'Your Marketing iO password has been changed',
      html: wrapEmail(bodyHtml)
    });
  }

  return Response.json({ success: true });
});