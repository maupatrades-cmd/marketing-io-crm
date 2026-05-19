import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { token } = await req.json();

  if (!token) {
    return Response.json({ error: 'Token is required.' }, { status: 400 });
  }

  // Look up session in AppUser (client portal) first, then fall back to User (staff/CRM directory).
  // Each lookup wrapped in its own try so a transient AppUser error doesn't defeat the User fallback.
  let user;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    if (appUsers?.[0]) {
      user = appUsers[0];
    }
  } catch (err) {
    console.error('[auth-me] AppUser lookup failed:', err);
  }

  // NOTE: Legacy User entity fallback removed — the built-in User entity
  // cannot be queried via asServiceRole from backend functions on production.
  // All users must be in AppUser.

  if (!user) {
    return Response.json({ error: 'Invalid session' }, { status: 401 });
  }

  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Session expired' }, { status: 401 });
  }

  // LB-031c / LB-025: honor force_logout_at. sign-out-everywhere and
  // emergency-account-lockdown bump this field to "now" to invalidate any
  // session issued before that moment. Use last_login_at as the
  // "session_issued_at" proxy — it's written atomically with session_token
  // in auth-verify-otp. Without this check, force_logout_at was a passive
  // tombstone (LB-025 ship-bug).
  if (
    user.force_logout_at &&
    user.last_login_at &&
    new Date(user.last_login_at) < new Date(user.force_logout_at)
  ) {
    return Response.json({ error: 'force_logged_out' }, { status: 401 });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
      email_verified: user.email_verified
    }
  }, { status: 200 });
});