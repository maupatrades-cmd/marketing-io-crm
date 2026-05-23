import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// contract-mark-signed — admin/owner action to flip a Contract to fully signed
// by Marketing iO.
//
// Semantics change vs the legacy frontend handler in Contracts.jsx:
//   Old: Contract.update({ status:'signed', signed_date, signed_by_client:true })
//   New: status='signed', signing_status='fully_signed', signed_by_mio=true,
//        marketing_io_signed_at=<now>, signed_date=<today>
//        — does NOT touch signed_by_client (admin click represents MIO side
//          only; the client-side flag is preserved as-is, true for paper
//          contracts uploaded via log-sale-on-behalf, false otherwise).
//
// Idempotent: rows already at status='signed' + signing_status='fully_signed'
// return { success:true, skipped:true } without re-writing timestamps.
//
// Activity log uses the canonical LB-108-safe field names (actor_id,
// event_summary, event_metadata, logged_by_name).
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

const today  = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token       = String(body?.token ?? '').trim();
  const contract_id = String(body?.contract_id ?? '').trim();

  if (!token)       return Response.json({ error: 'token_required' }, { status: 401 });
  if (!contract_id) return Response.json({ error: 'contract_id required' }, { status: 400 });

  // Session validation.
  let actor: { userId: string; role: string; name: string } | null = null;
  try {
    const authRes  = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      actor = {
        userId: String(authData.user.id || ''),
        role:   String(authData.user.role || 'client'),
        name:   String(authData.user.full_name || authData.user.email || 'Staff'),
      };
    }
  } catch (err) {
    console.error('[contract-mark-signed] auth-me failed:', (err as any)?.message);
  }
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Lookup contract.
  let contract: any = null;
  try {
    contract = unwrap(await base44.asServiceRole.entities.Contract.filter({ id: contract_id }))[0] || null;
  } catch (err) {
    console.error('[contract-mark-signed] Contract lookup failed:', err);
    return Response.json({ error: 'contract_lookup_failed' }, { status: 500 });
  }
  if (!contract) return Response.json({ error: 'contract_not_found' }, { status: 404 });

  // Idempotency: already fully signed → no-op.
  if (contract.status === 'signed' && contract.signing_status === 'fully_signed') {
    return Response.json({
      success:        true,
      skipped:        true,
      reason:         'already_signed',
      contract_id,
      status:         contract.status,
      signing_status: contract.signing_status,
      signed_by_mio:  Boolean(contract.signed_by_mio),
    });
  }

  // Write the MIO-side flags. signed_by_client is intentionally NOT modified.
  const updatePayload = {
    status:                 'signed',
    signing_status:         'fully_signed',
    signed_by_mio:          true,
    marketing_io_signed_at: nowIso(),
    signed_date:            today(),
  };

  try {
    await base44.asServiceRole.entities.Contract.update(contract_id, updatePayload);
  } catch (err) {
    console.error('[contract-mark-signed] Contract.update failed:', err);
    return Response.json({ error: 'update_failed', detail: (err as any)?.message }, { status: 500 });
  }

  // Activity log — non-fatal, canonical field names.
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      contract.client_id || '',
      client_name:    contract.client_name || '',
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'contract_marked_signed_by_mio',
      event_category: 'document',
      event_summary:  `${actor.name} marked contract ${contract_id} as signed by Marketing iO`,
      event_label:    'Contract signed by MIO',
      event_metadata: {
        contract_id,
        prior_status:         contract.status || null,
        prior_signing_status: contract.signing_status || null,
      },
      logged_by:      actor.userId,
      logged_by_name: actor.name,
    });
  } catch (err) {
    console.error('[contract-mark-signed] ClientActivityLog.create failed (non-fatal):', (err as any)?.message);
  }

  return Response.json({
    success:        true,
    skipped:        false,
    contract_id,
    status:         'signed',
    signing_status: 'fully_signed',
    signed_by_mio:  true,
  });
});
