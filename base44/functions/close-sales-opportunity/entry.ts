import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// close-sales-opportunity — server-side orchestrator for the "Sold 🎉" action
// on /sales-opportunities.
//
// The frontend SoldActionForm previously did 4 direct entity writes from the
// browser session (Client.update + 2× Invoice.create + Commission.create).
// Invoice and Commission are RLS-gated to owner/admin on create, so CPC and
// field-agent callers always got "permission denied for create operation on
// Invoice entity" (LB-281 write-side trap). This function routes all writes
// through asServiceRole, bypassing RLS, and recomputes the commission amount
// server-side so the client can't tamper with payroll inputs.
//
// Allowed roles (matches the /sales-opportunities RouteGuard):
//   owner / admin / cpc / field_agent
//
// Atomicity is best-effort sequential. On mid-sequence failure the function
// returns { error, step, partial_state: { ... } } honestly — no rollback.
// Same pattern as log-sale-on-behalf (PR #119) and add-product-to-client
// (PR #116).
// =============================================================================

// ── Commission config — INLINED from src/lib/commissionConfig.js ────────────
// Per the Base44 no-cross-import-from-lib constraint documented at the top
// of pdfGenerator.ts, this function cannot `import` from base44/lib/ or
// src/lib/. The constants below are a snapshot of the canonical source.
//
// TODO: move to SystemSettings entity so package rates can be edited without
// a code deploy. Until then, when commissionConfig.js changes the values
// here must be updated in lockstep.
// ─────────────────────────────────────────────────────────────────────────────

const PACKAGE_COMMISSIONS: Record<string, {
  setup_rate: number;
  retainer_rate: number;
  retainer_term_months: number;
  retainer_milestone_required: boolean;
  flat_amount: number | null;
}> = {
  ignite:         { setup_rate: 0.07, retainer_rate: 0.07,  retainer_term_months: 12, retainer_milestone_required: true,  flat_amount: null },
  accelerate:     { setup_rate: 0.07, retainer_rate: 0.07,  retainer_term_months: 12, retainer_milestone_required: true,  flat_amount: null },
  dominate:       { setup_rate: 0.07, retainer_rate: 0.075, retainer_term_months: 12, retainer_milestone_required: true,  flat_amount: null },
  street_pulse:   { setup_rate: 0,    retainer_rate: 0.12,  retainer_term_months: 1,  retainer_milestone_required: false, flat_amount: 444 },
  township_pulse: { setup_rate: 0,    retainer_rate: 0,     retainer_term_months: 0,  retainer_milestone_required: false, flat_amount: 130 },
};

const CPC_RATES   = { qualified_lead_fee: 87, closure_bonus: 250 };
const ADMIN_RATES = { per_contract_loaded: 25 };

const PACKAGE_LABELS: Record<string, string> = {
  ignite:         'Ignite',
  accelerate:     'Accelerate',
  dominate:       'Dominate',
  street_pulse:   'Street Pulse',
  township_pulse: 'Township Pulse',
  add_on:         'Add-On',
};

const ALLOWED_CALLER_ROLES   = ['owner', 'admin', 'cpc', 'field_agent'];
const ALLOWED_ASSIGNEE_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];
const PACKAGE_ENUM           = ['ignite', 'accelerate', 'dominate', 'street_pulse', 'township_pulse', 'add_on'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function errMsg(e: unknown): string {
  if (!e) return 'unknown_error';
  if (typeof e === 'string') return e;
  return (e as any)?.message || String(e);
}

function e400(reason: string, extra: Record<string, unknown> = {}) {
  return Response.json({ success: false, error: reason, ...extra }, { status: 400 });
}

async function validateActor(base44: any, token: string) {
  if (!token) return null;
  try {
    const authRes  = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      return {
        userId: String(authData.user.id || ''),
        role:   String(authData.user.role || 'client'),
        email:  String(authData.user.email || ''),
        name:   String(authData.user.full_name || authData.user.email || 'Staff'),
      };
    }
  } catch (err) {
    console.error('[close-sales-opportunity] auth-me failed:', errMsg(err));
  }
  return null;
}

