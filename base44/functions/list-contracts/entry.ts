import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// list-contracts — data source for /contracts (admin queue).
//
// Why this exists: the page was calling base44.entities.Contract.list()
// directly from the frontend. Contract has an RLS read rule that requires a
// real Base44 JWT, which the custom mio_session_token isn't (LB-281), so the
// SDK list silently returned zero rows for every staff/owner caller. This
// function is the documented pattern fix — validate the session via
// auth-me, then read via asServiceRole.
//
// Pattern reference: list-my-sales, list-my-invoices, list-sales-opportunities.
//
// Enrichment: one Client.list round-trip, reduced to a Map in memory, so the
// frontend can drop its separate Client/Deal state arrays. The previous
// Deal.list join was dead code — Contract.package is `required` in the
// schema and always populated, so deal.package was never the winning value.
// =============================================================================

const ALLOWED_ROLES = ['owner', 'admin'];

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

  // Session validation via canonical auth-me invoke.
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
    console.error('[list-contracts] auth-me failed:', (err as any)?.message);
  }
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Pull contracts.
  let contracts: any[] = [];
  try {
    contracts = unwrap(await base44.asServiceRole.entities.Contract.list('-created_date', 500));
  } catch (err) {
    console.error('[list-contracts] contract lookup failed:', err);
    return Response.json({ error: 'contract_lookup_failed' }, { status: 500 });
  }

  // Client enrichment — single pass, Map reduction.
  const clientIds = new Set<string>();
  for (const c of contracts) {
    if (c?.client_id) clientIds.add(String(c.client_id));
  }

  const clientById = new Map<string, any>();
  if (clientIds.size > 0) {
    try {
      const all = unwrap(await base44.asServiceRole.entities.Client.list('-created_date', 5000));
      for (const c of all) {
        if (c?.id && clientIds.has(String(c.id))) clientById.set(String(c.id), c);
      }
    } catch (err) {
      // Non-fatal — rows still render with whatever's on the Contract row itself.
      console.error('[list-contracts] client lookup failed (non-fatal):', (err as any)?.message);
    }
  }

  const enriched = contracts.map((c) => {
    const client = clientById.get(String(c.client_id || '')) || {};
    return {
      id:                        String(c.id || ''),
      client_id:                 String(c.client_id || ''),
      // Prefer the canonical Client.business_name; fall back to whatever was
      // snapshotted on the Contract row when it was created.
      client_name:               client.business_name || c.client_name || '',
      contact_person:            client.contact_person || '',
      phone:                     client.phone || '',
      package:                   c.package || null,
      add_on_name:               c.add_on_name || null,
      setup_fee:                 c.setup_fee ?? null,
      monthly_retainer:          c.monthly_retainer ?? null,
      status:                    c.status || null,
      signing_status:            c.signing_status || null,
      signed_by_client:          Boolean(c.signed_by_client),
      signed_by_mio:             Boolean(c.signed_by_mio),
      signed_date:               c.signed_date || null,
      client_signed_at:          c.client_signed_at || null,
      marketing_io_signed_at:    c.marketing_io_signed_at || null,
      signing_token:             c.signing_token || null,
      signing_link_expires_at:   c.signing_link_expires_at || null,
      document_url:              c.document_url || null,
      final_signed_pdf_url:      c.final_signed_pdf_url || null,
      notes:                     c.notes || null,
      created_date:              c.created_date || null,
    };
  });

  return Response.json({ contracts: enriched });
});
