import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// list-my-sales — data source for the "Closed Sales" tab of /my-sales.
//
// Returns every Invoice closed by the caller (Invoice.closer_id === actor.userId),
// enriched with the matching Client's contact info plus a UI-friendly status
// bucket. One row per invoice — the same client may appear multiple times when
// a salesperson closed the initial signup AND a later upsell to that client.
//
// Access: owner / admin / cpc / field_agent. Session-token validated via auth-me.
//
// Scale note (also in PR description): the 5000-invoice cap is safe at current
// volume (~22 invoices in prod today) but won't scale forever — future
// enhancement is pagination or pre-aggregation.
// =============================================================================

const ALLOWED_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

// Map raw Invoice.status to the UI bucket the page renders as a badge.
function statusBucket(status: string | null | undefined): string {
  if (status === 'paid') return 'paid';
  if (status === 'overdue' || status === 'failed') return 'action_needed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'draft' || status === 'sent' || status === 'partial') return 'unpaid';
  return 'none';
}

function titleize(s: string): string {
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = String(body?.token ?? '').trim();
  if (!token) return Response.json({ error: 'token_required' }, { status: 401 });

  // Validate session via auth-me — same pattern as list-sales-opportunities.
  let actor: { userId: string; role: string } | null = null;
  try {
    const authRes = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      actor = {
        userId: String(authData.user.id || ''),
        role:   String(authData.user.role || 'client'),
      };
    }
  } catch (err) {
    console.error('[list-my-sales] auth-me failed:', (err as any)?.message);
  }
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Pull invoices closed by this actor — server-side filter scopes by user.
  let invoices: any[] = [];
  try {
    invoices = unwrap(
      await base44.asServiceRole.entities.Invoice.filter(
        { closer_id: actor.userId },
        '-created_date',
        5000,
      ),
    );
  } catch (err) {
    console.error('[list-my-sales] invoice lookup failed:', err);
    return Response.json({ error: 'invoice_lookup_failed' }, { status: 500 });
  }

  // Build the set of client_ids we need to enrich, then look up Clients once.
  const clientIds = new Set<string>();
  for (const inv of invoices) {
    if (inv?.client_id) clientIds.add(String(inv.client_id));
  }

  const clientById = new Map<string, any>();
  if (clientIds.size > 0) {
    try {
      // Base44.filter doesn't reliably support $in for arbitrary id lists, so
      // we pull a generous list and reduce in memory — same pattern as
      // list-sales-opportunities.
      const all = unwrap(await base44.asServiceRole.entities.Client.list('-created_date', 5000));
      for (const c of all) {
        if (c?.id && clientIds.has(String(c.id))) {
          clientById.set(String(c.id), c);
        }
      }
    } catch (err) {
      // Non-fatal — rows still render with whatever we have on the invoice itself.
      console.error('[list-my-sales] client lookup failed (non-fatal):', (err as any)?.message);
    }
  }

  const closed_sales = invoices.map((inv) => {
    const client = clientById.get(String(inv.client_id || '')) || {};
    const rawDescription = typeof inv.description === 'string' ? inv.description.trim() : '';

    // Product label priority: invoice.description → titleized Client.package → null.
    let productLabel: string | null = null;
    if (rawDescription) {
      productLabel = rawDescription;
    } else if (client.package && client.package !== 'none') {
      productLabel = titleize(String(client.package));
    }

    const status = inv.status || null;
    const amount = inv.total_amount ?? inv.amount ?? null;

    return {
      invoice_id:            String(inv.id || ''),
      invoice_number:        inv.invoice_number || null,
      client_id:             String(inv.client_id || ''),
      business_name:         client.business_name || inv.client_name || '',
      contact_person:        client.contact_person || '',
      phone:                 client.phone || '',
      product_label:         productLabel,
      sale_amount:           amount,
      invoice_status:        status,
      invoice_status_bucket: statusBucket(status),
      sale_date:             inv.created_date || null,
      client_lifecycle_stage: client.lifecycle_stage || null,
    };
  });

  return Response.json({ closed_sales });
});
