import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// log-client-activity — legacy portal-feed write helper.
//
// Pre-existing function. Callers (auth-register, create-invoice,
// cancel-invoice, submit-enquiry, ...) send the legacy payload shape:
//   { client_id, user_id?, client_name?, title, body?, icon?, category?,
//     source?, link? }
//
// Client Portal PR A introduced new ClientActivityLog fields (actor_id,
// actor_role, event_category, event_summary, event_metadata, ...) that are
// REQUIRED by the live schema. To avoid touching every legacy caller,
// THIS function maps the legacy payload to the new required fields on the
// way through. Old callers keep working unchanged; new code writes
// directly to ClientActivityLog with the new field names.
//
// Mapping rules:
//   title     →  event_summary  (title is also written for back-compat)
//   user_id   →  actor_id       (also actor_role inferred from User.role)
//   source    →  event_category (mapping table below)
//   icon/category/body/link kept verbatim as legacy fields.
// =============================================================================

const DEFAULT_CATEGORY = 'info';
const DEFAULT_SOURCE   = 'system';
const DEFAULT_ICON     = 'Bell';

// Map legacy 'source' values to the new event_category enum.
const SOURCE_TO_CATEGORY: Record<string, string> = {
  signup:       'account',
  enquiry:      'support',
  invoice:      'invoice',
  payment:      'payment',
  deliverable:  'document',
  contract:     'document',
  onboarding:   'profile',
  cancellation: 'invoice',
  system:       'account',
};

// Map a User/AppUser.role to actor_role. Driver and head_of_tech pass through.
function inferActorRole(role: string | undefined): string {
  const r = String(role || '').trim().toLowerCase();
  if (['client', 'admin', 'owner', 'cpc', 'field_agent', 'head_of_tech', 'driver'].includes(r)) {
    return r;
  }
  return 'system';
}

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try {
    body = await req.json();
  } catch {
    console.error('[log-client-activity] invalid_json');
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    client_id,
    user_id,
    client_name,
    title,
    body: detailBody,
    icon,
    category,
    source,
    link,
  } = body || {};

  if (!client_id) {
    console.error('[log-client-activity] missing client_id');
    return Response.json({ error: 'client_id required' }, { status: 400 });
  }
  if (!title) {
    console.error('[log-client-activity] missing title');
    return Response.json({ error: 'title required' }, { status: 400 });
  }

  // Look up actor's role + name when a user_id was supplied. Best-effort —
  // a missing/legacy user_id falls back to actor_role='system'.
  let actorRole = 'system';
  let actorName = '';
  if (user_id) {
    let user: any = null;
    try {
      const list = await base44.asServiceRole.entities.AppUser.filter({ id: user_id });
      user = unwrapList(list)[0] || null;
    } catch {
      // Try legacy User.
    }
    if (!user) {
      try {
        const list = await base44.asServiceRole.entities.User.filter({ id: user_id });
        user = unwrapList(list)[0] || null;
      } catch {
        /* ignore */
      }
    }
    if (user) {
      actorRole = inferActorRole(user.role);
      actorName = String(user.full_name || user.email || '');
    }
  }

  const eventCategory = SOURCE_TO_CATEGORY[String(source || DEFAULT_SOURCE)] || 'account';

  try {
    const row = await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id,
      client_name: client_name || '',

      // ---- New (PR A) required fields -----------------------------------
      actor_id:       user_id || '',
      actor_role:     actorRole,
      event_type:     'note',                      // legacy default
      event_category: eventCategory,
      event_summary:  title,
      event_metadata: detailBody ? { body: String(detailBody) } : {},
      event_label:    title,                       // legacy required field
      logged_by:      user_id || '',
      logged_by_name: actorName,

      // ---- Legacy fields preserved verbatim -----------------------------
      user_id:  user_id || '',
      title,
      body:     detailBody || '',
      icon:     icon || DEFAULT_ICON,
      category: category || DEFAULT_CATEGORY,
      source:   source || DEFAULT_SOURCE,
      link:     link || '',
    });
    return Response.json({ success: true, activity_id: row?.id });
  } catch (err: any) {
    console.error('[log-client-activity] create failed:', err?.message);
    return Response.json({ error: 'create_failed', detail: err?.message }, { status: 500 });
  }
});
