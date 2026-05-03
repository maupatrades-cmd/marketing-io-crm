import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, password } = await req.json();

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const users = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  const user = users?.[0];

  if (!user) {
    await base44.asServiceRole.entities.LoginAttempt.create({
      email_attempted: normalizedEmail,
      success: false,
      failure_reason: 'account_not_found',
      attempted_at: new Date().toISOString()
    });
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    return Response.json({ error: 'Account locked', lockout_until: user.lockout_until }, { status: 423 });
  }

  if (user.pending_verification) {
    return Response.json({ needs_verification: true, email: normalizedEmail }, { status: 200 });
  }

  const valid = await bcrypt.compare(password, user.password_hash || '');

  if (!valid) {
    const newCount = (user.failed_login_count || 0) + 1;
    const updateData = { failed_login_count: newCount };
    if (newCount >= 5) {
      updateData.lockout_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }
    await base44.asServiceRole.entities.User.update(user.id, updateData);
    await base44.asServiceRole.entities.LoginAttempt.create({
      email_attempted: normalizedEmail,
      success: false,
      failure_reason: 'wrong_password',
      attempted_at: new Date().toISOString(),
      user_id: user.id
    });
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Valid password — generate MFA OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await base44.asServiceRole.entities.OTPCode.create({
    email: normalizedEmail,
    code: otp,
    purpose: 'login_mfa',
    expires_at: expires,
    used: false,
    generated_at: new Date().toISOString(),
    user_id: user.id
  });

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedEmail,
      subject: `Your Marketing iO login code: ${otp}`,
      body: `Hi ${user.full_name || 'there'},\n\nYour login code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't try to log in, please contact info@marketingio.co.za immediately.\n\n— The Marketing iO Team`
    });
  } catch (emailErr) {
    console.error('OTP email failed:', emailErr);
  }

  return Response.json({ needs_otp: true, email: normalizedEmail }, { status: 200 });
});