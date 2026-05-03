import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, code, purpose } = await req.json();

  if (!email || !code || !purpose) {
    return Response.json({ error: 'Email, code, and purpose are required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const otps = await base44.asServiceRole.entities.OTPCode.filter({
    email: normalizedEmail,
    purpose,
    used: false
  });

  const match = otps?.find(o => o.code === code && new Date(o.expires_at) > now);
  if (!match) {
    return Response.json({ error: 'Code expired or invalid' }, { status: 401 });
  }

  await base44.asServiceRole.entities.OTPCode.update(match.id, {
    used: true,
    used_at: now.toISOString()
  });

  const users = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (!users || users.length === 0) {
    return Response.json({ error: 'User not found.' }, { status: 404 });
  }
  const user = users[0];

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  const userUpdate = {
    session_token: token,
    session_expires_at: expiresAt,
    last_login_at: now.toISOString()
  };

  if (purpose === 'signup_verification') {
    userUpdate.pending_verification = false;
    userUpdate.email_verified = true;
  } else if (purpose === 'login_mfa') {
    userUpdate.failed_login_count = 0;
  }

  await base44.asServiceRole.entities.User.update(user.id, userUpdate);

  return Response.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    }
  }, { status: 200 });
});