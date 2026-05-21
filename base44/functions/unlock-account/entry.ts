import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { token } = await req.json();

  if (!token) {
    return Response.json({ error: 'Missing unlock token.' }, { status: 400 });
  }

  // Find the AppUser with this unlock token
  let users;
  try {
    users = await base44.asServiceRole.entities.AppUser.filter({ unlock_token: token });
  } catch (err) {
    console.error('[unlock-account] AppUser lookup failed:', err);
    return Response.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }

  const user = users?.[0];

  if (!user) {
    return Response.json({ error: 'invalid_token', message: 'This unlock link is invalid or has already been used.' }, { status: 404 });
  }

  // Check token expiry (24h)
  if (!user.unlock_token_expires_at || new Date(user.unlock_token_expires_at) < new Date()) {
    return Response.json({ error: 'expired_token', message: 'This unlock link has expired. Your account will auto-unlock after 15 minutes, or you can reset your password.' }, { status: 410 });
  }

  // Clear the lockout
  await base44.asServiceRole.entities.AppUser.update(user.id, {
    lockout_until: null,
    failed_login_count: 0,
    unlock_token: null,
    unlock_token_expires_at: null
  });

  return Response.json({ success: true, email: user.email });
});