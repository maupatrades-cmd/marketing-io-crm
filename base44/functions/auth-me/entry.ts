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

  if (!user) {
    try {
      const legacyUsers = await base44.asServiceRole.entities.User.filter({ session_token: token });
      if (legacyUsers?.[0]) {
        user = legacyUsers[0];
      }
    } catch (err) {
      console.error('[auth-me] User lookup failed:', err);
    }
  }

  if (!user) {
    return Response.json({ error: 'Invalid session' }, { status: 401 });
  }

  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Session expired' }, { status: 401 });
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