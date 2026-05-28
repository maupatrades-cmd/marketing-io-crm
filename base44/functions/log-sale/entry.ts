import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// log-sale — server-side orchestrator for the /log-sale page.
//
// Why this exists: LogSale.jsx did ~8 direct entity writes from the browser
// session — Client.create (open), then Deal.create (RLS), 3× Commission, 1×
// Deal.update, 1× Contract.create, 1× Invoice.create, 1× ClientOnboarding,
// 2× Task, plus autoCreateDeliverables which writes Deliverable rows. Every
// RLS-protected create returned 403 (LB-281), and on the new-client path
// the Client row was already persisted before the Deal.create failed —
// leaving orphan Clients in the database.
//
// STEP 11.5 restores the autoCreateDeliverables behaviour from
// src/lib/fulfilmentAutomation.js (dropped in PR #128) so head_of_tech
// opens a populated queue for the new deal.
//
// This function bypasses all that by validating the session via auth-me and
// running every write via asServiceRole. Sequential best-effort matching
// log-sale-on-behalf (PR #119) and close-sales-opportunity (PR #124).
//
// Orphan-client cleanup: if Deal.create fails after a new-client Client.create
// succeeded, the function deletes the orphan client row before returning the
// error.
//
// Commission rates are recomputed server-side from the canonical config (same
// approach as close-sales-opportunity) — also fixes LB-041 (LogSale used to
// hardcode staff_role='field_agent' on commissions regardless of actual role).
//
// Allowed callers: owner / admin / cpc / field_agent (matches LogSale.jsx
// access today — anyone authenticated could reach the page).
// =============================================================================

const ALLOWED_CALLER_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];
const PACKAGE_ENUM         = ['ignite', 'accelerate', 'dominate', 'street_pulse', 'township_pulse', 'add_on'];

// ── Commission config — INLINED from src/lib/commissionConfig.js ────────────
// Same snapshot as close-sales-opportunity. Base44 can't import from
// base44/lib/ at runtime, so the constants are duplicated here.
// TODO: move to SystemSettings entity so rate changes don't need a deploy.

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

// Maps LogSale add-on values → FulfilmentTemplate codes. Mirrors
// ADD_ON_TO_TEMPLATE_CODE in src/lib/fulfilmentAutomation.js — most are 1:1,
// the exceptions below need explicit remapping.
const ADD_ON_TO_TEMPLATE_CODE: Record<string, string> = {
  google_business_profile:      'gbp_optimisation',
  staff_training_workshop:      'workshops',
  crm_training_setup:           'crm_training',
  print_signage:                'print_signage_coordination',
  domain_hosting_email:         'domain_hosting_reselling',
  business_plan_website_bundle: 'plan_website_bundle',
};

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

const today  = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function plusMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

