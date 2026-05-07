import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
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
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Valid email required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Always return 200 — don't reveal if user exists.
  // Look up in AppUser (client portal accounts) first, then fall back to User (staff/CRM directory).
  // Each lookup is wrapped in its own try so a transient error on AppUser doesn't defeat the User fallback.
  let user;
  let userEntity;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ email: normalizedEmail });
    if (appUsers?.[0]) {
      user = appUsers[0];
      userEntity = 'AppUser';
    }
  } catch (err) {
    console.error('[send-forgot-password-email] AppUser lookup failed:', err);
  }

  if (!user) {
    try {
      const legacyUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
      if (legacyUsers?.[0]) {
        user = legacyUsers[0];
        userEntity = 'User';
      }
    } catch (err) {
      console.error('[send-forgot-password-email] User lookup failed:', err);
    }
  }

  if (!user) {
    return Response.json({ success: true });
  }

  const resetToken = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await base44.asServiceRole.entities[userEntity].update(user.id, {
    password_reset_token: resetToken,
    password_reset_expires_at: expiresAt
  });

  // Activity audit (Client Portal PR A): password_reset_requested.
  try {
    const clientList = await base44.asServiceRole.entities.Client.filter({ client_user_id: user.id });
    const client = (Array.isArray(clientList) ? clientList : clientList?.data ?? [])[0];
    if (client?.id) {
      const ip =
        (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
        req.headers.get('x-real-ip') || '';
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id:      client.id,
        client_name:    String(client.business_name || client.contact_person || '').trim(),
        actor_id:       user.id,
        actor_role:     String(user.role || 'client'),
        event_type:     'password_reset_requested',
        event_category: 'auth',
        event_summary:  'Password reset requested',
        event_metadata: { token_expires_at: expiresAt },
        event_label:    'Password reset requested',
        logged_by:      user.id,
        logged_by_name: String(user.full_name || user.email || ''),
        ip_address:     ip.slice(0, 64),
        user_agent:     (req.headers.get('user-agent') || '').slice(0, 500),
      });
    }
  } catch (logErr) {
    console.error('[send-forgot-password-email] activity log failed (non-fatal):', logErr?.message);
  }

  const appUrl = 'https://app.marketingio.co.za';
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
  const fullName = user.full_name || 'there';

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${fullName},</p>
    <p style="margin:0 0 16px 0;">We received a request to reset your Marketing iO password.</p>
    <p style="margin:0 0 24px 0;">Click the button below to set a new password. The link expires in <strong>30 minutes</strong>.</p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;"><tr><td>
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Reset Password →</a>
    </td></tr></table>
    <p style="font-size:14px;color:#64748b;margin:0 0 16px 0;">Or copy this link:<br><a href="${resetUrl}" style="color:#a764e6;word-break:break-all;">${resetUrl}</a></p>
    <p style="font-size:14px;color:#94a3b8;margin:0;">If you didn't request this, ignore this email — your account is safe.</p>`;

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (apiKey) {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: normalizedEmail,
      subject: 'Reset your Marketing iO password',
      html: wrapEmail(bodyHtml)
    });
    if (result.error) { console.error('[send-forgot-password-email] Resend error:', result.error); }
  } else {
    console.error('[send-forgot-password-email] RESEND_API_KEY missing');
  }

  return Response.json({ success: true });
});