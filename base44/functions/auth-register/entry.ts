import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

function buildOtpEmail(fullName, otp, type, expiryMinutes) {
  const title = type === 'login' ? 'Your Login Code' : 'Verify Your Account';
  const intro = type === 'login'
    ? `Hi ${fullName},<br><br>Your one-time login code is below. It expires in ${expiryMinutes} minutes.`
    : `Hi ${fullName},<br><br>Welcome to Marketing iO! Your verification code is below. It expires in ${expiryMinutes} minutes.`;
  const warning = type === 'login'
    ? `<p style="font-size:14px;color:#94a3b8;margin:16px 0 0 0;">If you didn't try to log in, contact <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a> immediately.</p>`
    : `<p style="font-size:14px;color:#94a3b8;margin:16px 0 0 0;">If you didn't create an account, you can safely ignore this email.</p>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background-color:#f8f6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6ff;"><tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td align="center" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);padding:28px 24px 20px 24px;">
<img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" height="40" alt="Marketing iO" style="display:block;height:40px;width:auto;filter:invert(1) brightness(10);"/>
<div style="margin-top:8px;font-size:12px;font-style:italic;letter-spacing:1px;color:rgba(255,255,255,0.9);">Too good to stay hidden.</div>
</td></tr>
<tr><td height="4" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;">
<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">${title}</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 24px 0;">${intro}</p>
<div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;color:#a764e6;margin:0 0 24px 0;font-family:'Courier New',Courier,monospace;background:linear-gradient(135deg,rgba(167,100,230,0.08) 0%,rgba(236,72,153,0.06) 100%);border:2px solid rgba(167,100,230,0.2);padding:20px;border-radius:10px;">${otp}</div>
${warning}
</td></tr>
<tr><td height="3" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="background-color:#0f172a;padding:24px;">
<img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" height="24" alt="Marketing iO" style="display:block;height:24px;width:auto;filter:invert(1) brightness(10);margin:0 auto 10px auto;"/>
<div style="font-size:12px;color:#94a3b8;line-height:1.8;">Marketing iO (Pty) Ltd &middot; 75 Marshall Street, Polokwane 0699<br>
<a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a> &bull; <a href="https://marketingio.co.za" style="color:#a764e6;text-decoration:none;">marketingio.co.za</a></div>
</td></tr>
</table></td></tr></table>
</body></html>`;
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
    // Roll back user if client creation fails
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
    // Roll back both records
    if (createdClientId) { try { await base44.asServiceRole.entities.Client.delete(createdClientId); } catch (_) {} }
    await base44.asServiceRole.entities.User.delete(createdUserId);
    return Response.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }

  try {
    const htmlBody = buildOtpEmail(fullName.trim(), otp, 'signup', 15);
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedEmail,
      subject: 'Verify your Marketing iO account',
      body: htmlBody,
      from_name: 'Marketing iO'
    });
  } catch (emailErr) {
    console.error('OTP email failed:', emailErr);
  }

  return Response.json({ user_id: newUser.id, email: normalizedEmail }, { status: 200 });
});