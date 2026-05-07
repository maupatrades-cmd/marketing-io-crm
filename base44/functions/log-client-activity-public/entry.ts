import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// log-client-activity-public — Client Portal PR A.
//
// Public bridge function for browser-side activity logging. The frontend
// helper src/lib/activityLog.js calls this with:
//   { token, client_id, event_type, event_category, event_summary,
//     event_metadata }
//
// Defence model:
//   1. Per-IP rate limit — 60 reqs / 5 min (more permissive than
//      payment-public-summary because activity events are bursty).
//   2. Session-token derivation. token (from localStorage) is looked up in
//      AppUser.session_token, falling back to User.session_token. Mirrors
//      the canonical pattern in auth-me.
//   3. CRITICAL: client_id in the payload MUST match the user's linked
//      Client. A logged-in client cannot log activity against someone
//      else's account. Admin/Owner roles bypass this check (they may log
//      activity against any client when staff actions happen via the SPA).
//   4. event_category is enum-validated. Unknown categories rejected.
//   5. ip_address and user_agent captured from request headers.
//
// Failure semantics:
//   On any guarded failure (rate limit, token mismatch, validation), return
//   200 with { ok: false, reason } so the caller's UX doesn't surface
//   internal-implementation noise. Successful writes return { ok: true }.
//
// Why not require a token: events like login_failed happen pre-auth. In
// that case actor_id is null and actor_role defaults to 'client'.
// =============================================================================

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX       = 60;

const VALID_CATEGORIES = new Set([
  'auth', 'profile', 'payment', 'invoice',
  'document', 'communication', 'support', 'account',
]);

const ipHits: Map<string, number[]> = new Map();

function clientIpFrom(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('cf-connecting-ip')?.trim() ||
    'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (ipHits.get(ip) || []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) {
    ipHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipHits.set(ip, recent);
  return false;
}

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

// Mirrored from base44/lib/activityLog.ts (Base44 functions can't import
// from sibling paths — see lib file's header for explanation).
async function deriveActorFromSessionToken(
  base44: any,
  token: string,
): Promise<{ userId: string; role: string; fullName: string } | null> {
  if (!token) return null;
  let user: any = null;
  try {
    const list = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    user = unwrapList(list)[0] || null;
  } catch {
    // Try legacy User next.
  }
  if (!user) {
    try {
      const list = await base44.asServiceRole.entities.User.filter({ session_token: token });
      user = unwrapList(list)[0] || null;
    } catch {
      return null;
    }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) return null;
  return {
    userId:   String(user.id || ''),
    role:     String(user.role || 'client'),
    fullName: String(user.full_name || user.email || ''),
  };
}

// Returns the Client row linked to the user, or null. Used to verify that
// the requested client_id matches the caller's own Client (anti-spoofing).
async function findClientForUser(base44: any, userId: string): Promise<any | null> {
  if (!userId) return null;
  for (const filter of [
    { client_user_id: userId },
    { app_user_id:    userId },
  ]) {
    try {
      const list = await base44.asServiceRole.entities.Client.filter(filter);
      const c = unwrapList(list)[0];
      if (c) return c;
    } catch {
      // Try next filter.
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'use POST' }, { status: 405 });
  }

  const ip        = clientIpFrom(req);
  const userAgent = req.headers.get('user-agent') || '';

  if (isRateLimited(ip)) {
    return Response.json({ ok: false, reason: 'rate_limited' }, { status: 200 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: 'invalid_json' }, { status: 200 });
  }

  const token         = String(body?.token ?? '').trim();
  const clientId      = String(body?.client_id ?? '').trim();
  const eventType     = String(body?.event_type ?? '').trim();
  const eventCategory = String(body?.event_category ?? '').trim();
  const eventSummary  = String(body?.event_summary ?? '').trim();
  const eventMetadata = (body?.event_metadata && typeof body.event_metadata === 'object')
    ? body.event_metadata
    : {};

  // Validate the bare minimum.
  if (!clientId || !eventType || !eventSummary) {
    return Response.json({ ok: false, reason: 'missing_required_field' }, { status: 200 });
  }
  if (!VALID_CATEGORIES.has(eventCategory)) {
    return Response.json({ ok: false, reason: 'invalid_event_category' }, { status: 200 });
  }
  if (eventSummary.length > 500) {
    return Response.json({ ok: false, reason: 'summary_too_long' }, { status: 200 });
  }

  const base44 = createClientFromRequest(req);

  // Derive actor identity from the session token. Missing/invalid token =>
  // unauthenticated event (e.g. login_failed); we still log but with
  // actor_id null and actor_role defaulting to 'client'.
  const actor = await deriveActorFromSessionToken(base44, token);

  // Anti-spoofing: a client-role caller can only log against their OWN
  // Client. Admin/Owner roles can log against any client (used when
  // staff actions take place from the SPA). System actor_role is not
  // accepted from a public endpoint.
  if (actor) {
    const isStaff = actor.role === 'admin' || actor.role === 'owner';
    if (!isStaff) {
      const ownClient = await findClientForUser(base44, actor.userId);
      if (!ownClient || ownClient.id !== clientId) {
        return Response.json({ ok: false, reason: 'client_id_mismatch' }, { status: 200 });
      }
    }
  }

  // Snapshot the client_name so the audit row survives renames.
  let clientName = '';
  try {
    const list = await base44.asServiceRole.entities.Client.filter({ id: clientId });
    const c = unwrapList(list)[0];
    if (c) clientName = String(c.business_name || c.contact_person || '').trim();
  } catch {
    // Non-fatal — proceed without the name.
  }

  // Resolve actor_role. Pre-auth events default to 'client' (the most
  // restrictive non-anonymous role). Any role from the catalog is
  // accepted from a session, BUT 'system' is forbidden — only server
  // functions writing via asServiceRole should produce system rows.
  const actorRole = actor?.role && actor.role !== 'system' ? actor.role : 'client';

  // Build the row. Mirror legacy fields (event_label, logged_by,
  // logged_by_name) from the new fields so existing consumers of
  // ClientActivityLog keep working.
  const row: Record<string, unknown> = {
    client_id:      clientId,
    client_name:    clientName,
    actor_id:       actor?.userId || '',
    actor_role:     actorRole,
    event_type:     eventType.slice(0, 64),
    event_category: eventCategory,
    event_summary:  eventSummary,
    event_metadata: eventMetadata,
    event_label:    eventSummary,
    logged_by:      actor?.userId || '',
    logged_by_name: actor?.fullName || '',
    ip_address:     ip.slice(0, 64),
    user_agent:     userAgent.slice(0, 500),
  };

  try {
    await base44.asServiceRole.entities.ClientActivityLog.create(row);
  } catch (err) {
    console.error('[log-client-activity-public] write failed:', err);
    return Response.json({ ok: false, reason: 'write_failed' }, { status: 200 });
  }

  return Response.json({ ok: true });
});
