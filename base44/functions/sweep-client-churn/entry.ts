/**
 * sweep-client-churn
 * Finds Client rows where status='cancelled' AND deactivated_at < now - 30 days.
 * For each: status='churned', archived_at=now, log activity.
 *
 * Input: { dry_run?: boolean }
 * Schedule: daily 03:00 SAST (01:00 UTC)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GRACE_DAYS = 30;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const graceThreshold = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Fetch cancelled clients
    const allCancelled = await base44.asServiceRole.entities.Client.filter({ status: "cancelled" });
    const cancelledList = Array.isArray(allCancelled) ? allCancelled : [];

    // Filter those past the grace period
    const toChurn = cancelledList.filter(c => {
      if (!c.deactivated_at) return false;
      return c.deactivated_at < graceThreshold;
    });

    if (dryRun) {
      return Response.json({
        dry_run: true,
        grace_days: GRACE_DAYS,
        would_churn: toChurn.length,
        clients: toChurn.map(c => ({
          id: c.id,
          business_name: c.business_name,
          deactivated_at: c.deactivated_at,
          days_since_cancellation: Math.floor((Date.now() - new Date(c.deactivated_at).getTime()) / (24 * 60 * 60 * 1000)),
        })),
      });
    }

    const churned = [];

    for (const client of toChurn) {
      try {
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.Client.update(client.id, {
          status: "churned",
          archived_at: now,
        });

        await base44.asServiceRole.entities.ClientActivityLog.create({
          client_id: client.id,
          event_type: "client_churned",
          event_category: "account",
          event_label: `Client churned after ${GRACE_DAYS}-day grace period`,
          event_summary: `${client.business_name} has been moved to churned status. Cancelled on ${client.deactivated_at?.slice(0, 10)}.`,
          metadata: { deactivated_at: client.deactivated_at, archived_at: now },
        });

        churned.push({ id: client.id, business_name: client.business_name });
      } catch (err) {
        console.error(`[sweep-client-churn] Failed for client ${client.id}:`, err);
      }
    }

    return Response.json({ churned_count: churned.length, churned });
  } catch (err) {
    console.error("[sweep-client-churn] Fatal:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});