import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';
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

async function sendLockoutEmail(to, fullName, unlockLink) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) { console.error('[auth-login] RESEND_API_KEY missing for lockout email'); return; }

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${fullName},</p>
    <p style="margin:0 0 16px 0;">Your Marketing iO account has been <strong>locked</strong> because of 5 failed login attempts. This may be you forgetting your password, or someone else trying to access your account.</p>
    <p style="margin:0 0 12px 0;font-weight:600;">You have two options:</p>
    <ol style="margin:0 0 16px 0;padding-left:20px;">
      <li style="margin-bottom:8px;">Wait <strong>15 minutes</strong> and the lockout will clear automatically. Then try logging in again.</li>
      <li style="margin-bottom:8px;">Click below to unlock now:</li>
    </ol>
    <div style="text-align:center;margin:24px 0;">
      <a href="${unlockLink}" style="display:inline-block;background:linear-gradient(135deg,#a764e6,#ec4899);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">🔓 Unlock my account now</a>
    </div>
    <p style="color:#64748b;font-size:14px;margin:0 0 8px 0;">If you didn't try to log in, someone may have your email and is guessing your password. We recommend you <a href="https://app.marketingio.co.za/forgot-password" style="color:#a764e6;">reset your password</a> as soon as you regain access.</p>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">If you can't click the unlock link, email us at <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a>.</p>
    <p style="color:#94a3b8;font-size:13px;margin:24px 0 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">— The Marketing iO Team<br>Marketing iO (Pty) Ltd · <a href="https://marketingio.co.za" style="color:#a764e6;">marketingio.co.za</a> · info@marketingio.co.za</p>`;

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to,
    subject: 'Your Marketing iO account has been locked',
    html: wrapEmail(bodyHtml)
  });
  if (result.error) { console.error('[auth-login] Lockout email failed:', result.error); }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, password } = await req.json();

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

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

  if (!user) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Lockout check — auto-clears after 15 min (lockout_until in the past = unlocked)
  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    const msRemaining = new Date(user.lockout_until) - new Date();
    const minutesRemaining = Math.ceil(msRemaining / 60000);
    return Response.json({
      error: `Account locked. Try again in ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'} or check your email.`,
      lockout_until: user.lockout_until
    }, { status: 423 });
  }

  // LB-031c: refuse login if emergency lockdown was triggered via "wasn't me" link.
  // Frontend will redirect to /account-recovery for security-question-based recovery.
  if (user.password_reset_required) {
    return Response.json({
      error: 'password_reset_required',
      needs_recovery: true,
      email: normalizedEmail,
      message: 'Your account is locked. Please answer your security questions to continue.',
    }, { status: 423 });
  }

  if (user.pending_verification) {
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

    // On 5th failure: lock for 15 min + generate one-time unlock token + send lockout email
    if (newCount >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const unlockToken = crypto.randomUUID();
      const unlockExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      updateData.lockout_until = lockUntil;
      updateData.unlock_token = unlockToken;
      updateData.unlock_token_expires_at = unlockExpires;

      await base44.asServiceRole.entities.AppUser.update(user.id, updateData);

      const unlockLink = `https://app.marketingio.co.za/account-unlocked?token=${unlockToken}`;
      try { await sendLockoutEmail(normalizedEmail, user.full_name || 'there', unlockLink); } catch (_) {}

      const msRemaining = new Date(lockUntil) - new Date();
      const minutesRemaining = Math.ceil(msRemaining / 60000);
      return Response.json({
        error: `Account locked. Try again in ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'} or check your email.`,
        lockout_until: lockUntil
      }, { status: 423 });
    }

    await base44.asServiceRole.entities.AppUser.update(user.id, updateData);

    // Activity log — non-fatal
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

  // Valid password — generate MFA OTP, reset failed count and any expired lockout state
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await base44.asServiceRole.entities.AppUser.update(user.id, {
    pending_otp_code: otp,
    pending_otp_expires_at: expires,
    pending_otp_purpose: 'login_mfa',
    failed_login_count: 0,
    lockout_until: null,
    unlock_token: null,
    unlock_token_expires_at: null
  });

  try { await sendOtpEmail(normalizedEmail, user.full_name || 'there', otp); } catch (_) {}

  return Response.json({ 
    needs_otp: true, 
    email: normalizedEmail,
    user_id: user.id 
  }, { status: 200 });
});