// FulfilmentTemplate.setup_deliverables / recurring_deliverables is a JSON
// string array. Defensively handle three shapes: actual array, JSON-encoded
// array, or newline-delimited fallback for templates seeded pre-schema.
function parseTitles(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return s.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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
    console.error('[log-sale] auth-me failed:', errMsg(err));
  }
  return null;
}

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  try {

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    token,
    // Client — either existing or new
    client_id,             // optional — if set, we use this Client
    new_client_data,       // optional — { business_name, contact_person, phone, email, address }
    // Deal / pricing
    package: pkg,
    add_on_name,
    setup_fee,
    monthly_fee,
    term_months,
    start_date,
    notes,
    // Attribution
    closer_id,
    cpc_id,                // optional — separate CPC qualifying the lead
  } = body || {};

  // ── STEP 1 — session + role gate ───────────────────────────────────────
  const actor = await validateActor(base44, String(token ?? '').trim());
  if (!actor) return Response.json({ success: false, error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_CALLER_ROLES.includes(actor.role)) {
    return Response.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  // ── STEP 2 — input validation ──────────────────────────────────────────
  if (!client_id && !new_client_data) return e400('client_id or new_client_data required');
  if (client_id && new_client_data)   return e400('pick existing OR new client, not both');
  if (!PACKAGE_ENUM.includes(String(pkg))) return e400('invalid_package');
  if (pkg === 'add_on' && !add_on_name)    return e400('add_on_name required when package=add_on');
  const setupNum = Number(setup_fee);
  const monthlyNum = Number(monthly_fee);
  const termNum  = Number(term_months || 12);
  if (!Number.isFinite(setupNum)   || setupNum   < 0) return e400('invalid_setup_fee');
  if (!Number.isFinite(monthlyNum) || monthlyNum < 0) return e400('invalid_monthly_fee');
  if (!Number.isFinite(termNum)    || termNum    < 1) return e400('invalid_term_months');
  if (!closer_id) return e400('closer_id required');
  const cleanNotes = notes ? String(notes).slice(0, 1000) : '';
  const startDateStr = String(start_date || plusDays(7));

  // ── STEP 3 — Closer lookup (must be a real AppUser) ────────────────────
  // LB-180: the frontend may pass a legacy User.id that doesn't match any
  // AppUser row. Strategy:
  //   (a) try AppUser.filter({id}) — happy path
  //   (b) if empty AND closer_id === actor.userId, trust auth-me's identity
  //   (c) last resort: scan AppUser.list and match by id OR actor.email
  // None of these should 500 — empty result → 400 closer_not_found.
  let closer: any = null;
  try {
    closer = unwrap(await base44.asServiceRole.entities.AppUser.filter({ id: String(closer_id) }))[0] || null;
  } catch (err) {
    console.warn('[log-sale] AppUser.filter({id}) threw — falling back:', errMsg(err));
  }
  if (!closer && String(closer_id) === actor.userId) {
    closer = { id: actor.userId, full_name: actor.name, email: actor.email, role: actor.role };
  }
  if (!closer) {
    try {
      const all = unwrap(await base44.asServiceRole.entities.AppUser.list('-created_date', 1000));
      const wantEmail = (actor.email || '').toLowerCase();
      closer = all.find((u: any) =>
        String(u.id) === String(closer_id) ||
        (wantEmail && String(u.email || '').toLowerCase() === wantEmail),
      ) || null;
    } catch (err) {
      console.error('[log-sale] AppUser.list fallback failed:', errMsg(err));
    }
  }
  if (!closer) return e400('closer_not_found', { closer_id: String(closer_id) });
  const closerRole = String(closer.role || 'field_agent');
  const closerName = String(closer.full_name || closer.email || 'Staff');

  // ── STEP 4 — CPC lookup (optional) ─────────────────────────────────────
  let cpc: any = null;
  if (cpc_id) {
    try {
      cpc = unwrap(await base44.asServiceRole.entities.AppUser.filter({ id: String(cpc_id) }))[0] || null;
    } catch { /* non-fatal */ }
  }
  const cpcName = cpc ? String(cpc.full_name || cpc.email || 'CPC') : '';

  // ── STEP 5 — Client lookup OR create ───────────────────────────────────
  // Existing-client path: same resilience pattern as Step 3. If Client.filter
  // by id throws or returns empty, fall back to scanning Client.list before
  // surfacing client_not_found. Empty result → 400, never 500.
  let client: any = null;
  let createdNewClient = false;
  if (client_id) {
    try {
      client = unwrap(await base44.asServiceRole.entities.Client.filter({ id: String(client_id) }))[0] || null;
    } catch (err) {
      console.warn('[log-sale] Client.filter({id}) threw — falling back:', errMsg(err));
    }
    if (!client) {
      try {
        const all = unwrap(await base44.asServiceRole.entities.Client.list('-created_date', 5000));
        client = all.find((c: any) => String(c.id) === String(client_id)) || null;
      } catch (err) {
        console.error('[log-sale] Client.list fallback failed:', errMsg(err));
      }
    }
    if (!client) return e400('client_not_found', { client_id: String(client_id) });
  } else {
    const nc = new_client_data || {};
    if (!nc.business_name) return e400('new_client_data.business_name required');
    try {
      client = await base44.asServiceRole.entities.Client.create({
        business_name:   String(nc.business_name).trim(),
        contact_person:  String(nc.contact_person || '').trim(),
        phone:           String(nc.phone || '').trim(),
        email:           String(nc.email || '').trim().toLowerCase(),
        address:         String(nc.address || '').trim(),
        status:          'onboarding',
        lifecycle_stage: 'active',
        signed_up_by_id: closer.id,
      });
      createdNewClient = true;
    } catch (err) {
      return Response.json({ success: false, error: 'client_create_failed', step: 5, detail: errMsg(err) }, { status: 500 });
    }
  }
  const clientId   = String(client.id);
  const clientName = String(client.business_name || '');

  // Helper: cleanup orphan client if a downstream step fails.
  const rollbackOrphanClient = async () => {
    if (!createdNewClient) return;
    try {
      await base44.asServiceRole.entities.Client.delete(clientId);
      console.warn(`[log-sale] rolled back orphan client ${clientId}`);
    } catch (err) {
      console.error(`[log-sale] orphan client ${clientId} cleanup failed — manual cleanup required:`, errMsg(err));
    }
  };

  // ── STEP 6 — Deal.create ───────────────────────────────────────────────
  const dealPackage = pkg === 'add_on' ? 'none' : String(pkg);
  let deal: any;
  try {
    deal = await base44.asServiceRole.entities.Deal.create({
      client_id:        clientId,
      client_name:      clientName,
      deal_type:        pkg === 'add_on' ? 'add_on' : 'core_package',
      package:          dealPackage,
      add_on_name:      pkg === 'add_on' ? String(add_on_name) : '',
      stage:            'closed_won',
      setup_fee:        setupNum,
      monthly_retainer: monthlyNum,
      probability:      100,
      closer_id:        closer.id,
      closer_name:      closerName,
      notes:            cleanNotes,
    });
  } catch (err) {
    await rollbackOrphanClient();
    return Response.json({
      success: false, error: 'deal_create_failed', step: 6, detail: errMsg(err),
    }, { status: 500 });
  }
  const dealId = String(deal?.id || '');

  // ── STEP 7 — Commissions ───────────────────────────────────────────────
  const d           = today();
  const payrollMonth = d.slice(0, 7);
  const pkgConfig   = PACKAGE_COMMISSIONS[String(pkg)] || null;
  const pkgLabel    = pkg === 'add_on' ? String(add_on_name) : String(pkg);
  const commissions: any[] = [];

  // Commission.staff_role enum = ['field_agent','cpc','admin','founder','other'].
  // AppUser.role can be 'owner' — map it to 'founder' (closest semantic) so
  // bulkCreate doesn't silently reject the row.
  const commissionRole = closerRole === 'owner' ? 'founder' : closerRole;

  // Closer's primary commission lines
  if (closerRole === 'cpc') {
    // CPC closer: flat lead fee + closure bonus
    commissions.push({
      staff_id:              closer.id,
      staff_name:            closerName,
      staff_role:            commissionRole,
      commission_type:       'cpc_closure_bonus',
      deal_id:               dealId,
      client_id:             clientId,
      client_name:           clientName,
      package_or_addon:      pkgLabel,
      base_amount:           0,
      rate_percent:          100,
      commission_amount:     CPC_RATES.qualified_lead_fee + CPC_RATES.closure_bonus,
      qualifying_event:      'CPC closed sale',
      qualifying_event_date: d,
      payroll_month:         payrollMonth,
      status:                'pending',
    });
  } else if (closerRole === 'admin') {
    commissions.push({
      staff_id:              closer.id,
      staff_name:            closerName,
      staff_role:            commissionRole,
      commission_type:       'admin_contract_load',
      deal_id:               dealId,
      client_id:             clientId,
      client_name:           clientName,
      package_or_addon:      pkgLabel,
      base_amount:           0,
      rate_percent:          100,
      commission_amount:     ADMIN_RATES.per_contract_loaded,
      qualifying_event:      'Admin loaded contract',
      qualifying_event_date: d,
      payroll_month:         payrollMonth,
      status:                'pending',
    });
  } else if (pkgConfig) {
    // field_agent / owner — setup % + retainer % × term, or flat for pulse packages
    if (pkgConfig.flat_amount !== null && pkgConfig.flat_amount > 0) {
      commissions.push({
        staff_id:              closer.id,
        staff_name:            closerName,
        staff_role:            commissionRole,
        commission_type:       'setup_commission',
        deal_id:               dealId,
        client_id:             clientId,
        client_name:           clientName,
        package_or_addon:      pkgLabel,
        base_amount:           setupNum || monthlyNum,
        rate_percent:          0,
        commission_amount:     pkgConfig.flat_amount,
        qualifying_event:      'Closed sale — flat commission',
        qualifying_event_date: d,
        payroll_month:         payrollMonth,
        status:                'pending',
      });
    } else {
      if (setupNum > 0 && pkgConfig.setup_rate > 0) {
        commissions.push({
          staff_id:              closer.id,
          staff_name:            closerName,
          staff_role:            commissionRole,
          commission_type:       'setup_commission',
          deal_id:               dealId,
          client_id:             clientId,
          client_name:           clientName,
          package_or_addon:      pkgLabel,
          base_amount:           setupNum,
          rate_percent:          pkgConfig.setup_rate * 100,
          commission_amount:     Math.round(setupNum * pkgConfig.setup_rate),
          qualifying_event:      'Closed sale — setup fee commission',
          qualifying_event_date: d,
          payroll_month:         payrollMonth,
          status:                'pending',
        });
      }
      if (monthlyNum > 0 && pkgConfig.retainer_rate > 0) {
        commissions.push({
          staff_id:              closer.id,
          staff_name:            closerName,
          staff_role:            commissionRole,
          commission_type:       'retainer_commission',
          deal_id:               dealId,
          client_id:             clientId,
          client_name:           clientName,
          package_or_addon:      pkgLabel,
          base_amount:           monthlyNum,
          rate_percent:          pkgConfig.retainer_rate * 100,
          commission_amount:     Math.round(monthlyNum * pkgConfig.retainer_rate * pkgConfig.retainer_term_months),
          qualifying_event:      'Closed sale — retainer commission',
          qualifying_event_date: d,
          payroll_month:         payrollMonth,
          status:                'pending',
        });
      }
    }
  }

  // Separate CPC closure bonus (when the CPC isn't the closer)
  if (cpc && String(cpc.id) !== String(closer.id)) {
    commissions.push({
      staff_id:              cpc.id,
      staff_name:            cpcName,
      staff_role:            'cpc',
      commission_type:       'cpc_closure_bonus',
      deal_id:               dealId,
      client_id:             clientId,
      client_name:           clientName,
      package_or_addon:      pkgLabel,
      base_amount:           CPC_RATES.closure_bonus,
      rate_percent:          100,
      commission_amount:     CPC_RATES.closure_bonus,
      qualifying_event:      'CPC qualified lead — closure bonus',
      qualifying_event_date: d,
      payroll_month:         payrollMonth,
      status:                'pending',
    });
  }

  if (commissions.length > 0) {
    try {
      await base44.asServiceRole.entities.Commission.bulkCreate(commissions);
      await base44.asServiceRole.entities.Deal.update(dealId, { commission_generated: true });
    } catch (err) {
      // Soft failure — deal already exists. Surface as warning.
      console.error(`[log-sale] commission write failed for deal ${dealId}:`, errMsg(err));
    }
  }

  // ── STEP 8 — Contract (draft) ──────────────────────────────────────────
  const contractPackage = pkg === 'add_on' ? 'add_on' : String(pkg);
  let contractId: string | null = null;
  try {
    const contract = await base44.asServiceRole.entities.Contract.create({
      client_id:           clientId,
      client_name:         clientName,
      deal_id:             dealId,
      package:             contractPackage,
      add_on_name:         pkg === 'add_on' ? String(add_on_name) : '',
      setup_fee:           setupNum,
      monthly_retainer:    monthlyNum,
      initial_term_months: termNum,
      contract_start_date: startDateStr,
      contract_end_date:   plusMonths(startDateStr, termNum),
      status:              'draft',
      auto_renews:         true,
      signing_token:       crypto.randomUUID(),
      signing_link_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    contractId = String(contract?.id || '');
  } catch (err) {
    console.error(`[log-sale] contract create failed for deal ${dealId}:`, errMsg(err));
  }

  // ── STEP 9 — Invoice (setup fee, with email fire) ──────────────────────
  let invoiceId: string | null = null;
  let invoiceNumber: string | null = null;
  if (setupNum > 0) {
    try {
      // Route through create-invoice so it fires send-invoice-issued-email
      // automatically (locked email-firing decision from the post-PR-#125
      // diagnostic).
      const invRes = await base44.asServiceRole.functions.invoke('create-invoice', {
        client_id:    clientId,
        type:         'setup_fee',
        closer_id:    closer.id,
        lead_source_user_id: cpc?.id || null,
        send_email:   true,
        line_items: [{
          product_id:   String(pkg),
          product_name: pkgLabel,
          description:  `Setup fee — ${pkgLabel.replace(/_/g, ' ')}`,
          amount:       setupNum,
          quantity:     1,
        }],
        due_date:     plusDays(7),
        deal_id:      dealId,
        contract_id:  contractId,
      });
      const invData = invRes?.data ?? invRes;
      invoiceId     = String(invData?.invoice_id || '') || null;
      invoiceNumber = String(invData?.invoice_number || '') || null;
    } catch (err) {
      console.error(`[log-sale] invoice create failed for deal ${dealId}:`, errMsg(err));
    }
  }

  // ── STEP 9.5 — In-app client notification ──────────────────────────────
  // Ports the notifyClient() call from the original LogSale.jsx (dropped in
  // PR #128 as "duplicative with the invoice email"). The email and in-app
  // push serve different surfaces — the portal Notifications bell needs the
  // ClientNotification row to light up. Soft-failure: missing row doesn't
  // break the deal.
  if (invoiceId) {
    try {
      const pkgHuman = pkgLabel.replace(/_/g, ' ');
      await base44.asServiceRole.entities.ClientNotification.create({
        client_id:           clientId,
        notification_type:   'invoice_issued',
        title:               `Setup invoice issued — R${setupNum.toLocaleString('en-ZA')}`,
        body:                `Invoice for your ${pkgHuman} package is ready. Click to view and pay.`,
        related_entity_type: 'Invoice',
        related_entity_id:   invoiceId,
        action_url:          '/client/invoices',
        is_read:             false,
      });
    } catch (err) {
      console.error(`[log-sale] ClientNotification create failed for deal ${dealId}:`, errMsg(err));
    }
  }

  // ── STEP 10 — ClientOnboarding ─────────────────────────────────────────
  // Find an admin/owner to assign onboarding to.
  let assignedAdminId   = closer.id;
  let assignedAdminName = closerName;
  try {
    const admins = unwrap(await base44.asServiceRole.entities.AppUser.filter({ role: 'admin' }));
    const admin = admins[0];
    if (admin) {
      assignedAdminId   = String(admin.id);
      assignedAdminName = String(admin.full_name || admin.email || 'Admin');
    }
  } catch { /* fall through to closer */ }

  try {
    await base44.asServiceRole.entities.ClientOnboarding.create({
      deal_id:              dealId,
      client_id:            clientId,
      client_name:          clientName,
      assigned_admin_id:    assignedAdminId,
      assigned_admin_name:  assignedAdminName,
      current_phase:        'phase1_contract_signed',
      overall_status:       'in_progress',
      p1_client_added_to_crm: true,
      deal_won_date:        d,
    });
  } catch (err) {
    console.error(`[log-sale] ClientOnboarding create failed for deal ${dealId}:`, errMsg(err));
  }

  // ── STEP 11 — Auto-tasks ───────────────────────────────────────────────
  try {
    const tasks: any[] = [
      {
        title:          `Begin onboarding for ${clientName}`,
        description:    `New sale logged. Package: ${pkgLabel.replace(/_/g, ' ')}. Start date: ${startDateStr}.`,
        client_id:      clientId,
        client_name:    clientName,
        deal_id:        dealId,
        assigned_to:    assignedAdminId,
        assigned_to_name: assignedAdminName,
        status:         'open',
        priority:       'high',
        due_date:       plusDays(1),
        auto_generated: true,
      },
    ];
    if (setupNum > 0) {
      tasks.push({
        title:          `Follow up on setup fee payment with ${clientName}`,
        description:    `Setup invoice of R${setupNum.toLocaleString('en-ZA')} was issued. Follow up if not paid within 5 days.`,
        client_id:      clientId,
        client_name:    clientName,
        deal_id:        dealId,
        assigned_to:    closer.id,
        assigned_to_name: closerName,
        status:         'open',
        priority:       'medium',
        due_date:       plusDays(5),
        auto_generated: true,
      });
    }
    await base44.asServiceRole.entities.Task.bulkCreate(tasks);
  } catch (err) {
    console.error(`[log-sale] Task bulkCreate failed for deal ${dealId}:`, errMsg(err));
  }

  // ── STEP 11.5 — Auto-provision Deliverables from FulfilmentTemplate ────
  // Ports autoCreateDeliverables() from src/lib/fulfilmentAutomation.js. The
  // old LogSale.jsx ran this after Deal.create so head_of_tech opened a
  // populated queue for the new client; the orchestrator dropped it in PR
  // #128, leaving deals with no provisioned work items.
  //
  // Core packages → `<package>_core_package` template code. Add-ons → the
  // add_on_name value (or the explicit remap in ADD_ON_TO_TEMPLATE_CODE).
  // Soft-failure throughout: no template, no parseable titles, or per-row
  // create errors all just log — the deal itself is already committed.
  const templateCode = pkg === 'add_on'
    ? (ADD_ON_TO_TEMPLATE_CODE[String(add_on_name)] || String(add_on_name))
    : `${String(pkg)}_core_package`;

  let deliverablesCreated = 0;
  let templateUsed: string | null = null;
  try {
    const template = unwrap(
      await base44.asServiceRole.entities.FulfilmentTemplate.filter({ code: templateCode }),
    )[0] || null;
    if (!template) {
      console.warn(`[log-sale] no FulfilmentTemplate for code=${templateCode} — deliverables skipped`);
    } else {
      templateUsed = String(template.code);
      const setupTitles     = parseTitles(template.setup_deliverables);
      const recurringTitles = parseTitles(template.recurring_deliverables);
      const slaDays = Number.isFinite(Number(template.soft_sla_days)) && Number(template.soft_sla_days) > 0
        ? Number(template.soft_sla_days) : 14;
      const setupDue  = plusDays(slaDays);
      const ownerRole = String(template.internal_owner_role || 'head_of_tech');

      for (const title of setupTitles) {
        try {
          await base44.asServiceRole.entities.Deliverable.create({
            client_id:   clientId,
            client_name: clientName,
            deal_id:     dealId,
            title,
            phase:       'setup',
            product:     templateUsed,
            owner_role:  ownerRole,
            status:      'not_started',
            due_date:    setupDue,
            notes:       `Auto-created from FulfilmentTemplate ${templateUsed}`,
          });
          deliverablesCreated += 1;
        } catch (err) {
          console.error(`[log-sale] Deliverable.create (setup) "${title}" failed:`, errMsg(err));
        }
      }

      if (recurringTitles.length > 0) {
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        const monthYear    = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        const recurringDue = next.toISOString().slice(0, 10);
        for (const title of recurringTitles) {
          try {
            await base44.asServiceRole.entities.Deliverable.create({
              client_id:   clientId,
              client_name: clientName,
              deal_id:     dealId,
              title,
              phase:       'monthly_recurring',
              product:     templateUsed,
              owner_role:  ownerRole,
              status:      'not_started',
              month_year:  monthYear,
              due_date:    recurringDue,
              notes:       `Auto-created recurring from FulfilmentTemplate ${templateUsed}`,
            });
          } catch (err) {
            console.error(`[log-sale] Deliverable.create (recurring) "${title}" failed:`, errMsg(err));
          }
        }
      }
    }
  } catch (err) {
    console.error(`[log-sale] deliverable provisioning failed for deal ${dealId}:`, errMsg(err));
  }

  // ── STEP 12 — Activity log (canonical LB-108-safe field names) ─────────
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      clientId,
      client_name:    clientName,
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'sale_logged',
      event_category: 'invoice',
      event_summary:  `${actor.name} logged ${pkgLabel} sale for ${clientName} — closer ${closerName}`,
      event_label:    'Sale logged',
      event_metadata: {
        deal_id:        dealId,
        contract_id:    contractId,
        invoice_id:     invoiceId,
        invoice_number: invoiceNumber,
        package:        String(pkg),
        add_on_name:    add_on_name || null,
        setup_fee:      setupNum,
        monthly_fee:    monthlyNum,
        term_months:    termNum,
        start_date:     startDateStr,
        closer_id:      closer.id,
        closer_name:    closerName,
        closer_role:    closerRole,
        cpc_id:         cpc?.id || null,
        cpc_name:       cpcName || null,
        commission_rows_written: commissions.length,
        deliverables_created: deliverablesCreated,
        fulfilment_template:  templateUsed,
        new_client_created: createdNewClient,
        notes:          cleanNotes || null,
      },
      logged_by:      actor.userId,
      logged_by_name: actor.name,
    });
  } catch (err) {
    console.error(`[log-sale] activity log failed (non-fatal) for deal ${dealId}:`, errMsg(err));
  }

  return Response.json({
    success:        true,
    client_id:      clientId,
    deal_id:        dealId,
    contract_id:    contractId,
    invoice_id:     invoiceId,
    invoice_number: invoiceNumber,
    commission_rows_written: commissions.length,
    deliverables_created: deliverablesCreated,
    new_client_created: createdNewClient,
  });

  } catch (err) {
    // Top-level catch — any uncaught throw lands here. Returns the error
    // message + stack so the frontend toast can show what actually broke
    // instead of "Failed to log sale (unknown)".
    const stack = (err as any)?.stack ? String((err as any).stack).split('\n').slice(0, 5).join(' | ') : '';
    console.error('[log-sale] UNCAUGHT:', errMsg(err), stack);
    return Response.json({
      success: false,
      error:   'unhandled_exception',
      step:    'unknown',
      detail:  errMsg(err),
      stack,
    }, { status: 500 });
  }
});
