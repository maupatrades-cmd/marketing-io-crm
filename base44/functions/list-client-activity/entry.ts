import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// list-client-activity — Round 2 of recovery plan.
//
// Inputs (POST JSON):
//   { client_id, token, limit? }
//
// Output:
//   { rows: ClientActivityLog[], count: number }
//
// Why this function exists:
//   The OwnerClientDetail page reads ClientActivityLog via the front-end SDK
//   (base44.entities.ClientActivityLog.filter), which is RLS-gated. The
//   read RLS rule has three OR branches — client_id match, role=owner,
//   role=admin. Branch 1 fails for staff (their user.data.client_id is null)
//   and the user_condition role-match branches don't match for staff
//   sessions in the SDK's RLS evaluator (see blueprint § STOP-EVERYTHING #5).
//   Result: owner/admin viewers see an empty Activity tab even though rows
//   exist.
//
//   This function bypasses the RLS issue by using asServiceRole on the
//   server, after explicitly auth-checking that the caller is owner or
//   admin via session token. The RLS rule itself is NOT modified — clients
//   continue to read their own activity via the existing SDK call (RLS
//   branch 1 works fine for them).
//
// Auth model:
//   - token (session token) MUST be supplied.
//   - Caller's role must be 'owner' or 'admin'.
//   - Field consultants, CPCs, head_of_tech, drivers, and clients are
//     denied — they have no use case for cross-client activity reads from
//     this endpoint. Clients use the direct SDK path; staff sales roles
//     have no business reading other clients' activity logs.
// =============================================================================

const DEFAULT_LIMIT = 60;
const MAX_LIMIT     = 500;

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

async function deriveActorFromSessionToken(base44: any, token: string) {
  if (!token) return null;
  let user: any = null;
  try {
    const list = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    user = unwrapList(list)[0] || null;
  } catch { /* try legacy */ }
  if (!user) {
    try {
      const list = await base44.asServiceRole.entities.User.filter({ session_token: token });
      user = unwrapList(list)[0] || null;
    } catch { return null; }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) return null;
  return {
    userId: String(user.id || ''),
    role:   String(user.role || 'client'),
    email:  String(user.email || ''),
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'use POST' }, { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const clientId = String(body?.client_id ?? '').trim();
  const tokenRaw = String(body?.token ?? '').trim();
  const limitRaw = Number(body?.limit ?? DEFAULT_LIMIT);
  const limit    = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (!clientId) {
    return Response.json({ error: 'client_id required' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  const actor = await deriveActorFromSessionToken(base44, tokenRaw);
  if (!actor) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  let rows: any[] = [];
  try {
    const result = await base44.asServiceRole.entities.ClientActivityLog
      .filter({ client_id: clientId }, '-created_date', limit);
    rows = Array.isArray(result) ? result : unwrapList(result);
  } catch (err) {
    console.error('[list-client-activity] read failed:', err);
    return Response.json({ error: 'read_failed' }, { status: 500 });
  }

  return Response.json({ rows, count: rows.length });
});
