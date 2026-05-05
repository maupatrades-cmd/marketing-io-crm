import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Bumps AppUser.force_logout_at. auth-me should treat any session/token
// issued before this timestamp as invalid. The current customAuth.js stores
// sessions in localStorage only — so other devices won't be invalidated until
// they hit auth-me again. That's an acceptable V1 trade-off; a follow-up PR
// should wire auth-me to compare session.issued_at against force_logout_at.
//
// TODO(auth-hardening): once auth-me checks force_logout_at, this becomes
// fully effective. Surface a small UI note that other devices may take up
// to a few minutes to log out depending on activity.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { user_id } = body || {};
  if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

  // Resolve which entity owns the row.
  let entity: 'AppUser' | 'User' | null = null;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ id: user_id });
    if ((Array.isArray(appUsers) ? appUsers[0] : appUsers)) entity = 'AppUser';
  } catch (_) {}
  if (!entity) {
    try {
      const legacy = await base44.asServiceRole.entities.User.filter({ id: user_id });
      if ((Array.isArray(legacy) ? legacy[0] : legacy)) entity = 'User';
    } catch (_) {}
  }
  if (!entity) return Response.json({ error: 'user_not_found' }, { status: 404 });

  const nowIso = new Date().toISOString();
  try {
    await base44.asServiceRole.entities[entity].update(user_id, { force_logout_at: nowIso });
  } catch (err: any) {
    console.error('[sign-out-everywhere] update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  return Response.json({ success: true, force_logout_at: nowIso });
});
