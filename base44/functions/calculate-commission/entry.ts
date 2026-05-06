import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// Marketing iO Commission Engine — Working System v1.0 (locked).
//
// Triggered by the payment webhook on a successful payment. Walks every line
// item on the related invoice, applies the rate per product type,
// writes Commission rows for the closer + (optional) CPC sourcer + admin, and
// kicks the milestone tracker for the closer.
//
// IDEMPOTENT: short-circuits if Payment.commission_calculated === true.
// =============================================================================

// Pricing for retainer base lookup (mirrors src/lib/commissionConfig.js +
// src/data/ProductCatalog.js). Keep in sync if package prices change.
const PACKAGE_COMMISSIONS: Record<string, {
  setup_rate: number;
  retainer_rate: number;
  retainer_term_months: number;
  retainer_milestone_required: boolean;
  flat_amount: number | null;
  flat_trigger?: string;
}> = {
  ignite:        { setup_rate: 0.07,  retainer_rate: 0.07,  retainer_term_months: 12, retainer_milestone_required: true,  flat_amount: null },
  accelerate:    { setup_rate: 0.07,  retainer_rate: 0.07,  retainer_term_months: 12, retainer_milestone_required: true,  flat_amount: null },
  dominate:      { setup_rate: 0.07,  retainer_rate: 0.075, retainer_term_months: 12, retainer_milestone_required: true,  flat_amount: null },
  street_pulse:  { setup_rate: 0,     retainer_rate: 0.12,  retainer_term_months: 1,  retainer_milestone_required: false, flat_amount: 444, flat_trigger: 'first_retainer_clears' },
  township_pulse:{ setup_rate: 0,     retainer_rate: 0,     retainer_term_months: 0,  retainer_milestone_required: false, flat_amount: 130, flat_trigger: 'setup_clears' }
};

const PRODUCT_MONTHLY_PRICE: Record<string, number> = {
  ignite: 490,
  accelerate: 890,
  dominate: 1490,
  street_pulse: 3700,
  township_pulse: 0
};

const ADDON_BUCKET_MAP: Record<string, 'A' | 'B' | 'C' | 'D' | 'E'> = {
  google_business_profile: 'A',
  marketing_audit: 'A',
  competitor_analysis: 'A',
  crm_training: 'A',
  staff_training: 'A',
  ai_chatbot: 'B',
  whatsapp_automation: 'B',
  sms_marketing: 'B',
  reputation_management: 'C',
  email_newsletter: 'C',
  short_form_video: 'C',
  ai_content_writing: 'C',
  website_maintenance: 'C',
  paid_ads_management: 'D',
  print_signage: 'E',
  hosting_reselling: 'E'
};

// Reasonable defaults for monthly prices on bucket B/C/D add-ons. If the
// invoice line passes a monthly_price explicitly, that wins.
const ADDON_MONTHLY_PRICE: Record<string, number> = {
  ai_chatbot: 990,
  whatsapp_automation: 690,
  sms_marketing: 590,
  reputation_management: 390,
  email_newsletter: 490,
  short_form_video: 1490,
  ai_content_writing: 690,
  website_maintenance: 390,
  paid_ads_management: 1990
};

const CPC_CLOSURE_BONUS = 250;
const ADMIN_PER_CONTRACT = 25;
const PAYROLL_CUTOFF_DAY = 6;

// Compute scheduled payout: 25th of NEXT month if event day <= 6, else 25th
// of the month AFTER next.
function scheduledPayoutDate(qualifyingEventAt: Date): string {
  const day = qualifyingEventAt.getUTCDate();
  const offsetMonths = day <= PAYROLL_CUTOFF_DAY ? 1 : 2;
  const target = new Date(Date.UTC(
    qualifyingEventAt.getUTCFullYear(),
    qualifyingEventAt.getUTCMonth() + offsetMonths,
    25
  ));
  return target.toISOString().slice(0, 10);
}

function payrollMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

interface CommissionDraft {
  user_id: string;
  user_name: string;
  user_role: string;
  type: string;
  amount: number;
  status: 'pending_milestone' | 'pending_payment';
  product_id: string;
  product_name: string;
  calc_breakdown: Record<string, any>;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const { payment_id } = body || {};
  if (!payment_id) return Response.json({ error: 'payment_id required' }, { status: 400 });

