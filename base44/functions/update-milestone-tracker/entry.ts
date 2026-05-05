import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// Update milestone tracker for a closer.
//
// Each milestone-contributing deal increments a closer's batch counter. When
// the batch reaches 5, every commission row tied to those 5 deals with status
// 'pending_milestone' is unlocked to 'pending_payment' (with milestone_unlocked_at
// + scheduled_payout_date computed from "now").
//
// The tracker is then reset for the next batch.
// =============================================================================

const PAYROLL_CUTOFF_DAY = 6;
const MILESTONE_DEAL_COUNT = 5;

function scheduledPayoutDate(now: Date): string {
  const day = now.getUTCDate();
  const offsetMonths = day <= PAYROLL_CUTOFF_DAY ? 1 : 2;
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 25));
  return target.toISOString().slice(0, 10);
}

function payrollMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { user_id, deal_id, contributes_to_milestone } = body || {};
  if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });
  if (!contributes_to_milestone) {
    return Response.json({ success: true, skipped: 'does_not_contribute_to_milestone' });
  }

  // Resolve user (for denormalized name).
  let user: any = null;
  try {
    const found = await base44.asServiceRole.entities.User.filter({ id: user_id });
    user = Array.isArray(found) ? found[0] : found;
  } catch (err) {
    console.error('[update-milestone-tracker] user lookup failed:', err);
  }

  // Find or create tracker row.
  let tracker: any = null;
  try {
    const found = await base44.asServiceRole.entities.MilestoneTracker.filter({ user_id });
    tracker = Array.isArray(found) ? found[0] : found;
  } catch (err) {
    console.error('[update-milestone-tracker] tracker lookup failed:', err);
  }
  if (!tracker) {
    try {
      tracker = await base44.asServiceRole.entities.MilestoneTracker.create({
        user_id,
        user_name: user?.full_name || user?.name || user?.email || '',
        current_batch_count: 0,
        total_milestones_hit: 0,
        current_batch_deal_ids: []
      });
    } catch (err) {
      console.error('[update-milestone-tracker] tracker create failed:', err);
      return Response.json({ error: 'tracker_create_failed' }, { status: 500 });
    }
  }

  const newCount = (tracker.current_batch_count || 0) + 1;
  const newDealIds = [...(tracker.current_batch_deal_ids || [])];
  if (deal_id && !newDealIds.includes(deal_id)) {
    newDealIds.push(deal_id);
  }

  // Not yet at milestone — just bump the counter.
  if (newCount < MILESTONE_DEAL_COUNT) {
    try {
      await base44.asServiceRole.entities.MilestoneTracker.update(tracker.id, {
        current_batch_count: newCount,
        current_batch_deal_ids: newDealIds
      });
    } catch (err) {
      console.error('[update-milestone-tracker] tracker increment failed:', err);
    }
    return Response.json({
      success: true,
      milestone_hit: false,
      current_batch_count: newCount,
      remaining: MILESTONE_DEAL_COUNT - newCount
    });
  }

  // Milestone hit — unlock pending_milestone retainer commissions for these deals.
  const now = new Date();
  const nowIso = now.toISOString();
  const payoutDate = scheduledPayoutDate(now);

  // Find every pending_milestone retainer commission for this user across the
  // batch's deal IDs. We OR-filter in JS because Base44 SDK filters are equality.
  let unlockedCount = 0;
  try {
    const candidates = await base44.asServiceRole.entities.Commission.filter({ user_id });
    const list = Array.isArray(candidates) ? candidates : [];
    for (const c of list) {
      if (c.status !== 'pending_milestone') continue;
      if (!['retainer_commission', 'addon_retainer_commission'].includes(c.type)) continue;
      // Require explicit deal_id match. A pending_milestone commission with
      // no deal_id (e.g. self-signup with no Deal record) must not be pulled
      // into another closer's milestone batch — it stays pending_milestone
      // until resolved separately.
      if (!c.deal_id) continue;
      if (!newDealIds.includes(c.deal_id)) continue;
      try {
        await base44.asServiceRole.entities.Commission.update(c.id, {
          status: 'pending_payment',
          milestone_unlocked_at: nowIso,
          scheduled_payout_date: payoutDate,
          payroll_month: payrollMonth(now),
          is_backdated: true
        });
        unlockedCount += 1;
      } catch (err) {
        console.error('[update-milestone-tracker] commission unlock failed:', err);
      }
    }
  } catch (err) {
    console.error('[update-milestone-tracker] commission scan failed:', err);
  }

  // Reset tracker for next batch.
  try {
    await base44.asServiceRole.entities.MilestoneTracker.update(tracker.id, {
      current_batch_count: 0,
      current_batch_deal_ids: [],
      total_milestones_hit: (tracker.total_milestones_hit || 0) + 1,
      last_milestone_at: nowIso
    });
  } catch (err) {
    console.error('[update-milestone-tracker] tracker reset failed:', err);
  }

  return Response.json({
    success: true,
    milestone_hit: true,
    commissions_unlocked: unlockedCount,
    batch_deal_ids: newDealIds
  });
});
