import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// Reattribute pending commissions from one user to another, within the 7-day
// allocation window after self-signup payment.
//
// Used by /owner/leads when the owner re-allocates a self-signup lead (whose
// invoices were auto-attributed to the owner) onto a Field Agent.
//
// SCOPE — only commissions for this client where:
//   * created within last 7 days
//   * status in ['pending_payment', 'pending_milestone']
// Paid commissions are NOT touched (use process-clawback for those).
// =============================================================================

const ALLOCATION_WINDOW_DAYS = 7;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { client_id, new_closer_id, triggered_by_user_id } = body || {};
  if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 });
  if (!new_closer_id) return Response.json({ error: 'new_closer_id required' }, { status: 400 });

  // Resolve new closer.
  let newCloser: any = null;
  try {
    const found = await base44.asServiceRole.entities.User.filter({ id: new_closer_id });
    newCloser = Array.isArray(found) ? found[0] : found;
  } catch (err) {
    console.error('[update-commission-attribution] new_closer lookup failed:', err);
  }
  if (!newCloser?.id) {
    return Response.json({ error: 'new_closer not found' }, { status: 404 });
  }

  const newName = newCloser.full_name || newCloser.name || newCloser.email || '';
  const newRole = newCloser.role || '';
  const nowIso = new Date().toISOString();
  const cutoffMs = Date.now() - ALLOCATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Find candidate commissions for this client.
  let commissions: any[] = [];
  try {
    const found = await base44.asServiceRole.entities.Commission.filter({ client_id });
    commissions = Array.isArray(found) ? found : [];
  } catch (err) {
    console.error('[update-commission-attribution] commission lookup failed:', err);
    return Response.json({ error: 'commission_lookup_failed' }, { status: 500 });
  }

  let count = 0;
  let totalAmount = 0;
  let outOfWindow = 0;
  let alreadyPaid = 0;

  for (const c of commissions) {
    const status = c.status;
    if (status === 'paid' || status === 'clawed_back' || status === 'clawback' || status === 'cancelled') {
      if (status === 'paid') alreadyPaid += 1;
      continue;
    }
    if (!['pending_payment', 'pending_milestone'].includes(status)) {
      continue;
    }
    const createdAt = c.qualifying_event_at || c.created_date || c.created_at;
    const createdMs = createdAt ? new Date(createdAt).getTime() : NaN;
    if (!createdMs || isNaN(createdMs) || createdMs < cutoffMs) {
      outOfWindow += 1;
      continue;
    }

    const originalUserId = c.user_id || c.staff_id;
    const amount = Number(c.amount ?? c.commission_amount ?? 0);

    try {
      await base44.asServiceRole.entities.Commission.update(c.id, {
        // Canonical fields.
        user_id: newCloser.id,
        user_name: newName,
        user_role: newRole,
        // Legacy mirror fields so existing payroll views keep working.
        staff_id: newCloser.id,
        staff_name: newName,
        staff_role: newRole,
        // Audit trail.
        reattributed_at: nowIso,
        reattributed_from: originalUserId || null,
        reattributed_by: triggered_by_user_id || null
      });
      count += 1;
      totalAmount += amount;
    } catch (err) {
      console.error('[update-commission-attribution] commission update failed:', err);
    }
  }

  console.log('[update-commission-attribution] reattributed', {
    client_id,
    new_closer_id: newCloser.id,
    triggered_by_user_id: triggered_by_user_id || null,
    count_reassigned: count,
    total_amount_reassigned: totalAmount,
    out_of_window: outOfWindow,
    already_paid: alreadyPaid
  });

  return Response.json({
    success: true,
    count_reassigned: count,
    total_amount_reassigned: Number(totalAmount.toFixed(2)),
    out_of_window: outOfWindow,
    already_paid: alreadyPaid
  });
});
