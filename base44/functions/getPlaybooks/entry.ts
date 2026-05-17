import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// This function validates the custom mio_session_token against AppUser,
// then fetches all Playbooks using service role. It mirrors the pattern
// used by auth-me which is confirmed working in production.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;

  if (!token) {
    return Response.json({ error: 'Token required' }, { status: 400 });
  }

  // Validate session via AppUser — same pattern as auth-me
  let user;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    user = appUsers?.[0];
  } catch (err) {
    console.error('[getPlaybooks] AppUser lookup failed:', err);
    return Response.json({ error: 'Session lookup failed' }, { status: 500 });
  }

  if (!user) {
    return Response.json({ error: 'Invalid session' }, { status: 401 });
  }

  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Session expired' }, { status: 401 });
  }

  // Fetch all playbooks (Playbook entity has open read RLS)
  let playbooks = [];
  try {
    playbooks = await base44.asServiceRole.entities.Playbook.list();
  } catch (err) {
    console.error('[getPlaybooks] Playbook.list failed:', err);
    return Response.json({ error: 'Failed to load playbooks' }, { status: 500 });
  }

  return Response.json({ playbooks, user_role: user.role });
});