import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// mark-invoice-paid-eft — Round 4 of recovery plan.
//
// Inputs (POST JSON):
//   { invoice_id, gateway_reference, paid_at?, token, note? }
//   - paid_at: optional YYYY-MM-DD; defaults to today.
//
// Output:
//   { success: true, payment_id, invoice_id }
//
// Records a manual EFT payment received outside PayFast — admin sees the
// deposit on a bank statement and matches it to an invoice via the
// /admin/invoices "Mark paid (EFT)" action. Function:
//   1. Validates session token, requires role owner|admin
//   2. Updates Invoice.status='paid', paid_at, payment_method='eft'
//   3. Creates a Payment row with type='eft', status='successful',
//      gateway='eft' (no real gateway), gateway_reference from input
//   4. Logs ClientActivityLog
//
// Idempotency: if Invoice.status === 'paid' already, returns the existing
// linked Payment if findable. Does not double-record.
// =============================================================================

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

async function deriveActor(base44: any, token: string) {
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
  return { userId: String(user.id || ''), role: String(user.role || 'client'), email: String(user.email || '') };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const invoiceId  = String(body?.invoice_id ?? '').trim();
  const reference  = String(body?.gateway_reference ?? '').trim();
  const paidAtIn   = String(body?.paid_at ?? '').trim();
  const tokenRaw   = String(body?.token ?? '').trim();
  const note       = body?.note ? String(body.note) : '';

  if (!invoiceId) return Response.json({ error: 'invoice_id required' }, { status: 400 });
  if (!reference) return Response.json({ error: 'gateway_reference required' }, { status: 400 });

  const base44 = createClientFromRequest(req);

  const actor = await deriveActor(base44, tokenRaw);
  if (!actor) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // Resolve invoice.
  const invList = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
  const invoice = unwrapList(invList)[0];
  if (!invoice) return Response.json({ error: 'invoice_not_found' }, { status: 404 });

  // Idempotency: already paid?
  if (invoice.status === 'paid') {
    const existing = await base44.asServiceRole.entities.Payment.filter({ invoice_id: invoiceId, type: 'eft' });
    const existingList = unwrapList(existing);
    return Response.json({
      success:    true,
      already:    true,
      payment_id: existingList[0]?.id || null,
      invoice_id: invoiceId,
    });
  }

  const paidAt = paidAtIn || new Date().toISOString().slice(0, 10);
  const amount = Number(invoice.total_amount || invoice.total || invoice.amount || 0);
  const nowIso = new Date().toISOString();

  // Create Payment row
  let payment: any;
  try {
    payment = await base44.asServiceRole.entities.Payment.create({
      client_id:           invoice.client_id,
      client_name:         invoice.client_name || '',
      invoice_id:          invoiceId,
      package_id:          '',
      amount,
      currency:            'ZAR',
      type:                'eft',
      status:              'successful',
      gateway:             'eft_manual',
      gateway_reference:   reference,
      gateway_payment_status: 'manually_recorded',
      completed_at:        nowIso,
      recorded_by_id:      actor.userId,
      recorded_by_email:   actor.email,
      notes:               note,
    });
  } catch (err) {
    console.error('[mark-invoice-paid-eft] Payment.create failed:', err);
    return Response.json({ error: 'payment_create_failed' }, { status: 500 });
  }

  // Update Invoice
  try {
    await base44.asServiceRole.entities.Invoice.update(invoiceId, {
      status:         'paid',
      paid_at:        nowIso,
      payment_method: 'eft',
    });
  } catch (err) {
    console.error('[mark-invoice-paid-eft] Invoice.update failed:', err);
    return Response.json({ error: 'invoice_update_failed', payment_id: payment.id }, { status: 500 });
  }

  // ClientActivityLog audit
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      invoice.client_id,
      client_name:    invoice.client_name || '',
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'invoice_paid_eft',
      event_category: 'payment',
      event_summary:  `Invoice ${invoice.invoice_number || invoiceId} marked paid (EFT) — R${amount.toFixed(2)}`,
      event_metadata: {
        invoice_id:        invoiceId,
        invoice_number:    invoice.invoice_number,
        amount,
        gateway_reference: reference,
        paid_at:           paidAt,
        recorded_by:       actor.email,
      },
      event_label:    'EFT payment recorded',
      logged_by:      actor.userId,
      logged_by_name: actor.email,
    });
  } catch (err) {
    console.error('[mark-invoice-paid-eft] ClientActivityLog.create failed (non-fatal):', err);
  }

  return Response.json({
    success:    true,
    payment_id: payment.id,
    invoice_id: invoiceId,
    amount,
  });
});
