/**
 * sweep-overdue-invoices
 * Finds Invoice rows where status='sent' and due_date < today.
 * Updates each to status='overdue', writes ClientActivityLog, and notifies
 * all admins for invoices overdue by 7+ days.
 *
 * Input: { dry_run?: boolean }
 * Schedule: daily 06:00 SAST (04:00 UTC)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function toSASTDateString() {
  const now = new Date();
  // SAST = UTC+2
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return sast.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const todayStr = toSASTDateString();

    // Fetch all 'sent' invoices
    const allSent = await base44.asServiceRole.entities.Invoice.filter({ status: "sent" });
    const sentList = Array.isArray(allSent) ? allSent : [];

    // Filter those with due_date < today
    const overdue = sentList.filter(inv => {
      if (!inv.due_date) return false;
      return inv.due_date < todayStr;
    });

    if (dryRun) {
      return Response.json({
        dry_run: true,
        would_update: overdue.length,
        invoices: overdue.map(i => ({
          id: i.id,
          invoice_number: i.invoice_number,
          client_name: i.client_name,
          due_date: i.due_date,
          days_overdue: Math.floor((new Date(todayStr) - new Date(i.due_date)) / (24 * 60 * 60 * 1000)),
        })),
      });
    }

    const updated = [];
    const notifiedAdmins = [];

    // Fetch all admins once for notifications
    let adminIds = [];
    try {
      const admins = await base44.asServiceRole.entities.AppUser.filter({ role: "admin" });
      adminIds = Array.isArray(admins) ? admins.map(u => u.id) : [];
    } catch (err) {
      console.error("[sweep-overdue-invoices] Admin fetch failed:", err);
    }

    for (const inv of overdue) {
      try {
        // Update invoice status
        await base44.asServiceRole.entities.Invoice.update(inv.id, { status: "overdue" });

        const daysOverdue = Math.floor((new Date(todayStr) - new Date(inv.due_date)) / (24 * 60 * 60 * 1000));

        // Write ClientActivityLog
        try {
          await base44.asServiceRole.entities.ClientActivityLog.create({
            client_id: inv.client_id,
            event_type: "invoice_overdue",
            event_category: "billing",
            event_label: `Invoice ${inv.invoice_number || inv.id.slice(0, 8)} marked overdue`,
            event_summary: `Invoice was ${daysOverdue} days past due date (${inv.due_date})`,
            metadata: { invoice_id: inv.id, invoice_number: inv.invoice_number, days_overdue: daysOverdue },
          });
        } catch (logErr) {
          console.error("[sweep-overdue-invoices] ActivityLog write failed:", logErr);
        }

        // Notify all admins if overdue 7+ days
        if (daysOverdue >= 7 && adminIds.length > 0) {
          for (const uid of adminIds) {
            try {
              await base44.asServiceRole.entities.ClientNotification.create({
                recipient_user_id: uid,
                client_id: inv.client_id || undefined,
                notification_type: "invoice_overdue",
                title: `Invoice overdue ${daysOverdue} days — ${inv.client_name || "Unknown"}`,
                body: `Invoice ${inv.invoice_number || inv.id.slice(0, 8)} for R${Number(inv.total_amount || inv.amount || 0).toFixed(2)} is ${daysOverdue} days overdue.`,
                related_entity_type: "Invoice",
                related_entity_id: inv.id,
                action_url: `/admin/invoices`,
                is_read: false,
              });
            } catch (notifErr) {
              console.error("[sweep-overdue-invoices] Admin notify failed:", notifErr);
            }
          }
          notifiedAdmins.push(inv.id);
        }

        updated.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          client_name: inv.client_name,
          days_overdue: daysOverdue,
        });
      } catch (err) {
        console.error(`[sweep-overdue-invoices] Failed to update invoice ${inv.id}:`, err);
      }
    }

    return Response.json({
      updated_count: updated.length,
      admin_notifications_sent: notifiedAdmins.length,
      updated,
    });
  } catch (err) {
    console.error("[sweep-overdue-invoices] Fatal error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});