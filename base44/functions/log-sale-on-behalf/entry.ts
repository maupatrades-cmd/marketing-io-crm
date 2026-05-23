import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// log-sale-on-behalf — admin/owner orchestrator for off-platform sales.
//
// Records a sale that a consultant (cpc/field_agent/admin/owner) closed off
// the platform — e.g. field network outage, paper-signed contract handed to
// the office. The sale attributes to the consultant for commission, with a
// full audit trail.
//
// Sequence (locked):
//   1. session + role gate (owner/admin only) → 403 otherwise
//   2. input validation
//   3. consultant lookup (AppUser) → must be cpc/field_agent/admin/owner
//   4. new client → Client.create     OR
//   5. existing client → Client.filter
//   6. Invoice via create-invoice (closer_id = consultant.id, send_email=true)
//   7. ClientAddOn.create (only when product_type === 'add_on')
//   8. Contract.create — paper path = fully_signed + file URL;
//                        digital path = draft + pre-seeded signing token
//   9. Email to consultant (inline Resend, branded wrapper)
//  10. Bell notification via notify-staff (ClientNotification)
//  11. InternalMessage row (permanent /mail record)
//  12. ClientActivityLog.create with the canonical field names (LB-108-safe)
//
// Failure handling:
//   - step 6 fail               → return error, nothing else written
//   - step 7 or 8 fail          → markInvoiceOrphan() appends a tag to
//                                 Invoice.notes so /admin/invoices surfaces
//                                 the orphan, then return partial_state error
//   - steps 9–11 fail           → continue, collect into warnings[]
//   - step 12 fail              → log to console, append to warnings[]
//
// Base44 has no DB transactions: each step is best-effort and any mid-sequence
// failure returns the partial state honestly — it does not pretend success.
// =============================================================================

const ALLOWED_CALLER_ROLES   = ['owner', 'admin'];
const ALLOWED_CONSULTANT_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];
const ALLOWED_INVOICE_TYPES  = ['setup_fee', 'add_on_setup', 'add_on_monthly'];

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL     = 'Marketing iO <hello@marketingio.co.za>';

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

function e400(reason: string) {
  return Response.json({ error: reason }, { status: 400 });
}

const today  = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

function truncate(s: string, n: number): string {
  const str = String(s ?? '');
  return str.length <= n ? str : str.slice(0, n - 1) + '…';
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function fmtZar(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function prettyProductName(slug: string): string {
  if (!slug) return '';
  return slug
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
    console.error('[log-sale-on-behalf] auth-me failed:', errMsg(err));
  }
  return null;
}

// Branded HTML wrapper — mirrors send-invoice-issued-email exactly so the
// consultant notification looks consistent with the rest of the Marketing iO
// email surface.
function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendConsultantEmail(args: {
  to: string;
  consultantName: string;
  adminName: string;
  clientName: string;
  productLabel: string;
  amount: number;
  invoiceNumber: string;
}) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  if (!args.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.to)) {
    throw new Error('consultant_has_no_email');
  }
  const resend = new Resend(RESEND_API_KEY);
  const dateStr = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = wrapEmail(`
    <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">A sale has been logged for you</h1>
    <p style="margin:0 0 16px 0;">Hi ${escapeHtml(args.consultantName)},</p>
    <p style="margin:0 0 16px 0;"><strong>${escapeHtml(args.adminName)}</strong> has just logged a sale on your behalf:</p>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;">Client</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">${escapeHtml(args.clientName)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Product</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(args.productLabel)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Amount</td>
          <td style="padding:10px 16px;font-size:18px;color:#0f172a;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;">R${fmtZar(args.amount)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Invoice</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(args.invoiceNumber)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Date logged</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(dateStr)}</td></tr>
    </table>
    <p style="margin:0 0 16px 0;">Commission has been attributed to your account. The invoice will appear in your <strong>My Invoices</strong> page, and commission status will move from pending → approved when the client pays.</p>
    <p style="margin:0 0 16px 0;color:#b91c1c;"><strong>If you believe this attribution is wrong, contact Admin immediately</strong> — do not wait. Reply to this email or message them in the CRM inbox.</p>
    <p style="margin:0 0 4px 0;">— The Marketing iO Team</p>
    <p style="margin:0;font-style:italic;color:#a764e6;">Too good to stay hidden.</p>
  `);
  const result = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      [args.to],
    subject: `A sale has been logged for you — ${args.clientName}`,
    html,
  });
  if (result?.error) throw new Error(String(result.error?.message || 'resend_error'));
}

