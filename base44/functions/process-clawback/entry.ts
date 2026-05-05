import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// Process commission clawback for a refunded/cancelled payment.
//
// - Enforces the 30-day clawback window from the original Payment.completed_at.
// - For each Commission tied to that Payment:
//     * Already paid → mark 'clawed_back' and create an offsetting
//       'manual_adjustment' (negative amount, status='approved') so the next
//       payroll batch deducts it.
//     * Pending/approved (unpaid) → mark 'cancelled'.
// =============================================================================

const CLAWBACK_WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const { payment_id, reason } = body || {};
  if (!payment_id) return Response.json({ error: 'payment_id required' }, { status: 400 });

  const payments = await base44.asServiceRole.entities.Payment.filter({ id: payment_id });
  const payment = Array.isArray(payments) ? payments[0] : payments;
  if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

  // Window check.
  const completedAt = payment.completed_at ? new Date(payment.completed_at) : null;
  if (!completedAt) {
    return Response.json({ error: 'Payment has no completed_at — cannot process clawback' }, { status: 400 });
  }
  const ageDays = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > CLAWBACK_WINDOW_DAYS) {
    return Response.json({
      error: `Outside clawback window (${ageDays.toFixed(1)}d > ${CLAWBACK_WINDOW_DAYS}d)`,
      payment_id
    }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  let clawedBack = 0;
  let cancelled = 0;
  let offsetsCreated = 0;

  let commissions: any[] = [];
  try {
    const found = await base44.asServiceRole.entities.Commission.filter({ payment_id });
    commissions = Array.isArray(found) ? found : [];
  } catch (err) {
    console.error('[process-clawback] commission lookup failed:', err);
    return Response.json({ error: 'commission_lookup_failed' }, { status: 500 });
  }

  for (const c of commissions) {
    const amount = Number(c.amount ?? c.commission_amount ?? 0);
    if (c.status === 'paid') {
      try {
        await base44.asServiceRole.entities.Commission.update(c.id, {
          status: 'clawed_back',
          clawback_reason: reason || 'Payment refunded/cancelled within window',
          clawback_payment_id: payment_id
        });
        clawedBack += 1;
      } catch (err) {
        console.error('[process-clawback] mark clawed_back failed:', err);
        continue;
      }

      // Create offsetting negative manual adjustment for the next payroll batch.
      try {
        await base44.asServiceRole.entities.Commission.create({
          user_id: c.user_id || c.staff_id,
          user_name: c.user_name || c.staff_name,
          user_role: c.user_role || c.staff_role,
          type: 'manual_adjustment',
          amount: -amount,
          status: 'approved',
          payment_id,
          invoice_id: c.invoice_id || null,
          client_id: c.client_id || null,
          client_name: c.client_name || null,
          deal_id: c.deal_id || null,
          product_id: c.product_id || null,
          product_name: c.product_name || null,
          calc_breakdown: { reason: 'clawback_offset', original_commission_id: c.id, original_amount: amount },
          qualifying_event_at: nowIso,
          approved_for_payout_at: nowIso,
          // Legacy mirror.
          staff_id: c.user_id || c.staff_id,
          staff_name: c.user_name || c.staff_name,
          staff_role: c.user_role || c.staff_role,
          commission_type: 'manual_adjustment',
          commission_amount: -amount,
          notes: `Clawback offset for commission ${c.id}: ${reason || ''}`
        });
        offsetsCreated += 1;
      } catch (err) {
        console.error('[process-clawback] offset create failed:', err);
      }
      continue;
    }

    if (['pending', 'pending_milestone', 'pending_payment', 'approved'].includes(c.status)) {
      try {
        await base44.asServiceRole.entities.Commission.update(c.id, {
          status: 'cancelled',
          clawback_reason: reason || 'Payment refunded/cancelled within window',
          clawback_payment_id: payment_id
        });
        cancelled += 1;
      } catch (err) {
        console.error('[process-clawback] mark cancelled failed:', err);
      }
    }
  }

  return Response.json({
    success: true,
    payment_id,
    commissions_clawed_back: clawedBack,
    commissions_cancelled: cancelled,
    offsets_created: offsetsCreated,
    total_affected: clawedBack + cancelled
  });
});
