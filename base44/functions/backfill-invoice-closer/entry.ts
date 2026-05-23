import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// backfill-invoice-closer — one-shot LB-097 cleanup.
//
// Inputs (POST JSON):
//   { token }                          // owner session token
//
// Output:
//   { success: true,
//     scanned, updated,
//     skipped_already_set, skipped_orphan,
//     errors: [{ invoice_id, error }] }
//
// Walks every Invoice row that lacks closer_id and tries to resolve one:
//   1. If invoice.deal_id is set     → use the Deal's closer_id
//   2. Else if invoice.client_id set → use the Client's signed_up_by_id
//   3. Else                          → leave null (orphan, per launch decision)
//
// Idempotent: rows that already have closer_id are skipped, so the function is
// safe to re-invoke. Owner-only. Manual post-deploy run after Invoice.jsonc
// is published.
// =============================================================================

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
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

  // Validate session via auth-me (canonical pattern from list-sales-opportunities).
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
    console.error('[backfill-invoice-closer] auth-me failed:', (err as any)?.message);
  }
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (actor.role !== 'owner') return Response.json({ error: 'forbidden' }, { status: 403 });

  // Pull every invoice. 5000-row cap matches list-my-sales / list-sales-opportunities.
  let invoices: any[] = [];
  try {
    invoices = unwrap(await base44.asServiceRole.entities.Invoice.list('-created_date', 5000));
  } catch (err) {
    return Response.json({ error: 'invoice_lookup_failed', detail: (err as any)?.message }, { status: 500 });
  }

  const dealCache: Map<string, any> = new Map();
  const clientCache: Map<string, any> = new Map();
  const errors: { invoice_id: string; error: string }[] = [];

  let scanned = 0;
  let updated = 0;
  let skippedAlreadySet = 0;
  let skippedOrphan = 0;

  for (const inv of invoices) {
    scanned++;

    if (inv.closer_id) {
      skippedAlreadySet++;
      continue;
    }

    let resolvedCloser: string | null = null;

    // Path 1 — Deal.closer_id.
    if (inv.deal_id) {
      let deal = dealCache.get(inv.deal_id);
      if (deal === undefined) {
        try {
          const list = await base44.asServiceRole.entities.Deal.filter({ id: inv.deal_id });
          deal = unwrap(list)[0] || null;
        } catch {
          deal = null;
        }
        dealCache.set(inv.deal_id, deal);
      }
      if (deal?.closer_id) resolvedCloser = String(deal.closer_id);
    }

    // Path 2 — Client.signed_up_by_id.
    if (!resolvedCloser && inv.client_id) {
      let client = clientCache.get(inv.client_id);
      if (client === undefined) {
        try {
          const list = await base44.asServiceRole.entities.Client.filter({ id: inv.client_id });
          client = unwrap(list)[0] || null;
        } catch {
          client = null;
        }
        clientCache.set(inv.client_id, client);
      }
      if (client?.signed_up_by_id) resolvedCloser = String(client.signed_up_by_id);
    }

    // Path 3 — orphan. Leave null, do not guess.
    if (!resolvedCloser) {
      skippedOrphan++;
      continue;
    }

    try {
      await base44.asServiceRole.entities.Invoice.update(inv.id, { closer_id: resolvedCloser });
      updated++;
    } catch (err) {
      errors.push({ invoice_id: String(inv.id), error: (err as any)?.message || 'update_failed' });
    }
  }

  console.log(
    `[backfill-invoice-closer] scanned=${scanned} updated=${updated} ` +
    `skipped_already_set=${skippedAlreadySet} skipped_orphan=${skippedOrphan} errors=${errors.length}`,
  );

  return Response.json({
    success: true,
    scanned,
    updated,
    skipped_already_set: skippedAlreadySet,
    skipped_orphan: skippedOrphan,
    errors,
  });
});