  // Fetch payment + invoice + client.
  const payments = await base44.asServiceRole.entities.Payment.filter({ id: payment_id });
  const payment = Array.isArray(payments) ? payments[0] : payments;
  if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

  if (payment.commission_calculated === true) {
    return Response.json({ success: true, skipped: 'already_calculated', payment_id });
  }
  if (payment.status !== 'successful') {
    return Response.json({ success: false, skipped: 'payment_not_successful', status: payment.status });
  }

  const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: payment.invoice_id });
  const invoice = Array.isArray(invoices) ? invoices[0] : invoices;
  if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

  const clients = await base44.asServiceRole.entities.Client.filter({ id: payment.client_id });
  const client = Array.isArray(clients) ? clients[0] : clients;

  // Resolve closer (snapshot from payment > invoice > owner fallback).
  let closer: any = null;
  const closerId = payment.closer_id || invoice.closer_id || null;
  if (closerId) {
    try {
      const found = await base44.asServiceRole.entities.User.filter({ id: closerId });
      closer = Array.isArray(found) ? found[0] : found;
    } catch (err) {
      console.error('[calculate-commission] closer lookup failed:', err);
    }
  }
  if (!closer) {
    try {
      const owners = await base44.asServiceRole.entities.User.filter({ role: 'owner' });
      closer = Array.isArray(owners) ? owners[0] : owners;
      console.log('[calculate-commission] no closer on payment/invoice, falling back to owner', { payment_id, owner_id: closer?.id });
    } catch (err) {
      console.error('[calculate-commission] owner fallback lookup failed:', err);
    }
  }
  if (!closer) {
    return Response.json({ error: 'No closer or owner user available for attribution' }, { status: 500 });
  }

  // Resolve lead-source user (may be null).
  let leadSourceUser: any = null;
  const leadSrcId = payment.lead_source_user_id || invoice.lead_source_user_id || null;
  if (leadSrcId) {
    try {
      const found = await base44.asServiceRole.entities.User.filter({ id: leadSrcId });
      leadSourceUser = Array.isArray(found) ? found[0] : found;
    } catch (err) {
      console.error('[calculate-commission] lead_source_user lookup failed:', err);
    }
  }

  const eventAt = payment.completed_at ? new Date(payment.completed_at) : new Date();
  const eventIso = eventAt.toISOString();
  const payoutDate = scheduledPayoutDate(eventAt);
  const drafts: CommissionDraft[] = [];

  // ---- Walk line items ----------------------------------------------------
  const lineItems = (invoice.line_items || []) as any[];
  let contributesToMilestone = false;

  for (const li of lineItems) {
    const productId: string = li.product_id || '';
    const productName: string = li.product_name || productId;
    const lineAmount = Number(li.amount || 0) * Math.max(1, Number(li.quantity || 1));

    // CASE — Core Package
    if (PACKAGE_COMMISSIONS[productId]) {
      const cfg = PACKAGE_COMMISSIONS[productId];

      // Flat-amount packages (street_pulse, township_pulse).
      if (cfg.flat_amount) {
        drafts.push({
          user_id: closer.id,
          user_name: closer.full_name || closer.name || closer.email || '',
          user_role: closer.role || '',
          type: productId === 'street_pulse' ? 'street_pulse_flat' : 'township_pulse_flat',
          amount: cfg.flat_amount,
          status: 'pending_payment',
          product_id: productId,
          product_name: productName,
          calc_breakdown: { formula: `flat R${cfg.flat_amount} per Working System v1.0`, trigger: cfg.flat_trigger }
        });
        continue;
      }

      // Setup commission — immediate.
      if (cfg.setup_rate > 0 && lineAmount > 0) {
        drafts.push({
          user_id: closer.id,
          user_name: closer.full_name || closer.name || closer.email || '',
          user_role: closer.role || '',
          type: 'setup_commission',
          amount: lineAmount * cfg.setup_rate,
          status: 'pending_payment',
          product_id: productId,
          product_name: productName,
          calc_breakdown: { base: lineAmount, rate: cfg.setup_rate, formula: 'line_amount × setup_rate' }
        });
      }

      // Retainer commission — pending milestone.
      if (cfg.retainer_rate > 0 && cfg.retainer_term_months > 0) {
        const monthly = PRODUCT_MONTHLY_PRICE[productId] || 0;
        const annual = monthly * cfg.retainer_term_months;
        const retainerAmount = annual * cfg.retainer_rate;
        if (retainerAmount > 0) {
          drafts.push({
            user_id: closer.id,
            user_name: closer.full_name || closer.name || closer.email || '',
            user_role: closer.role || '',
            type: 'retainer_commission',
            amount: retainerAmount,
            status: cfg.retainer_milestone_required ? 'pending_milestone' : 'pending_payment',
            product_id: productId,
            product_name: productName,
            calc_breakdown: { monthly, term_months: cfg.retainer_term_months, base: annual, rate: cfg.retainer_rate, formula: 'monthly × term × retainer_rate' }
          });
          if (cfg.retainer_milestone_required) {
            contributesToMilestone = true;
          }
        }
      }
      continue;
    }

    // CASE — Add-on
    const bucket = ADDON_BUCKET_MAP[productId];
    if (bucket === 'A' && lineAmount > 0) {
      drafts.push({
        user_id: closer.id,
        user_name: closer.full_name || closer.name || closer.email || '',
        user_role: closer.role || '',
        type: 'addon_setup_commission',
        amount: lineAmount * 0.07,
        status: 'pending_payment',
        product_id: productId,
        product_name: productName,
        calc_breakdown: { bucket: 'A', base: lineAmount, rate: 0.07, formula: 'line_amount × 0.07' }
      });
    } else if (bucket === 'B') {
      if (lineAmount > 0) {
        drafts.push({
          user_id: closer.id,
          user_name: closer.full_name || closer.name || closer.email || '',
          user_role: closer.role || '',
          type: 'addon_setup_commission',
          amount: lineAmount * 0.07,
          status: 'pending_payment',
          product_id: productId,
          product_name: productName,
          calc_breakdown: { bucket: 'B', base: lineAmount, rate: 0.07, formula: 'line_amount × 0.07 (setup)' }
        });
      }
      const monthly = Number(li.monthly_price || ADDON_MONTHLY_PRICE[productId] || 0);
      const annual = monthly * 12;
      if (annual > 0) {
        drafts.push({
          user_id: closer.id,
          user_name: closer.full_name || closer.name || closer.email || '',
          user_role: closer.role || '',
          type: 'addon_retainer_commission',
          amount: annual * 0.07,
          status: 'pending_milestone',
          product_id: productId,
          product_name: productName,
          calc_breakdown: { bucket: 'B', monthly, base: annual, rate: 0.07, formula: 'monthly × 12 × 0.07 (retainer, milestone-gated)' }
        });
        contributesToMilestone = true;
      }
    } else if (bucket === 'C') {
      const monthly = Number(li.monthly_price || ADDON_MONTHLY_PRICE[productId] || 0);
      const annual = monthly * 12;
      if (annual > 0) {
        drafts.push({
          user_id: closer.id,
          user_name: closer.full_name || closer.name || closer.email || '',
          user_role: closer.role || '',
          type: 'addon_retainer_commission',
          amount: annual * 0.07,
          status: 'pending_milestone',
          product_id: productId,
          product_name: productName,
          calc_breakdown: { bucket: 'C', monthly, base: annual, rate: 0.07, formula: 'monthly × 12 × 0.07 (pure recurring, milestone-gated)' }
        });
        contributesToMilestone = true;
      }
    } else if (bucket === 'D') {
      const monthly = Number(li.monthly_price || ADDON_MONTHLY_PRICE[productId] || 0);
      if (monthly > 0) {
        drafts.push({
          user_id: closer.id,
          user_name: closer.full_name || closer.name || closer.email || '',
          user_role: closer.role || '',
          type: 'addon_paid_ads_monthly',
          amount: monthly * 0.10,
          status: 'pending_payment',
          product_id: productId,
          product_name: productName,
          calc_breakdown: { bucket: 'D', month_index: 1, monthly, rate: 0.10, formula: 'monthly_mgmt_fee × 0.10 (first month — V2 will trigger subsequent months on each retainer payment)' }
        });
      }
    }
    // Bucket E: passive — no commission.
  }

  // ---- CPC closure bonus --------------------------------------------------
  if (
    invoice.lead_source_type === 'cpc_outbound' &&
    leadSourceUser?.id &&
    leadSourceUser.id !== closer.id &&
    (leadSourceUser.role === 'cpc' || leadSourceUser.role === 'cpc_outbound')
  ) {
    drafts.push({
      user_id: leadSourceUser.id,
      user_name: leadSourceUser.full_name || leadSourceUser.name || leadSourceUser.email || '',
      user_role: leadSourceUser.role || 'cpc',
      type: 'cpc_closure_bonus',
      amount: CPC_CLOSURE_BONUS,
      status: 'pending_payment',
      product_id: '',
      product_name: 'CPC closure bonus',
      calc_breakdown: { formula: `flat R${CPC_CLOSURE_BONUS} per Working System v1.0` }
    });
  }

  // ---- Admin contract-load fee -------------------------------------------
  if (invoice.contract_id) {
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const admin = Array.isArray(admins) ? admins[0] : admins;
      if (admin?.id) {
        drafts.push({
          user_id: admin.id,
          user_name: admin.full_name || admin.name || admin.email || '',
          user_role: 'admin',
          type: 'admin_contract_load',
          amount: ADMIN_PER_CONTRACT,
          status: 'pending_payment',
          product_id: '',
          product_name: 'Admin contract load',
          calc_breakdown: { formula: `flat R${ADMIN_PER_CONTRACT} per loaded contract` }
        });
      }
    } catch (err) {
      console.error('[calculate-commission] admin lookup failed:', err);
    }
  }

  // ---- Persist drafts ----------------------------------------------------
  const created: any[] = [];
  for (const d of drafts) {
    try {
      const row = await base44.asServiceRole.entities.Commission.create({
        // Canonical (new) fields.
        user_id: d.user_id,
        user_name: d.user_name,
        user_role: d.user_role,
        type: d.type,
        amount: Number(d.amount.toFixed(2)),
        status: d.status,
        payment_id: payment.id,
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        client_name: invoice.client_name || client?.business_name || '',
        deal_id: invoice.deal_id || null,
        product_id: d.product_id,
        product_name: d.product_name,
        calc_breakdown: d.calc_breakdown,
        qualifying_event_at: eventIso,
        scheduled_payout_date: d.status === 'pending_payment' ? payoutDate : null,
        // Legacy mirror fields so existing payroll/dashboards keep working.
        staff_id: d.user_id,
        staff_name: d.user_name,
        staff_role: d.user_role,
        commission_type: d.type,
        commission_amount: Number(d.amount.toFixed(2)),
        package_or_addon: d.product_name,
        qualifying_event: d.calc_breakdown?.formula || '',
        qualifying_event_date: eventIso.slice(0, 10),
        payroll_month: payrollMonth(eventAt)
      });
      created.push(row);
    } catch (err) {
      console.error('[calculate-commission] commission create failed:', err);
    }
  }

  // Mark payment as calculated (idempotency guard).
  try {
    await base44.asServiceRole.entities.Payment.update(payment.id, { commission_calculated: true });
  } catch (err) {
    console.error('[calculate-commission] payment flag update failed:', err);
  }

  // Kick milestone tracker if any retainer was milestone-gated.
  if (contributesToMilestone && invoice.deal_id) {
    base44.functions.invoke('update-milestone-tracker', {
      user_id: closer.id,
      deal_id: invoice.deal_id,
      contributes_to_milestone: true
    }).catch((err: any) => {
      console.error('[calculate-commission] update-milestone-tracker failed:', err);
    });
  }

  return Response.json({
    success: true,
    payment_id,
    commissions_created: created.length,
    closer_id: closer.id,
    contributes_to_milestone: contributesToMilestone
  });
});
