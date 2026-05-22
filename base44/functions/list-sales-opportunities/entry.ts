import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sales Opportunities workspace data source.
// Returns every Client in a non-active sales lifecycle_stage
// (lead / no_package / cancelled / churned), enriched with:
//   - cancelled_invoice_count: number of that client's cancelled invoices
//   - last_contact_at: date of the most recent InteractionNote for the client
// Access: owner / admin / cpc / field_agent only (session-token validated).

const OPPORTUNITY_STAGES = ['lead', 'no_package', 'cancelled', 'churned'];
const ALLOWED_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];
const STAGE_ORDER = { lead: 0, no_package: 1, cancelled: 2, churned: 3 };

function unwrap(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

async function deriveActor(base44, token) {
  if (!token) return null;
  let user = null;
  try {
    user = unwrap(await base44.asServiceRole.entities.AppUser.filter({ session_token: token }))[0] || null;
  } catch { /* fall through to legacy User */ }
  if (!user) {
    try {
      user = unwrap(await base44.asServiceRole.entities.User.filter({ session_token: token }))[0] || null;
    } catch { return null; }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) return null;
  return { userId: String(user.id || ''), role: String(user.role || 'client') };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const actor = await deriveActor(base44, body?.token);
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Clients in a non-active sales stage — one filter per stage (bounded).
  let clients = [];
  try {
    for (const stage of OPPORTUNITY_STAGES) {
      const rows = unwrap(await base44.asServiceRole.entities.Client.filter({ lifecycle_stage: stage }, '-created_date', 500));
      clients = clients.concat(rows);
    }
  } catch (err) {
    console.error('[list-sales-opportunities] client lookup failed:', err);
    return Response.json({ error: 'client_lookup_failed' }, { status: 500 });
  }

  // Cancelled-invoice count per client — single query, reduced in memory.
  const cancelledCount = {};
  try {
    const cancelled = unwrap(await base44.asServiceRole.entities.Invoice.filter({ status: 'cancelled' }));
    for (const inv of cancelled) {
      if (inv.client_id) cancelledCount[inv.client_id] = (cancelledCount[inv.client_id] || 0) + 1;
    }
  } catch (err) {
    console.error('[list-sales-opportunities] invoice lookup failed (non-fatal):', err?.message);
  }

  // Last staff contact = most recent InteractionNote per client — single query.
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
    console.error('[list-sales-opportunities] note lookup failed (non-fatal):', err?.message);
  }

  const opportunities = clients.map(c => ({
    id: c.id,
    business_name: c.business_name || '',
    contact_person: c.contact_person || '',
    phone: c.phone || '',
    lifecycle_stage: c.lifecycle_stage || '',
    created_date: c.created_date || c.created_at || null,
    cancelled_invoice_count: cancelledCount[c.id] || 0,
    last_contact_at: lastContact[c.id] || null,
  }));

  opportunities.sort((a, b) => {
    const sa = STAGE_ORDER[a.lifecycle_stage] ?? 99;
    const sb = STAGE_ORDER[b.lifecycle_stage] ?? 99;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime();
  });

  return Response.json({ opportunities });
});