function buildInternalMessageBody(args: {
  adminName: string;
  consultantName: string;
  clientName: string;
  productLabel: string;
  amount: number;
  invoiceNumber: string;
  contract_path: 'paper' | 'digital';
  notes: string;
}): string {
  const dateStr = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const contractLine = args.contract_path === 'paper'
    ? 'Paper contract uploaded'
    : 'Digital draft — pending admin send';
  return [
    `${args.adminName} logged a sale on your behalf:`,
    '',
    `  Client:    ${args.clientName}`,
    `  Product:   ${args.productLabel}`,
    `  Amount:    R${fmtZar(args.amount)}`,
    `  Invoice:   ${args.invoiceNumber}`,
    `  Contract:  ${contractLine}`,
    '',
    `Logged on ${dateStr}.`,
    '',
    'Reason / notes from admin:',
    `"${truncate(args.notes, 500)}"`,
    '',
    'Commission has been attributed to you. Your invoice appears in My Invoices; commission flips from pending → approved when the client pays.',
    '',
    'If this attribution is wrong, contact Admin immediately.',
  ].join('\n');
}

async function markInvoiceOrphan(
  base44: any, invoiceId: string, adminName: string, reason: string,
) {
  try {
    const list = unwrap(await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId }));
    const existing = list[0];
    const oldNotes = String(existing?.notes || '');
    const tag = `[ORPHAN — log-sale-on-behalf ${reason} at ${nowIso()}. Admin: ${adminName}. Review and re-attach contract.]`;
    await base44.asServiceRole.entities.Invoice.update(invoiceId, {
      notes: oldNotes ? `${oldNotes}\n${tag}` : tag,
    });
  } catch (err) {
    console.error('[log-sale-on-behalf] markInvoiceOrphan failed (non-fatal):', errMsg(err));
  }
}

