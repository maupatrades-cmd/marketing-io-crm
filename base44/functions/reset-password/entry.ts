import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
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
    lockout_until: null,
    // LB-031c: completing a password reset clears the post-lockdown gate
    // and any unconsumed lockdown token from a previous password change.
    password_reset_required: false,
    lockdown_token: null,
    lockdown_token_expires_at: null
  });

  // Activity audit (Client Portal PR A): password_reset_completed.
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
        event_type:     'password_reset_completed',
        event_category: 'auth',
        event_summary:  'Password reset completed',
        event_metadata: {},
        event_label:    'Password reset completed',
        logged_by:      user.id,
        logged_by_name: String(user.full_name || user.email || ''),
        ip_address:     ip.slice(0, 64),
        user_agent:     (req.headers.get('user-agent') || '').slice(0, 500),
      });
    }
  } catch (logErr) {
    console.error('[reset-password] activity log failed (non-fatal):', logErr?.message);
  }

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