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
  const users = await base44.asServiceRole.entities.AppUser.filter({ email: normalizedEmail });
  const user = users?.[0];

  if (!user) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    return Response.json({ error: 'Account locked', lockout_until: user.lockout_until }, { status: 423 });
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
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Valid password — generate MFA OTP stored on AppUser record
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