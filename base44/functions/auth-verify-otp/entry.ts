import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, code, purpose } = await req.json();

  if (!email || !code || !purpose) {
    return Response.json({ error: 'Email, code, and purpose are required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const users = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (!users || users.length === 0) {
    return Response.json({ error: 'User not found.' }, { status: 404 });
  }
  const user = users[0];

  // Validate OTP stored on user record
  const codeMatches = user.pending_otp_code === code;
  const purposeMatches = user.pending_otp_purpose === purpose;
  const notExpired = user.pending_otp_expires_at && new Date(user.pending_otp_expires_at) > now;

  console.log('[auth-verify-otp] Verification attempt:', {
    email: normalizedEmail,
    submittedCode: code,
    storedCode: user.pending_otp_code,
    codeMatches,
    purposeMatches,
    expiresAt: user.pending_otp_expires_at,
    now: now.toISOString(),
    notExpired
  });

  const otpValid = codeMatches && purposeMatches && notExpired;

  if (!otpValid) {
    const reason = !codeMatches ? 'code mismatch' : !purposeMatches ? 'purpose mismatch' : 'expired';
    console.log('[auth-verify-otp] Verification failed:', reason);
    return Response.json({ error: 'Code expired or invalid' }, { status: 401 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  const userUpdate = {
    session_token: token,
    session_expires_at: expiresAt,
    last_login_at: now.toISOString(),
    // Clear OTP fields
    pending_otp_code: null,
    pending_otp_expires_at: null,
    pending_otp_purpose: null
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