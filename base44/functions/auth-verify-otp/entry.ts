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

  // NOTE: Legacy User entity fallback removed — the built-in User entity
  // cannot be queried via asServiceRole from backend functions on production.
  // All users (clients, staff, owner) must be in AppUser.

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

    await base44.asServiceRole.entities.AppUser.update(user.id, userUpdate);

    // NOTE: The built-in User entity cannot be written via asServiceRole in backend functions.
    // All auth is resolved through AppUser.session_token via the auth-me backend function.
    // Backend functions must validate sessions via AppUser — never via base44.auth.me().

    // Activity log — only for clients, non-fatal, never block the response
    if (purpose === 'login_mfa' && user.role === 'client') {
      try {
        const clientList = await base44.asServiceRole.entities.Client.filter({ client_user_id: user.id });
        const client = (Array.isArray(clientList) ? clientList : [])[0];
        if (client?.id) {
          const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
          await base44.asServiceRole.entities.ClientActivityLog.create({
            client_id: client.id, client_name: String(client.business_name || '').trim(),
            actor_id: user.id, actor_role: String(user.role || 'client'),
            event_type: 'login_success', event_label: 'Login',
            event_category: 'auth', event_summary: 'Logged in',
            logged_by: user.id, logged_by_name: String(user.full_name || user.email || ''),
            ip_address: ip.slice(0, 64), user_agent: (req.headers.get('user-agent') || '').slice(0, 500),
          });
        }
      } catch (_) {}
    }

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