// Server-side commission calc — mirrors src/components/sales/SoldActionForm.jsx
// calcCommission() exactly. Used to recompute the canonical commission_amount
// after the form submits, so a tampered signed_commission_amount can never
// inflate payroll.
function computeCommissionTotal(pkg: string, setupFee: number, monthly: number, role: string): number {
  if (role === 'cpc') {
    return CPC_RATES.qualified_lead_fee + CPC_RATES.closure_bonus;
  }
  if (role === 'admin') {
    return ADMIN_RATES.per_contract_loaded;
  }
  if (role !== 'field_agent' && role !== 'owner') {
    return 0;
  }
  const cfg = PACKAGE_COMMISSIONS[pkg];
  if (!cfg) return 0;                            // 'add_on' or any other → 0
  if (cfg.flat_amount !== null && cfg.flat_amount > 0) {
    return cfg.flat_amount;                      // Street / Township Pulse
  }
  const commSetup   = +(setupFee * cfg.setup_rate).toFixed(2);
  const commMonthly = +(monthly  * cfg.retainer_rate).toFixed(2);
  return +(commSetup + commMonthly * cfg.retainer_term_months).toFixed(2);
}

function commissionTypeFor(role: string): string {
  if (role === 'cpc')   return 'cpc_closure_bonus';
  if (role === 'admin') return 'admin_contract_load';
  return 'setup_commission';
}

