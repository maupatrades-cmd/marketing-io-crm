import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// list-my-invoices — data source for the /my-invoices page.
//
// Scope by role:
//   - owner / admin      → every invoice in the org (no closer filter)
//   - cpc / field_agent  → invoices where closer_id === actor.userId
//   - anyone else        → 403
//
// Bucketing (mutually exclusive, processed in priority order):
//   1. paid       — status === 'paid'
//   2. cancelled  — status === 'cancelled'
//   3. overdue    — status === 'overdue' OR status === 'failed'
//                   OR (status === 'sent' AND due_date && due_date < today)
//   4. unpaid     — everything else (draft, sent-not-yet-due,
//                   sent-no-due-date, partial)
// The computed-overdue rule mirrors AdminInvoices.jsx exactly so the same
// invoice never appears as Unpaid in one screen and Overdue in another.
//
// Enrichment is single-pass: one Client.list, one AppUser.list, in-memory
// reduce to Maps. 5000-row caps match list-my-sales / list-sales-opportunities.
//
// Pattern reference: list-my-sales, list-sales-opportunities.
// =============================================================================

const ALLOWED_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];
const SCOPED_TO_SELF_ROLES = new Set(['cpc', 'field_agent']);

const BUCKET_RANK: Record<string, number> = { overdue: 0, unpaid: 1, paid: 2, cancelled: 3 };

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function titleize(s: string): string {
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function bucketize(inv: any, todayMs: number): string {
  if (inv.status === 'paid')      return 'paid';
  if (inv.status === 'cancelled') return 'cancelled';
  if (inv.status === 'overdue' || inv.status === 'failed') return 'overdue';
  if (inv.status === 'sent' && inv.due_date) {
    const due = new Date(inv.due_date).getTime();
    if (Number.isFinite(due) && due < todayMs) return 'overdue';
  }
  return 'unpaid';
}

// "Days outstanding" for the unpaid/overdue tabs. Null for paid/cancelled.
// Reference date priority: due_date → issue_date → created_date.
// Negative values (issued recently with a future due_date) come back as-is;
// the UI clamps them to '—' so a row doesn't read "due in −4 days".
function computeDaysOutstanding(inv: any, bucket: string, todayMs: number): number | null {
  if (bucket === 'paid' || bucket === 'cancelled') return null;
  const ref = inv.due_date || inv.issue_date || inv.created_date;
  if (!ref) return null;
  const refMs = new Date(ref).getTime();
  if (!Number.isFinite(refMs)) return null;
  return Math.floor((todayMs - refMs) / 86_400_000);
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

  // Session validation — same pattern as list-my-sales / list-sales-opportunities.
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
    console.error('[list-my-invoices] auth-me failed:', (err as any)?.message);
  }
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const isScopedToSelf = SCOPED_TO_SELF_ROLES.has(actor.role);

  // Fetch invoices — scoped by role.
  let invoices: any[] = [];
  try {
    if (isScopedToSelf) {
      invoices = unwrap(
        await base44.asServiceRole.entities.Invoice.filter(
          { closer_id: actor.userId },
          '-created_date',
          5000,
        ),
      );
    } else {
      invoices = unwrap(
        await base44.asServiceRole.entities.Invoice.list('-created_date', 5000),
      );
    }
  } catch (err) {
    console.error('[list-my-invoices] invoice lookup failed:', err);
    return Response.json({ error: 'invoice_lookup_failed' }, { status: 500 });
  }

  // Enrichment maps — one round-trip each, reduced in memory.
  const clientIds = new Set<string>();
  const closerIds = new Set<string>();
  for (const inv of invoices) {
    if (inv?.client_id) clientIds.add(String(inv.client_id));
    if (inv?.closer_id) closerIds.add(String(inv.closer_id));
  }

  const clientById = new Map<string, any>();
  if (clientIds.size > 0) {
    try {
      const all = unwrap(await base44.asServiceRole.entities.Client.list('-created_date', 5000));
      for (const c of all) {
        if (c?.id && clientIds.has(String(c.id))) clientById.set(String(c.id), c);
      }
    } catch (err) {
      console.error('[list-my-invoices] client lookup failed (non-fatal):', (err as any)?.message);
    }
  }

  const closerById = new Map<string, any>();
  if (closerIds.size > 0) {
    try {
      const all = unwrap(await base44.asServiceRole.entities.AppUser.list('-created_date', 1000));
      for (const u of all) {
        if (u?.id && closerIds.has(String(u.id))) closerById.set(String(u.id), u);
      }
    } catch (err) {
      // LB-180: legacy User IDs and phantom platform IDs won't resolve here.
      // closer_name will fall back to null and the UI renders "—".
      console.error('[list-my-invoices] AppUser lookup failed (non-fatal):', (err as any)?.message);
    }
  }

  const todayMs = Date.now();

  // Build rows.
  const rows = invoices.map((inv) => {
    const client = clientById.get(String(inv.client_id || '')) || {};
    const closer = inv.closer_id ? closerById.get(String(inv.closer_id)) : null;

    const rawDescription = typeof inv.description === 'string' ? inv.description.trim() : '';
    let productLabel: string | null = null;
    if (rawDescription) {
      productLabel = rawDescription;
    } else if (client.package && client.package !== 'none') {
      productLabel = titleize(String(client.package));
    }

    const bucket = bucketize(inv, todayMs);
    const issuedDate = inv.issue_date || inv.created_date || null;
    const saleAmount = Number(inv.total_amount ?? inv.amount ?? 0);

    return {
      // PR — extra raw Invoice fields surfaced for callers like Invoices.jsx
      // that render invoice_type / amount alongside the bucketed view.
      // MyInvoices.jsx reads invoice_id / sale_amount as before — additive.
      id:               String(inv.id || ''),
      invoice_id:       String(inv.id || ''),
      invoice_number:   inv.invoice_number || null,
      invoice_type:     inv.invoice_type || null,
      client_id:        String(inv.client_id || ''),
      client_name:      client.business_name || inv.client_name || '',
      contact_person:   client.contact_person || '',
      phone:            client.phone || '',
      product_label:    productLabel,
      sale_amount:      Number.isFinite(saleAmount) ? saleAmount : 0,
      amount:           Number.isFinite(saleAmount) ? saleAmount : 0,
      total_amount:     Number.isFinite(saleAmount) ? saleAmount : 0,
      status:           inv.status || null,
      status_bucket:    bucket,
      days_outstanding: computeDaysOutstanding(inv, bucket, todayMs),
      issued_date:      issuedDate,
      due_date:         inv.due_date || null,
      created_date:     inv.created_date || null,
      closer_id:        inv.closer_id || null,
      closer_name:      closer ? (closer.full_name || closer.email || null) : null,
    };
  });

  // Sort: overdue → unpaid → paid → cancelled, then by -issued_date within bucket.
  rows.sort((a, b) => {
    const r = (BUCKET_RANK[a.status_bucket] ?? 9) - (BUCKET_RANK[b.status_bucket] ?? 9);
    if (r !== 0) return r;
    const at = a.issued_date ? new Date(a.issued_date).getTime() : 0;
    const bt = b.issued_date ? new Date(b.issued_date).getTime() : 0;
    return bt - at;
  });

  // Counts + sums per bucket. Computed once on the server so the UI doesn't
  // re-aggregate. CPC / field_agent rows are already scoped to the actor — the
  // sums therefore reflect only their own invoices, not org totals.
  const counts = { unpaid: 0, overdue: 0, paid: 0, cancelled: 0, total: rows.length };
  const sums   = { unpaid: 0, overdue: 0, paid: 0, cancelled: 0 };
  for (const row of rows) {
    const b = row.status_bucket as 'unpaid' | 'overdue' | 'paid' | 'cancelled';
    if (b in counts) {
      counts[b]++;
      sums[b] += Number(row.sale_amount || 0);
    }
  }

  return Response.json({
    invoices: rows,
    counts,
    sums,
    viewer_role: actor.role,
    is_scoped_to_self: isScopedToSelf,
  });
});
