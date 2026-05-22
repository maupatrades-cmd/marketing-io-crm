import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Upsell LIST data source — active clients with package, add-ons, last contact.
// Access: owner / admin / cpc / field_agent only.
// Session is validated via the auth-me function (asServiceRole.AppUser.filter
// on session_token returns 401 — same correction applied to
// list-sales-opportunities).

const ALLOWED_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];

function unwrap(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

async function validateActor(base44, token) {
  if (!token) return null;
  try {
    const authRes = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      return {
        userId: String(authData.user.id || ''),
        role: String(authData.user.role || 'client'),
      };
    }
  } catch (err) {
    console.error('[list-upsell-clients] auth-me validation failed:', err?.message);
  }
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const actor = await validateActor(base44, body?.token);
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Active clients: lifecycle_stage='active', OR status='active' with no
  // lifecycle_stage (legacy rows pre-dating the feature). Fetch all + filter
  // in memory — lifecycle_stage defaults only on NEW records, so a direct
  // .filter({lifecycle_stage}) misses legacy rows.
  let clients = [];
  try {
    const all = unwrap(await base44.asServiceRole.entities.Client.list('-created_date', 2000));
    clients = all.filter(c => {
      const stage = c.lifecycle_stage || null;
      if (stage === 'active') return true;
      if (!stage && c.status === 'active') return true;
      return false;
    });
    console.log(`[list-upsell-clients] total=${all.length} active=${clients.length}`);
  } catch (err) {
    console.error('[list-upsell-clients] client lookup failed:', err);
    return Response.json({ error: 'client_lookup_failed' }, { status: 500 });
  }

  // Add-ons owned per client (status != cancelled) — single query.
  const addonsByClient = {};
  try {
    const addons = unwrap(await base44.asServiceRole.entities.ClientAddOn.filter({}));
    for (const a of addons) {
      if (!a.client_id || a.status === 'cancelled') continue;
      (addonsByClient[a.client_id] = addonsByClient[a.client_id] || []).push(a.add_on);
    }
  } catch (err) {
    console.error('[list-upsell-clients] addon lookup failed (non-fatal):', err?.message);
  }

  // Last contact = most recent InteractionNote per client — single query.
  const lastContact = {};
  try {
    const notes = unwrap(await base44.asServiceRole.entities.InteractionNote.filter({}));
    for (const n of notes) {
      if (!n.client_id) continue;
      const when = n.created_date || n.created_at;
      if (!when) continue;
      if (!lastContact[n.client_id] || new Date(when) > new Date(lastContact[n.client_id])) {
        lastContact[n.client_id] = when;
      }
    }
  } catch (err) {
    console.error('[list-upsell-clients] note lookup failed (non-fatal):', err?.message);
  }

  const result = clients.map(c => ({
    id: c.id,
    business_name: c.business_name || '',
    contact_person: c.contact_person || '',
    phone: c.phone || '',
    email: c.email || '',
    current_package: c.package || 'none',
    monthly_retainer: Number(c.monthly_retainer || 0),
    addons_owned: addonsByClient[c.id] || [],
    customer_since: c.created_date || c.created_at || null,
    last_contact_at: lastContact[c.id] || null,
  }));

  // Overdue-for-contact bubbles to top: never-contacted first, then oldest
  // contact first. (Brief said "descending" but the parenthetical intent —
  // "overdue bubble to top" — is ascending; implemented per intent.)
  result.sort((a, b) => {
    const ta = a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0;
    const tb = b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0;
    return ta - tb;
  });

  return Response.json({ clients: result });
});