const today  = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    token,
    client_id,
    assigned_id,
    package: pkg,
    setup_fee,
    monthly,
    debit_date,
    notes,
    signed_commission_amount,
  } = body || {};

  // ── STEP 1 — session + role gate ───────────────────────────────────────
  const actor = await validateActor(base44, String(token ?? '').trim());
  if (!actor) return Response.json({ success: false, error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_CALLER_ROLES.includes(actor.role)) {
    return Response.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  // ── STEP 2 — input validation ──────────────────────────────────────────
  if (!client_id)   return e400('client_id required');
  if (!assigned_id) return e400('assigned_id required');
  if (!PACKAGE_ENUM.includes(String(pkg))) return e400('invalid_package');
  const setupFeeNum = Number(setup_fee);
  const monthlyNum  = Number(monthly);
  if (!Number.isFinite(setupFeeNum) || setupFeeNum < 0) return e400('invalid_setup_fee');
  if (!Number.isFinite(monthlyNum)  || monthlyNum  < 0) return e400('invalid_monthly');
  if (debit_date !== '1st' && debit_date !== '15th')    return e400('invalid_debit_date');

  // notes: truncate to 1000 chars rather than reject — optional field.
  const cleanNotes = notes ? String(notes).slice(0, 1000) : '';

  // ── STEP 3 — Client lookup ─────────────────────────────────────────────
  let client: any = null;
  try {
    client = unwrap(await base44.asServiceRole.entities.Client.filter({ id: String(client_id) }))[0] || null;
  } catch (err) {
    console.error('[close-sales-opportunity] Client.filter failed:', errMsg(err));
    return Response.json({ success: false, error: 'client_lookup_failed', detail: errMsg(err) }, { status: 500 });
  }
  if (!client) return Response.json({ success: false, error: 'client_not_found' }, { status: 404 });
  const clientName = String(client.business_name || '');

  // ── STEP 4 — Assignee lookup + role validation ─────────────────────────
  let assignee: any = null;
  try {
    assignee = unwrap(await base44.asServiceRole.entities.AppUser.filter({ id: String(assigned_id) }))[0] || null;
  } catch (err) {
    console.error('[close-sales-opportunity] AppUser.filter failed:', errMsg(err));
    return Response.json({ success: false, error: 'assignee_lookup_failed', detail: errMsg(err) }, { status: 500 });
  }
  if (!assignee) return e400('assigned_id_not_found');
  const assigneeRole = String(assignee.role || '');
  if (!ALLOWED_ASSIGNEE_ROLES.includes(assigneeRole)) {
    return e400('assigned_role_invalid', { detail: `role=${assigneeRole} not in ${ALLOWED_ASSIGNEE_ROLES.join('|')}` });
  }
  const assigneeName = String(assignee.full_name || assignee.email || 'Staff');

  // ── STEP 5 — Recompute commission server-side ──────────────────────────
  const serverCommissionTotal = computeCommissionTotal(String(pkg), setupFeeNum, monthlyNum, assigneeRole);
  if (
    typeof signed_commission_amount === 'number' &&
    Math.abs(signed_commission_amount - serverCommissionTotal) > 1
  ) {
    console.warn(
      `[close-sales-opportunity] commission mismatch — frontend=${signed_commission_amount} ` +
      `server=${serverCommissionTotal} client_id=${client_id} pkg=${pkg} role=${assigneeRole}`,
    );
  }

  const pkgLabel = PACKAGE_LABELS[String(pkg)] || String(pkg);
  const yyyymm   = today().slice(0, 7);
  const debitRun = `${yyyymm}-${debit_date === '1st' ? '01' : '15'}`;

  // ── STEP 6 — Client.update ─────────────────────────────────────────────
  try {
    await base44.asServiceRole.entities.Client.update(String(client.id), {
      lifecycle_stage: 'active',
      status:          'active',
      signed_up_by_id: String(assignee.id),
      ...(assigneeRole === 'field_agent' ? { assigned_field_agent: String(assignee.id) } : {}),
      ...(assigneeRole === 'cpc'         ? { assigned_cpc:         String(assignee.id) } : {}),
    });
  } catch (err) {
    return Response.json({
      success: false, error: 'client_update_failed', step: 1, detail: errMsg(err),
    }, { status: 500 });
  }

  // ── STEP 7 — Setup invoice (conditional) ───────────────────────────────
  let setupInvoiceId: string | null = null;
  if (setupFeeNum > 0) {
    try {
      const inv = await base44.asServiceRole.entities.Invoice.create({
        client_id:    String(client.id),
        client_name:  clientName,
        invoice_type: 'setup_fee',
        description:  `${pkgLabel} – Setup Fee`,
        amount:       setupFeeNum,
        total_amount: setupFeeNum,
        status:       'draft',
        issue_date:   today(),
        debit_run_date: debitRun,
        closer_id:    String(assignee.id),
        ...(assigneeRole === 'field_agent'
          ? { assigned_field_agent_id: String(assignee.id), assigned_field_agent_name: assigneeName }
          : {}),
        ...(assigneeRole === 'cpc'
          ? { assigned_cpc_id: String(assignee.id), assigned_cpc_name: assigneeName }
          : {}),
      });
      setupInvoiceId = String(inv?.id || '') || null;
      // Fire "your invoice is ready" email (non-fatal). create-invoice's
      // built-in send_email path isn't available here because we write
      // Invoice rows directly (SoldActionForm needs assigned_field_agent_id
      // / assigned_cpc_id fields which create-invoice's API doesn't accept).
      if (setupInvoiceId) {
        base44.asServiceRole.functions.invoke('send-invoice-issued-email', {
          invoice_id: setupInvoiceId,
        }).catch((emailErr: any) => {
          console.error('[close-sales-opportunity] setup invoice email failed (non-fatal):', emailErr?.message);
        });
      }
    } catch (err) {
      return Response.json({
        success: false, error: 'invoice_setup_create_failed', step: 2, detail: errMsg(err),
        partial_state: { client_id: String(client.id) },
      }, { status: 500 });
    }
  }

  // ── STEP 8 — Monthly invoice (conditional) ─────────────────────────────
  let monthlyInvoiceId: string | null = null;
  if (monthlyNum > 0) {
    try {
      const inv = await base44.asServiceRole.entities.Invoice.create({
        client_id:    String(client.id),
        client_name:  clientName,
        invoice_type: 'monthly_retainer',
        description:  `${pkgLabel} – Monthly Retainer`,
        amount:       monthlyNum,
        total_amount: monthlyNum,
        status:       'draft',
        issue_date:   today(),
        closer_id:    String(assignee.id),
        ...(assigneeRole === 'field_agent'
          ? { assigned_field_agent_id: String(assignee.id), assigned_field_agent_name: assigneeName }
          : {}),
        ...(assigneeRole === 'cpc'
          ? { assigned_cpc_id: String(assignee.id), assigned_cpc_name: assigneeName }
          : {}),
      });
      monthlyInvoiceId = String(inv?.id || '') || null;
      // Email — same non-fatal pattern as the setup invoice above.
      if (monthlyInvoiceId) {
        base44.asServiceRole.functions.invoke('send-invoice-issued-email', {
          invoice_id: monthlyInvoiceId,
        }).catch((emailErr: any) => {
          console.error('[close-sales-opportunity] monthly invoice email failed (non-fatal):', emailErr?.message);
        });
      }
    } catch (err) {
      return Response.json({
        success: false, error: 'invoice_monthly_create_failed', step: 3, detail: errMsg(err),
        partial_state: {
          client_id:        String(client.id),
          setup_invoice_id: setupInvoiceId,
        },
      }, { status: 500 });
    }
  }

  // ── STEP 9 — Commission row (conditional on server-recomputed total) ──
  let commissionId: string | null = null;
  if (serverCommissionTotal > 0) {
    const commType = commissionTypeFor(assigneeRole);
    try {
      const row = await base44.asServiceRole.entities.Commission.create({
        staff_id:              String(assignee.id),
        staff_name:            assigneeName,
        staff_role:            assigneeRole,
        commission_type:       commType,
        client_id:             String(client.id),
        client_name:           clientName,
        package_or_addon:      pkgLabel,
        base_amount:           setupFeeNum || monthlyNum,
        commission_amount:     serverCommissionTotal,
        qualifying_event:      'deal_closed_won',
        qualifying_event_date: today(),
        status:                'pending',
      });
      commissionId = String(row?.id || '') || null;
    } catch (err) {
      return Response.json({
        success: false, error: 'commission_create_failed', step: 4, detail: errMsg(err),
        partial_state: {
          client_id:          String(client.id),
          setup_invoice_id:   setupInvoiceId,
          monthly_invoice_id: monthlyInvoiceId,
        },
      }, { status: 500 });
    }
  }

  // ── STEP 10 — Activity log (non-fatal try/catch) ───────────────────────
  const warnings: string[] = [];
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      String(client.id),
      client_name:    clientName,
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'sales_opportunity_closed',
      event_category: 'invoice',
      event_summary:  `${actor.name} closed ${pkgLabel} deal for ${clientName} — assigned to ${assigneeName} (${assigneeRole})`,
      event_label:    'Sales opportunity closed',
      event_metadata: {
        package:               String(pkg),
        package_label:         pkgLabel,
        setup_fee:             setupFeeNum,
        monthly_retainer:      monthlyNum,
        debit_date,
        assignee_id:           String(assignee.id),
        assignee_name:         assigneeName,
        assignee_role:         assigneeRole,
        commission_amount:     serverCommissionTotal,
        commission_type:       serverCommissionTotal > 0 ? commissionTypeFor(assigneeRole) : null,
        setup_invoice_id:      setupInvoiceId,
        monthly_invoice_id:    monthlyInvoiceId,
        commission_id:         commissionId,
        notes:                 cleanNotes || null,
      },
      logged_by:      actor.userId,
      logged_by_name: actor.name,
    });
  } catch (err) {
    console.error('[close-sales-opportunity] ClientActivityLog.create failed (non-fatal):', errMsg(err));
    warnings.push(`activity_log_failed: ${errMsg(err)}`);
  }

  return Response.json({
    success:            true,
    client_id:          String(client.id),
    setup_invoice_id:   setupInvoiceId,
    monthly_invoice_id: monthlyInvoiceId,
    commission_id:      commissionId,
    commission_amount:  serverCommissionTotal,
    ...(warnings.length ? { warnings } : {}),
  });
});
