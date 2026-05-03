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

async function sendSignupOtp(to, fullName, otp) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[auth-register] RESEND_API_KEY missing');
    return;
  }
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${fullName},</p>
    <p style="margin:0 0 16px 0;">Welcome to Marketing iO! Your verification code is:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#a764e6;text-align:center;padding:16px;background:#f5f3ff;border:2px solid rgba(167,100,230,0.2);border-radius:8px;font-family:monospace;margin:16px 0">${otp}</div>
    <p style="color:#64748b;font-size:14px;margin:0 0 8px 0;">This code expires in <strong>15 minutes</strong>.</p>
    <p style="color:#94a3b8;font-size:14px;margin:0;">If you didn't create an account, you can safely ignore this email.</p>`;

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to,
    subject: 'Verify your Marketing iO account',
    html: wrapEmail(bodyHtml)
  });
  if (result.error) {
    console.error('[auth-register] OTP email failed:', result.error);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { fullName, email, phone, businessName, password } = await req.json();

  if (!fullName || !email || !password || !businessName) {
    return Response.json({ error: 'All required fields must be provided.' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email format.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (existing && existing.length > 0) {
    return Response.json({ error: 'Account already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let createdUserId = null;
  let createdClientId = null;

  const newUser = await base44.asServiceRole.entities.User.create({
    email: normalizedEmail,
    full_name: fullName.trim(),
    phone: phone?.trim() || '',
    role: 'client',
    password_hash: passwordHash,
    pending_verification: true,
    email_verified: false,
    failed_login_count: 0
  });
  createdUserId = newUser.id;

  try {
    const newClient = await base44.asServiceRole.entities.Client.create({
      business_name: businessName.trim(),
      contact_person: fullName.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || '',
      status: 'lead',
      client_user_id: newUser.id,
      portal_invitation_sent_at: new Date().toISOString()
    });
    createdClientId = newClient.id;
  } catch (clientErr) {
    await base44.asServiceRole.entities.User.delete(createdUserId);
    console.error('Client creation failed, rolled back user:', clientErr);
    return Response.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }

  // Generate OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  try {
    await base44.asServiceRole.entities.OTPCode.create({
      email: normalizedEmail,
      code: otp,
      purpose: 'signup_verification',
      expires_at: expires,
      used: false,
      generated_at: new Date().toISOString(),
      user_id: newUser.id
    });
  } catch (otpErr) {
    if (createdClientId) { try { await base44.asServiceRole.entities.Client.delete(createdClientId); } catch (_) {} }
    await base44.asServiceRole.entities.User.delete(createdUserId);
    return Response.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }

  try {
    await sendSignupOtp(normalizedEmail, fullName.trim(), otp);
  } catch (emailErr) {
    console.error('[auth-register] OTP email send failed (non-fatal):', emailErr);
    // Account is created. User can use "Resend code" on /verify-otp page.
  }

  return Response.json({ user_id: newUser.id, email: normalizedEmail }, { status: 200 });
});