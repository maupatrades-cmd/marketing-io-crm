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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const token = body?.token;
  if (!token) return Response.json({ error: 'token_required' }, { status: 401 });

  // Validate session via the canonical auth-me function (avoids AppUser asServiceRole 401 issue).
  let actor = null;
  try {
    const authRes = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      actor = { userId: String(authData.user.id || ''), role: String(authData.user.role || 'client') };
    }
  } catch (err) {
    console.error('[list-sales-opportunities] auth-me call failed:', err?.message);
  }

  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Fetch ALL clients, then filter in memory.
  // lifecycle_stage defaults to 'no_package' on NEW records only;
  // legacy records may have null/undefined — treat those as 'no_package'.
  // Also cross-check 'status' field so old-schema clients aren't missed.
  let clients = [];
  try {
    const allClients = unwrap(await base44.asServiceRole.entities.Client.list('-created_date', 2000));
    clients = allClients.filter(c => {
      const stage = c.lifecycle_stage || null;
      const status = c.status || null;
      // Explicit non-active lifecycle stages
      if (stage && OPPORTUNITY_STAGES.includes(stage)) return true;
      // Legacy: no lifecycle_stage set AND not active
      if (!stage && status !== 'active') return true;
      return false;
    });
    console.log(`[list-sales-opportunities] total=${allClients.length} opportunities=${clients.length}`);
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
    lifecycle_stage: c.lifecycle_stage || (c.status === 'active' ? 'active' : 'no_package'),
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