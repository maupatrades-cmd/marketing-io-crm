import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;

  let userRole = null;

  // Try custom session token first (staff/CPC/FA logged in via OTP)
  if (token) {
    try {
      const appUsers = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
      const appUser = appUsers?.[0];
      if (appUser && appUser.session_expires_at && new Date(appUser.session_expires_at) > new Date()) {
        userRole = appUser.role;
      }
    } catch (err) {
      console.error('[getPlaybooks] AppUser lookup error:', err);
    }
  }

  // Fallback: try native Base44 SDK auth (owner logs in via SDK)
  if (!userRole) {
    try {
      const sdkUser = await base44.auth.me();
      if (sdkUser) {
        userRole = sdkUser.role || 'owner';
      }
    } catch (_) {
      // not authenticated via SDK either
    }
  }

  if (!userRole) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all playbooks
  let playbooks = [];
  try {
    playbooks = await base44.asServiceRole.entities.Playbook.list();
  } catch (err) {
    console.error('[getPlaybooks] Playbook.list failed:', err);
    return Response.json({ error: 'Failed to load playbooks' }, { status: 500 });
  }

  return Response.json({ playbooks, user_role: userRole });
});