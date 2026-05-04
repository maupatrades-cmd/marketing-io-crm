import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, code, purpose } = await req.json();

  if (!email || !code || !purpose) {
    return Response.json({ error: 'Email, code, and purpose are required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

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
    console.error('[auth-verify-otp] AppUser lookup failed:', err);
  }

  if (!user) {
    try {
      const legacyUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
      if (legacyUsers?.[0]) {
        user = legacyUsers[0];
        userEntity = 'User';
      }
    } catch (err) {
      console.error('[auth-verify-otp] User lookup failed:', err);
    }
  }

  let otpValid = false;
  
  if (user) {
    // Check OTP on User record
    const codeMatches = user.pending_otp_code === code;
    const purposeMatches = user.pending_otp_purpose === purpose;
    const notExpired = user.pending_otp_expires_at && new Date(user.pending_otp_expires_at) > now;
    
    console.log('[auth-verify-otp] User found, checking OTP:', {
      email: normalizedEmail,
      codeMatches,
      purposeMatches,
      notExpired
    });
    
    otpValid = codeMatches && purposeMatches && notExpired;
  } else {
    // Check OTP in OTPCode entity (for non-users)
    const otpCodes = await base44.asServiceRole.entities.OTPCode.filter({ 
      email: normalizedEmail,
      code: code,
      purpose: purpose
    });
    const otpRecord = otpCodes?.[0];
    
    if (otpRecord) {
      const notExpired = otpRecord.expires_at && new Date(otpRecord.expires_at) > now;
      console.log('[auth-verify-otp] OTPCode found for non-user, checking expiry:', notExpired);
      otpValid = notExpired;
      
      if (otpValid) {
        // Mark OTPCode as used
        await base44.asServiceRole.entities.OTPCode.update(otpRecord.id, { used: true, used_at: now.toISOString() });
      }
    }
  }

  if (!otpValid) {
    console.log('[auth-verify-otp] Verification failed');
    return Response.json({ error: 'Code expired or invalid' }, { status: 401 });
  }

  if (user) {
    // Existing app user verification
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const userUpdate = {
      session_token: token,
      session_expires_at: expiresAt,
      last_login_at: now.toISOString(),
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

    await base44.asServiceRole.entities[userEntity].update(user.id, userUpdate);

    // Fire-and-forget signup welcome email (signup_verification only — NOT login MFA / password reset).
    // Must never block the verification response.
    if (purpose === 'signup_verification') {
      try {
        const clients = await base44.asServiceRole.entities.Client.filter({ email: normalizedEmail });
        if (clients?.[0]) {
          base44.functions.invoke('send-signup-welcome-email', { client_id: clients[0].id }).catch(err => {
            console.error('[auth-verify-otp] welcome email failed:', err);
          });
        }
      } catch (err) {
        console.error('[auth-verify-otp] welcome email trigger error:', err);
      }
    }

    return Response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      }
    }, { status: 200 });
  } else {
    // Non-user (OTPCode) verification
    console.log('[auth-verify-otp] Non-user OTP verified successfully');
    return Response.json({
      verified: true,
      email: normalizedEmail,
      purpose: purpose
    }, { status: 200 });
  }
});