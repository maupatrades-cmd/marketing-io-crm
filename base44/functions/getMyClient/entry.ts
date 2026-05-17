import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// LB-024: returns the caller's own Client row, including deletion_* fields.
// Used by DeletionPendingBanner to render the pending-deletion warning.
//
// Auth: session_token in body. Returns 401 if missing/invalid/expired.
// Returns 404 if the caller has no linked Client (staff users, etc.).

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { token } = body || {};
  if (!token) return Response.json({ error: 'token required' }, { status: 401 });

  let caller: any = null;
  try {
    const list = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ session_token: token }));
    caller = list[0] || null;
  } catch (err) {
    console.error('[getMyClient] AppUser lookup failed:', err);
  }
  if (!caller) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!caller.session_expires_at || new Date(caller.session_expires_at) < new Date()) {
    return Response.json({ error: 'session_expired' }, { status: 401 });
  }

  let client: any = null;
  try {
    const list = unwrapList(await base44.asServiceRole.entities.Client.filter({ client_user_id: caller.id }));
    client = list[0] || null;
  } catch (err) {
    console.error('[getMyClient] Client lookup failed:', err);
  }
  if (!client) return Response.json({ error: 'no_client_record' }, { status: 404 });

  return Response.json({ client });
});