Deno.serve(async (req) => {
  // ── 0. boilerplate ─────────────────────────────────────────────────────
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    token,
    consultant_id,
    client_id,
    new_client_data,
    product_id,
    product_type,
    invoice_type,
    amount,
    contract_path,
    file_url,
    notes,
  } = body || {};

  // ── STEP 1 — session + role gate ───────────────────────────────────────
  const actor = await validateActor(base44, String(token ?? '').trim());
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_CALLER_ROLES.includes(actor.role)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // ── STEP 2 — input validation ──────────────────────────────────────────
  if (!consultant_id)                  return e400('consultant_id required');
  if (!client_id && !new_client_data)  return e400('client required (client_id or new_client_data)');
  if (client_id && new_client_data)    return e400('pick existing OR new, not both');
  if (!product_id || !product_type)    return e400('product_id and product_type required');
  if (!['package', 'add_on'].includes(product_type)) return e400('product_type must be package|add_on');
  if (!invoice_type || !ALLOWED_INVOICE_TYPES.includes(invoice_type)) {
    return e400(`invoice_type must be one of ${ALLOWED_INVOICE_TYPES.join('|')}`);
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) return e400('amount must be a positive number');
  if (!['paper', 'digital'].includes(contract_path)) return e400('contract_path must be paper|digital');
  if (contract_path === 'paper' && !file_url)        return e400('file_url required for paper path');
  if (!notes || String(notes).trim().length < 10)    return e400('notes (min 10 chars) required for audit');

  // ── STEP 3 — consultant lookup ─────────────────────────────────────────
  let consultant: any = null;
  try {
    consultant = unwrap(await base44.asServiceRole.entities.AppUser.filter({ id: consultant_id }))[0] || null;
  } catch (err) {
    console.error('[log-sale-on-behalf] consultant lookup failed:', errMsg(err));
    return Response.json({ error: 'consultant_lookup_failed' }, { status: 500 });
  }
  if (!consultant) return e400('consultant_not_found');
  if (!ALLOWED_CONSULTANT_ROLES.includes(String(consultant.role))) {
    return e400('consultant_role_invalid');
  }
  const consultantName  = String(consultant.full_name || consultant.email || 'Consultant');
  const consultantEmail = String(consultant.email || '').trim();

  // ── STEP 4/5 — resolve or create client ────────────────────────────────
  let client: any = null;
  if (client_id) {
    try {
      client = unwrap(await base44.asServiceRole.entities.Client.filter({ id: String(client_id) }))[0] || null;
    } catch (err) {
      return Response.json({ error: 'client_lookup_failed', detail: errMsg(err) }, { status: 500 });
    }
    if (!client) return e400('client_not_found');
  } else {
    const nc = new_client_data || {};
    if (!nc.business_name || !nc.contact_person || !nc.email) {
      return e400('new_client_data must include business_name, contact_person, email');
    }
    try {
      client = await base44.asServiceRole.entities.Client.create({
        business_name:    String(nc.business_name).trim(),
        contact_person:   String(nc.contact_person).trim(),
        email:            String(nc.email).trim().toLowerCase(),
        phone:            String(nc.phone   || '').trim(),
        address:          String(nc.address || '').trim(),
        lifecycle_stage:  'active',
        status:           'onboarding',
        source:           'field_agent_direct',
        signed_up_by_id:  consultant.id,
      });
    } catch (err) {
      return Response.json({ error: 'client_create_failed', step: 4, detail: errMsg(err) }, { status: 500 });
    }
  }
  const clientId   = String(client.id);
  const clientName = String(client.business_name || '');

  // ── STEP 6 — Invoice via create-invoice ────────────────────────────────
  const productLabel = prettyProductName(String(product_id));
  let invoiceId = '';
  let invoiceNumber = '';
  let invoiceTotal = amountNum;
  try {
    const res = await base44.asServiceRole.functions.invoke('create-invoice', {
      client_id:  clientId,
      type:       invoice_type,
      closer_id:  consultant.id,
      send_email: true,
      line_items: [{
        product_id:   String(product_id),
        product_name: productLabel,
        description:  productLabel,
        amount:       amountNum,
        quantity:     1,
      }],
    });
    const data = res?.data ?? res;
    if (!data?.success) throw new Error(data?.error || 'create-invoice returned non-success');
    invoiceId     = String(data.invoice_id || '');
    invoiceNumber = String(data.invoice_number || '');
    invoiceTotal  = Number(data.total ?? amountNum);
    if (!invoiceId) throw new Error('create-invoice returned no invoice_id');
  } catch (err) {
    return Response.json({
      error: 'invoice_create_failed', step: 6, detail: errMsg(err),
    }, { status: 500 });
  }

  // ── STEP 7 — ClientAddOn (only for add-ons) ────────────────────────────
  let clientAddOnId: string | null = null;
  if (product_type === 'add_on') {
    try {
      const addon = await base44.asServiceRole.entities.ClientAddOn.create({
        client_id:   clientId,
        client_name: clientName,
        add_on:      String(product_id),
        setup_fee:   invoice_type === 'add_on_setup'   ? amountNum : 0,
        monthly_fee: invoice_type === 'add_on_monthly' ? amountNum : 0,
        status:      'setup_pending',
        start_date:  today(),
        notes:       `Logged on behalf of ${consultantName} by ${actor.name}. ${truncate(String(notes), 200)}`,
      });
      clientAddOnId = String(addon?.id || '') || null;
    } catch (err) {
      await markInvoiceOrphan(base44, invoiceId, actor.name, 'addon_create_failed');
      return Response.json({
        error: 'addon_create_failed', step: 7, detail: errMsg(err),
        partial_state: { invoice_id: invoiceId, invoice_number: invoiceNumber },
      }, { status: 500 });
    }
  }

  // ── STEP 8 — Contract ──────────────────────────────────────────────────
  const auditNote = `Logged on behalf by ${actor.name} for ${consultantName} on ${today()}. Reason: ${truncate(String(notes), 500)}`;
  const contractPackage = product_type === 'package' ? String(product_id) : 'add_on';
  const setupFeeAmt   = invoice_type === 'add_on_monthly' ? 0 : amountNum;
  const monthlyAmt    = invoice_type === 'add_on_monthly' ? amountNum : 0;

  let contractPayload: Record<string, unknown>;
  if (contract_path === 'paper') {
    contractPayload = {
      client_id:               clientId,
      client_name:             clientName,
      package:                 contractPackage,
      ...(product_type === 'add_on' ? { add_on_name: String(product_id) } : {}),
      setup_fee:               setupFeeAmt,
      monthly_retainer:        monthlyAmt,
      status:                  'signed',
      signing_status:          'fully_signed',
      signed_by_client:        true,
      signed_by_mio:           true,
      signed_date:             today(),
      client_signed_at:        nowIso(),
      marketing_io_signed_at:  nowIso(),
      final_signed_pdf_url:    String(file_url),
      notes:                   auditNote,
    };
  } else {
    contractPayload = {
      client_id:               clientId,
      client_name:             clientName,
      package:                 contractPackage,
      ...(product_type === 'add_on' ? { add_on_name: String(product_id) } : {}),
      setup_fee:               setupFeeAmt,
      monthly_retainer:        monthlyAmt,
      status:                  'draft',
      signing_status:          'not_sent',
      signed_by_client:        false,
      signed_by_mio:           false,
      signing_token:           crypto.randomUUID(),
      signing_link_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes:                   auditNote,
    };
  }

  let contractId = '';
  try {
    const c = await base44.asServiceRole.entities.Contract.create(contractPayload);
    contractId = String(c?.id || '');
    if (!contractId) throw new Error('contract_create returned no id');
  } catch (err) {
    await markInvoiceOrphan(base44, invoiceId, actor.name, 'contract_create_failed');
    return Response.json({
      error: 'contract_create_failed', step: 8, detail: errMsg(err),
      partial_state: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        client_addon_id: clientAddOnId,
      },
    }, { status: 500 });
  }

  // ── STEPS 9–11 — best-effort notifications (warnings, not failures) ────
  const warnings: string[] = [];

  // 9. Email to consultant via inline Resend.
  try {
    await sendConsultantEmail({
      to:             consultantEmail,
      consultantName,
      adminName:      actor.name,
      clientName,
      productLabel,
      amount:         invoiceTotal,
      invoiceNumber,
    });
  } catch (err) {
    warnings.push(`email_failed: ${errMsg(err)}`);
  }

  // 10. Bell notification via existing notify-staff helper.
  try {
    await base44.asServiceRole.functions.invoke('notify-staff', {
      recipient_user_ids:  [consultant.id],
      type:                'system_update',
      title:               'A sale has been logged for you',
      body:                `${actor.name} logged a ${productLabel} sale for ${clientName} (R${fmtZar(invoiceTotal)}). View in My Invoices.`,
      action_url:          '/my-invoices',
      related_client_id:   clientId,
      related_entity_type: 'Invoice',
      related_entity_id:   invoiceId,
    });
  } catch (err) {
    warnings.push(`notify_failed: ${errMsg(err)}`);
  }

  // 11. InternalMessage row — permanent /mail record.
  try {
    await base44.asServiceRole.entities.InternalMessage.create({
      from_id:      actor.userId,
      from_name:    actor.name,
      from_email:   actor.email || '',
      to_id:        consultant.id,
      to_name:      consultantName,
      to_email:     consultantEmail,
      subject:      `A sale has been logged for you — ${clientName}`,
      message:      buildInternalMessageBody({
        adminName:      actor.name,
        consultantName, clientName, productLabel,
        amount:         invoiceTotal,
        invoiceNumber,
        contract_path,
        notes:          String(notes),
      }),
      message_type: 'general',
      client_id:    clientId,
      client_name:  clientName,
      priority:     'normal',
      status:       'new',
      read:         false,
    });
  } catch (err) {
    warnings.push(`internal_message_failed: ${errMsg(err)}`);
  }

  // ── STEP 12 — activity log (canonical field names, LB-108-safe) ────────
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      clientId,
      client_name:    clientName,
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'sale_logged_on_behalf',
      event_category: 'invoice',
      event_summary:  `${actor.name} logged ${productLabel} sale (R${fmtZar(invoiceTotal)}) for ${consultantName}`,
      event_label:    'Sale logged on behalf',
      event_metadata: {
        admin_id:        actor.userId,
        admin_name:      actor.name,
        consultant_id:   consultant.id,
        consultant_name: consultantName,
        invoice_id:      invoiceId,
        invoice_number:  invoiceNumber,
        contract_id:     contractId,
        contract_path,
        file_url:        contract_path === 'paper' ? String(file_url) : null,
        product_id:      String(product_id),
        product_type,
        amount:          invoiceTotal,
        notes:           truncate(String(notes), 1000),
      },
      logged_by:      actor.userId,
      logged_by_name: actor.name,
    });
  } catch (err) {
    console.error('[log-sale-on-behalf] ClientActivityLog.create failed (non-fatal):', errMsg(err));
    warnings.push(`activity_log_failed: ${errMsg(err)}`);
  }

  return Response.json({
    success:         true,
    invoice_id:      invoiceId,
    invoice_number:  invoiceNumber,
    contract_id:     contractId,
    client_id:       clientId,
    client_addon_id: clientAddOnId,
    consultant_id:   consultant.id,
    consultant_name: consultantName,
    ...(warnings.length ? { warnings } : {}),
  });
});
