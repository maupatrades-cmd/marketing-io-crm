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

async function sendOtpEmail(to, fullName, otp) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) { console.error('[auth-login] RESEND_API_KEY missing'); return; }

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${fullName},</p>
    <p style="margin:0 0 16px 0;">Your Marketing iO login verification code is:</p>
    <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#a764e6;text-align:center;padding:20px;background:#f5f3ff;border:2px solid rgba(167,100,230,0.2);border-radius:8px;font-family:monospace;margin:16px 0">${otp}</div>
    <p style="color:#64748b;font-size:14px;margin:0 0 8px 0;">This code expires in <strong>10 minutes</strong>.</p>
    <p style="color:#94a3b8;font-size:14px;margin:0;">If you didn't try to log in, contact <a href="mailto:hello@marketingio.co.za" style="color:#a764e6;">hello@marketingio.co.za</a> immediately.</p>`;

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to,
    subject: `Your Marketing iO login code: ${otp}`,
    html: wrapEmail(bodyHtml)
  });
  if (result.error) { console.error('[auth-login] OTP email failed:', result.error); }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, password } = await req.json();

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up account in AppUser (client portal) first, then fall back to User (staff/CRM directory).
  // Each lookup wrapped in its own try so a transient AppUser error doesn't defeat the User fallback.
  let user;
  let userEntity;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ email: normalizedEmail });
    if (appUsers?.[0]) {
      user = appUsers[0];
      userEntity = 'AppUser';
    }
  } catch (err) {
    console.error('[auth-login] AppUser lookup failed:', err);
  }

  // NOTE: Legacy User entity fallback removed — the built-in User entity
  // cannot be queried via asServiceRole from backend functions on production.
  // All users (clients, staff, owner) must be in AppUser.

  if (!user) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    return Response.json({ error: 'Account locked', lockout_until: user.lockout_until }, { status: 423 });
  }

  // LB-031c: if the user clicked "this wasn't me" after a suspicious password
  // change, refuse to issue an OTP until they reset their password via the
  // public forgot-password flow. The reset-password function clears this flag
  // on successful new-password submission.
  if (user.password_reset_required) {
    return Response.json({
      error: 'password_reset_required',
      email: normalizedEmail,
      message: 'Your account is locked. Please reset your password to continue.',
    }, { status: 423 });
  }

  if (user.pending_verification) {
    // Re-generate OTP so they can verify
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await base44.asServiceRole.entities.AppUser.update(user.id, {
      pending_otp_code: otp,
      pending_otp_expires_at: expires,
      pending_otp_purpose: 'signup_verification'
    });
    try { await sendOtpEmail(normalizedEmail, user.full_name || 'there', otp); } catch (_) {}
    return Response.json({ needs_verification: true, email: normalizedEmail }, { status: 200 });
  }

  const valid = await bcrypt.compare(password, user.password_hash || '');

  if (!valid) {
    const newCount = (user.failed_login_count || 0) + 1;
    const updateData = { failed_login_count: newCount };
    if (newCount >= 5) {
      updateData.lockout_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }
    await base44.asServiceRole.entities.AppUser.update(user.id, updateData);

    // Activity log — non-fatal, never block the response
    try {
      if (user.role === 'client') {
        const clientList = await base44.asServiceRole.entities.Client.filter({ client_user_id: user.id });
        const client = (Array.isArray(clientList) ? clientList : [])[0];
        if (client?.id) {
          const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
          await base44.asServiceRole.entities.ClientActivityLog.create({
            client_id: client.id, client_name: String(client.business_name || '').trim(),
            actor_id: user.id, actor_role: 'client', event_type: 'login_failed',
            event_label: 'Login Failed',
            event_category: 'auth', event_summary: 'Login attempt failed (wrong password)',
            event_metadata: { failed_login_count: newCount, locked: newCount >= 5 },
            logged_by: user.id, logged_by_name: String(user.full_name || user.email || ''),
            ip_address: ip.slice(0, 64), user_agent: (req.headers.get('user-agent') || '').slice(0, 500),
          });
        }
      }
    } catch (_) {}

    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Valid password — generate MFA OTP stored on the matching entity's record
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await base44.asServiceRole.entities.AppUser.update(user.id, {
    pending_otp_code: otp,
    pending_otp_expires_at: expires,
    pending_otp_purpose: 'login_mfa',
    failed_login_count: 0
  });

  try { await sendOtpEmail(normalizedEmail, user.full_name || 'there', otp); } catch (_) {}

  return Response.json({ 
    needs_otp: true, 
    email: normalizedEmail,
    user_id: user.id 
  }, { status: 200 });
});