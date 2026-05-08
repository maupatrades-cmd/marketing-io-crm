import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// generate-monthly-retainer-invoices — Round 3 of recovery plan.
//
// Inputs (POST JSON):
//   { token, period?, dry_run? }
//   - period: YYYY-MM string. Defaults to the current month in SAST.
//   - dry_run: if true, returns the preview list without creating invoices.
//
// Output (success):
//   {
//     period:       'YYYY-MM',
//     dry_run:      boolean,
//     created:      [ { client_id, client_name, amount, invoice_id? } ],
//     skipped:      [ { client_id, reason } ],
//     total_amount: number,
//   }
//
// Replaces the manual monthly chore of creating retainer invoices for every
// active client with a contract. Designed to be:
//   - Operator-triggered: admin/owner clicks the button on /admin/invoices
//     (Round 4) — function call from the UI.
//   - Cron-triggerable later: same endpoint can be called by a scheduled job
//     once Base44's scheduling is configured. Function is internally
//     idempotent so re-runs in the same period are safe.
//
// Auth model:
//   - token (session token) MUST be supplied.
//   - Caller's role must be 'owner' or 'admin'.
//
// Idempotency:
//   - For each candidate client, skip if an Invoice already exists with
//     invoice_type='monthly_retainer' and issue_date starting with the
//     period (YYYY-MM). create-invoice writes issue_date=nowIso.slice(0,10),
//     so a previous run in the same period leaves a detectable fingerprint.
//
// What counts as "active for this period":
//   - Client.status === 'active'
//   - Has at least one Contract with status in {signed, active} and
//     monthly_retainer > 0. We pick the most recently created such Contract
//     to drive the amount and closer attribution.
// =============================================================================

const ACTIVE_CONTRACT_STATUSES = new Set(['signed', 'active']);

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

async function deriveActorFromSessionToken(base44: any, token: string) {
  if (!token) return null;
  let user: any = null;
  try {
    const list = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    user = unwrapList(list)[0] || null;
  } catch { /* try legacy */ }
  if (!user) {
    try {
      const list = await base44.asServiceRole.entities.User.filter({ session_token: token });
      user = unwrapList(list)[0] || null;
    } catch { return null; }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) return null;
  return {
    userId: String(user.id || ''),
    role:   String(user.role || 'client'),
    email:  String(user.email || ''),
  };
}

function currentPeriodInSAST(): string {
  // SAST is UTC+2 with no DST. We compute the YYYY-MM in SAST without
  // pulling Intl/Temporal — simpler arithmetic, no locale surprises.
  const nowMs = Date.now();
  const sastMs = nowMs + (2 * 60 * 60 * 1000);
  const d = new Date(sastMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function isValidPeriod(p: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
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

  const tokenRaw = String(body?.token ?? '').trim();
  const periodIn = String(body?.period ?? '').trim();
  const dryRun   = Boolean(body?.dry_run);

  const period = periodIn || currentPeriodInSAST();
  if (!isValidPeriod(period)) {
    return Response.json({ error: 'period_format', message: 'Use YYYY-MM' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  const actor = await deriveActorFromSessionToken(base44, tokenRaw);
  if (!actor) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // ---- Pull all active clients -------------------------------------------
  let activeClients: any[] = [];
  try {
    const clients = await base44.asServiceRole.entities.Client.filter(
      { status: 'active' }, '-created_date', 1000,
    );
    activeClients = unwrapList(clients);
  } catch (err) {
    console.error('[generate-monthly-retainer-invoices] Client lookup failed:', err);
    return Response.json({ error: 'client_lookup_failed' }, { status: 500 });
  }

  if (activeClients.length === 0) {
    return Response.json({
      period,
      dry_run:      dryRun,
      created:      [],
      skipped:      [],
      total_amount: 0,
      message:      'No active clients found',
    });
  }

  const created: any[] = [];
  const skipped: any[] = [];
  let totalAmount = 0;

  for (const client of activeClients) {
    const clientId   = String(client.id || '');
    const clientName = String(client.business_name || client.contact_person || '').trim();

    // ---- Find the active contract --------------------------------------
    let contract: any = null;
    try {
      const list = await base44.asServiceRole.entities.Contract.filter(
        { client_id: clientId }, '-created_date', 50,
      );
      const candidates = unwrapList(list).filter((c: any) =>
        ACTIVE_CONTRACT_STATUSES.has(String(c.status)) && Number(c.monthly_retainer || 0) > 0,
      );
      contract = candidates[0] || null;
    } catch (err) {
      console.error(`[generate-monthly-retainer-invoices] Contract lookup failed for client_id=${clientId}:`, err);
    }

    if (!contract) {
      skipped.push({ client_id: clientId, client_name: clientName, reason: 'no_active_contract_with_retainer' });
      continue;
    }

    // ---- Idempotency: existing retainer invoice for this period? -------
    try {
      const existing = await base44.asServiceRole.entities.Invoice.filter(
        { client_id: clientId, invoice_type: 'monthly_retainer' }, '-created_date', 50,
      );
      const existingList = unwrapList(existing);
      const sameMonth = existingList.find((inv: any) => String(inv.issue_date || '').startsWith(period));
      if (sameMonth) {
        skipped.push({
          client_id:   clientId,
          client_name: clientName,
          reason:      'already_invoiced_this_period',
          invoice_id:  sameMonth.id,
        });
        continue;
      }
    } catch (err) {
      console.error(`[generate-monthly-retainer-invoices] Invoice idempotency check failed for client_id=${clientId}:`, err);
      skipped.push({ client_id: clientId, client_name: clientName, reason: 'idempotency_check_failed' });
      continue;
    }

    const amount = Number(contract.monthly_retainer);
    totalAmount += amount;

    if (dryRun) {
      created.push({ client_id: clientId, client_name: clientName, amount, invoice_id: null, dry_run: true });
      continue;
    }

    // ---- Create the invoice via create-invoice -------------------------
    try {
      const result = await base44.functions.invoke('create-invoice', {
        client_id:    clientId,
        type:         'monthly_retainer',
        contract_id:  contract.id,
        deal_id:      contract.deal_id || '',
        line_items: [{
          product_id:   contract.package || '',
          product_name: contract.package
            ? String(contract.package).split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
            : 'Monthly retainer',
          description:  `Monthly retainer — ${period}`,
          amount,
          quantity:     1,
        }],
        // Default due date: end of period + 7 days. Caller can ignore and
        // change later via /admin/invoices.
        due_date:     new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        send_email:   true,
      });

      const payload = result?.data ?? result;
      const invoiceId = payload?.invoice_id || payload?.id || null;

      created.push({
        client_id:   clientId,
        client_name: clientName,
        amount,
        invoice_id:  invoiceId,
      });
    } catch (err) {
      console.error(`[generate-monthly-retainer-invoices] create-invoice failed for client_id=${clientId}:`, err);
      skipped.push({ client_id: clientId, client_name: clientName, reason: 'create_invoice_failed' });
      // Don't stop the batch — log and continue.
    }
  }

  console.log(
    `[generate-monthly-retainer-invoices] period=${period}, ` +
    `created=${created.length}, skipped=${skipped.length}, total=R${totalAmount}`
  );

  return Response.json({
    period,
    dry_run:      dryRun,
    created,
    skipped,
    total_amount: totalAmount,
  });
});
