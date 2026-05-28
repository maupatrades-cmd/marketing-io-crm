import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// list-client-contracts — data source for /client/contracts (client portal).
//
// Why this exists: the page called base44.entities.Contract.filter() directly
// from the client's browser session. Contract has an RLS read rule allowing
// client read where data.client_id matches the user's data.client_id, but
// mio_session_token isn't a valid Base44 JWT (LB-281), so user.data.client_id
// resolves undefined and the SDK call silently returned [].
//
// Fix follows the same pattern as list-contracts (admin/owner) and
// list-my-invoices: validate the session via auth-me, then read via
// asServiceRole filtered by the client's own client_id.
//
// Allowed role: client only. Staff use list-contracts instead.
// =============================================================================

const ALLOWED_ROLES = ['client'];

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
  let actor: { userId: string; role: string; email: string } | null = null;
  try {
    const authRes = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      actor = {
        userId: String(authData.user.id || ''),
        role:   String(authData.user.role || 'client'),
        email:  String(authData.user.email || '').toLowerCase(),
      };
    }
  } catch (err) {
    console.error('[list-client-contracts] auth-me failed:', (err as any)?.message);
  }
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });
  if (!actor.email) return Response.json({ error: 'no_email_on_session' }, { status: 400 });

  // Resolve the Client record for this portal user. Empty result is OK —
  // means the account exists but no business record yet, return empty list.
  let client: any = null;
  try {
    const list = unwrap(await base44.asServiceRole.entities.Client.filter({ email: actor.email }));
    client = list[0] || null;
  } catch (err) {
    console.error('[list-client-contracts] Client lookup failed:', (err as any)?.message);
    return Response.json({ error: 'client_lookup_failed' }, { status: 500 });
  }
  if (!client) {
    return Response.json({ success: true, contracts: [] });
  }

  // Pull contracts for this client (newest first, cap 50 — same as the old
  // direct-SDK call in ClientContracts.jsx).
  let contracts: any[] = [];
  try {
    contracts = unwrap(
      await base44.asServiceRole.entities.Contract.filter(
        { client_id: String(client.id) },
        '-created_date',
        50,
      ),
    );
  } catch (err) {
    console.error('[list-client-contracts] Contract lookup failed:', (err as any)?.message);
    return Response.json({ error: 'contract_lookup_failed' }, { status: 500 });
  }

  // Whitelist the response — only fields the portal page renders.
  const enriched = contracts.map((c) => ({
    id:                   String(c.id || ''),
    package:              c.package || null,
    add_on_name:          c.add_on_name || null,
    status:               c.status || null,
    signing_status:       c.signing_status || null,
    signed_date:          c.signed_date || null,
    signed_by_client:     Boolean(c.signed_by_client),
    setup_fee:            c.setup_fee ?? null,
    monthly_retainer:     c.monthly_retainer ?? null,
    document_url:         c.document_url || null,
    final_signed_pdf_url: c.final_signed_pdf_url || null,
    created_date:         c.created_date || null,
  }));

  return Response.json({ success: true, contracts: enriched });
});
