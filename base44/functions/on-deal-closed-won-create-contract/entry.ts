import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// on-deal-closed-won-create-contract — Round 3 of recovery plan.
//
// Inputs (POST JSON):
//   { deal_id }
//
// Output:
//   { success: true, contract_id }   — new Contract created
//   { skipped: true, reason }        — idempotent skip
//
// Closes the first manual handoff in the revenue spine: when a Deal moves
// to stage='closed_won', a Contract should exist immediately so admin can
// send it for signature. Until this function existed, a Contract was
// created only via LogSale.jsx's one-shot path (which couples
// Deal+Contract+Deliverables into a single UI action) — meaning any deal
// closed via Deals.jsx or via direct entity update had no Contract until
// admin manually created one.
//
// This function is invoked from on-deal-won-initiate-onboarding (which
// already fires on Deal stage update to closed_won), so the trigger is
// the same as the onboarding initiation. No separate webhook needed.
//
// Idempotency: skips if a Contract already exists for the deal_id. Safe
// to invoke multiple times. New ContractStatus is 'draft' — admin still
// needs to send it (Contract.status='sent') before it can be signed.
// =============================================================================

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'use POST' }, { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const dealId = String(body?.deal_id ?? '').trim();
  if (!dealId) {
    return Response.json({ error: 'deal_id required' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  // ---- Resolve deal -------------------------------------------------------
  let deal: any = null;
  try {
    const list = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    deal = unwrapList(list)[0] || null;
  } catch (err) {
    console.error('[on-deal-closed-won-create-contract] Deal lookup failed:', err);
    return Response.json({ error: 'deal_lookup_failed' }, { status: 500 });
  }
  if (!deal) {
    return Response.json({ error: 'deal_not_found' }, { status: 404 });
  }

  if (deal.stage !== 'closed_won') {
    console.log(
      `[on-deal-closed-won-create-contract] deal_id=${dealId} stage=${deal.stage} ` +
      `is not closed_won — skipping`
    );
    return Response.json({ skipped: true, reason: 'deal_not_closed_won' });
  }

  // ---- Idempotency: skip if Contract exists for this deal -----------------
  try {
    const existing = await base44.asServiceRole.entities.Contract.filter({ deal_id: dealId });
    const existingList = unwrapList(existing);
    if (existingList.length > 0) {
      console.log(
        `[on-deal-closed-won-create-contract] Contract already exists for deal_id=${dealId} ` +
        `(contract_id=${existingList[0].id}) — skipping`
      );
      return Response.json({
        skipped:     true,
        reason:      'contract_exists',
        contract_id: existingList[0].id,
      });
    }
  } catch (err) {
    console.error('[on-deal-closed-won-create-contract] Contract idempotency check failed:', err);
    // Non-fatal — proceed and let Base44's uniqueness reject if needed.
  }

  // ---- Resolve client (for client_name) -----------------------------------
  let clientName = '';
  if (deal.client_id) {
    try {
      const list = await base44.asServiceRole.entities.Client.filter({ id: deal.client_id });
      const client = unwrapList(list)[0];
      clientName = String(client?.business_name || client?.contact_person || '').trim();
    } catch { /* non-fatal */ }
  }

  // ---- Build Contract payload --------------------------------------------
  // Map Deal fields → Contract fields. The Contract enum 'package' overlaps
  // with the Deal enum (ignite, accelerate, dominate, street_pulse,
  // township_pulse, add_on). Anything else falls back to 'add_on'.
  const PACKAGE_ENUM = new Set([
    'ignite', 'accelerate', 'dominate', 'street_pulse', 'township_pulse', 'add_on',
  ]);
  const dealPackage = String(deal.package ?? '').trim();
  const contractPackage = PACKAGE_ENUM.has(dealPackage) ? dealPackage : 'add_on';

  const setupFee       = Number(deal.setup_fee ?? 0);
  const monthlyRetainer = Number(deal.monthly_retainer ?? 0);

  // Generate unique signing token for e-signature link
  const signingToken = crypto.randomUUID();

  const contractPayload: Record<string, unknown> = {
    client_id:        deal.client_id || '',
    client_name:      clientName,
    deal_id:          dealId,
    package:          contractPackage,
    setup_fee:        setupFee,
    monthly_retainer: monthlyRetainer,
    status:           'draft',
    auto_renews:      true,
    signed_by_client: false,
    signed_by_mio:    false,
    popia_signed:     false,
    signing_token:    signingToken,
    signing_status:   'not_sent',
    signing_link_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  if (deal.add_on_name) contractPayload.add_on_name = String(deal.add_on_name);
  if (deal.initial_term_months) contractPayload.initial_term_months = Number(deal.initial_term_months);

  // ---- Create Contract ---------------------------------------------------
  let contract: any;
  try {
    contract = await base44.asServiceRole.entities.Contract.create(contractPayload);
  } catch (err) {
    console.error('[on-deal-closed-won-create-contract] Contract.create failed:', err);
    return Response.json({ error: 'contract_create_failed' }, { status: 500 });
  }

  console.log(
    `[on-deal-closed-won-create-contract] Contract created — ` +
    `contract_id=${contract.id}, deal_id=${dealId}, package=${contractPackage}`
  );

  // ---- Notify admin/head — non-fatal -------------------------------------
  try {
    await base44.functions.invoke('notifyAdminAndHead', {
      subject: `Contract drafted for ${clientName || 'a new client'}`,
      message: `Deal ${dealId} closed-won. Contract drafted with status 'draft'. Review and send for signature.`,
      client_id: deal.client_id,
    });
  } catch (err) {
    console.error('[on-deal-closed-won-create-contract] notifyAdminAndHead failed (non-fatal):', err);
  }

  return Response.json({
    success:     true,
    contract_id: contract.id,
  });
});