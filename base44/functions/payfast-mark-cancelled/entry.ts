import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// PayFast mark-cancelled — Step 8 PR C.
//
// Called by /payment-cancelled when the buyer hits PayFast's cancel button
// and gets redirected back to our app. Looks up the Payment by m_payment_id
// and flips it from `pending` → `cancelled`. Also kicks off the abandoned-
// cart sequence (PR E) so we can recover the buyer.
//
// Auth model:
//   The function is public — no session required. Anyone with a valid
//   m_payment_id can call it. That's safe because:
//     - It only allows the `pending → cancelled` transition. Already-final
//       Payment rows (successful / failed / cancelled) are never modified.
//     - Even a malicious caller who knows somebody's m_payment_id can at
//       worst cancel a payment that was already pending. The buyer can
//       retry from /checkout/<package_id>.
//     - SecurityEvent is the audit trail of any sensitive write.
//
// Idempotent: re-calling for an already-cancelled Payment returns the same
// status with no further writes.
// =============================================================================

function unwrapOne(result: any): any {
  if (result == null) return null;
  if (Array.isArray(result)) return result[0] ?? null;
  if (typeof result === 'object') {
    if (result.id) return result;
    const inner = (result as any).data;
    if (Array.isArray(inner)) return inner[0] ?? null;
    if (inner && typeof inner === 'object' && inner.id) return inner;
  }
  return null;
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

  const mPaymentId = String(body?.m_payment_id ?? '').trim();
  if (!mPaymentId) {
    return Response.json({ error: 'm_payment_id is required' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  // Look up the Payment row.
  let payment: any = null;
  try {
    const found = await base44.asServiceRole.entities.Payment.filter({
      gateway_reference: mPaymentId,
    });
    payment = unwrapOne(found);
  } catch (err) {
    console.error('[payfast-mark-cancelled] Payment lookup failed:', err);
    return Response.json({ error: 'lookup_failed' }, { status: 500 });
  }

  if (!payment?.id) {
    // Don't 404 — many cancel_url hits will be from PayFast's redirect
    // moments after our checkout-init created the row, but the row may be
    // racing async DB consistency or the m_payment_id may be from a
    // previous app instance. Tell the caller "unknown" and move on.
    console.log(
      `[payfast-mark-cancelled] no Payment row for m_payment_id=${mPaymentId}`
    );
    return Response.json({ status: 'unknown', m_payment_id: mPaymentId }, { status: 200 });
  }

  // State machine: only `pending → cancelled` is allowed. Idempotent for
  // already-cancelled. Any other state is left alone (already-successful
  // payments must not be flipped to cancelled by a stray cancel_url hit).
  if (payment.status !== 'pending') {
    console.log(
      `[payfast-mark-cancelled] no-op — m_payment_id=${mPaymentId}, ` +
      `status already ${payment.status}`
    );
    return Response.json(
      { status: payment.status, m_payment_id: mPaymentId, no_op: true },
      { status: 200 }
    );
  }

  // Flip to cancelled.
  try {
    await base44.asServiceRole.entities.Payment.update(payment.id, {
      status: 'cancelled',
      gateway_payment_status: 'CANCELLED_BY_USER',
      failed_reason: 'Buyer cancelled via PayFast cancel_url redirect.',
    });
  } catch (err) {
    console.error(
      `[payfast-mark-cancelled] Payment.update failed — m_payment_id=${mPaymentId}:`,
      err
    );
    return Response.json({ error: 'update_failed' }, { status: 500 });
  }

  console.log(
    `[payfast-mark-cancelled] flipped to cancelled — m_payment_id=${mPaymentId}, ` +
    `payment_id=${payment.id}`
  );

  // Activity audit (Client Portal PR A): payment_cancelled.
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      payment.client_id,
      client_name:    String(payment.client_name || '').trim(),
      actor_id:       '',
      actor_role:     'client',
      event_type:     'payment_cancelled',
      event_category: 'payment',
      event_summary:  'Payment cancelled by buyer',
      event_metadata: {
        m_payment_id: mPaymentId,
        package_id:   payment.package_id || '',
        amount:       Number(payment.amount || 0),
        source:       'payfast_cancel_url',
      },
      event_label:    'Payment cancelled by buyer',
      logged_by:      '',
      logged_by_name: '',
    });
  } catch (logErr) {
    console.error('[payfast-mark-cancelled] activity log failed (non-fatal):', logErr);
  }

  // Trigger abandoned-cart recovery sequence (PR E implements). Wrapped in
  // try/catch — a failure here MUST NOT poison the user's "cancelled"
  // confirmation. The abandoned-cart-trigger function may not exist yet
  // until PR E lands, so we expect this to log an error during the gap.
  try {
    await base44.functions.invoke('abandoned-cart-trigger', {
      m_payment_id:      mPaymentId,
      payment_id:        payment.id,
      abandonment_type:  'cancel_button',
      client_id:         payment.client_id,
      package_id:        payment.package_id || '',
      email_address:     '',  // Cancel-url has no email body; trigger fn
                              // will look it up from Payment.client_id.
      source:            'mark_cancelled_function',
    });
    console.log(
      `[payfast-mark-cancelled] abandoned-cart trigger sent — payment_id=${payment.id}`
    );
  } catch (err) {
    console.error(
      `[payfast-mark-cancelled] abandoned-cart trigger failed (non-fatal):`,
      err
    );
  }

  return Response.json(
    { status: 'cancelled', m_payment_id: mPaymentId, payment_id: payment.id },
    { status: 200 }
  );
});
