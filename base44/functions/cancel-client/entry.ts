/**
 * cancel-client
 * Cancels a client: flips status, cancels unpaid invoices, logs activity,
 * notifies all admins.
 *
 * Input: { token, client_id, reason }
 * Auth: owner or admin only
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { client_id, reason } = body;

    if (!client_id) {
      return Response.json({ error: "client_id is required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!["owner", "admin"].includes(user.role)) {
      return Response.json({ error: "Forbidden: owner or admin only" }, { status: 403 });
    }

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;
    if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

    // Idempotency
    if (["cancelled", "churned"].includes(client.status)) {
      return Response.json({ skipped: true, current_status: client.status });
    }

    // Update client
    await base44.asServiceRole.entities.Client.update(client_id, {
      status: "cancelled",
      deactivated_at: new Date().toISOString(),
      cancellation_reason: reason || "",
    });

    // Cancel unpaid invoices
    const allInvoices = await base44.asServiceRole.entities.Invoice.filter({ client_id });
    const invoiceList = Array.isArray(allInvoices) ? allInvoices : [];
    const cancelledInvoices = [];

    for (const inv of invoiceList) {
      if (inv.status === "sent") {
        try {
          await base44.asServiceRole.entities.Invoice.update(inv.id, {
            status: "cancelled",
            notes: `${inv.notes ? inv.notes + " | " : ""}Cancelled: Client cancelled`,
          });
          cancelledInvoices.push(inv.id);
        } catch (err) {
          console.error(`[cancel-client] Invoice cancel failed for ${inv.id}:`, err);
        }
      }
    }

    // Log activity
    try {
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id,
        event_type: "client_cancelled",
        event_category: "account",
        event_label: `Client cancelled`,
        event_summary: `${client.business_name} cancelled. Reason: ${reason || "Not specified"}. ${cancelledInvoices.length} invoice(s) also cancelled.`,
        metadata: { reason, cancelled_invoices: cancelledInvoices, cancelled_by: user.id },
      });
    } catch (logErr) {
      console.error("[cancel-client] ActivityLog failed:", logErr);
    }

    // Notify all admins
    try {
      const admins = await base44.asServiceRole.entities.AppUser.filter({ role: "admin" });
      const adminList = Array.isArray(admins) ? admins : [];
      for (const admin of adminList) {
        await base44.asServiceRole.entities.ClientNotification.create({
          recipient_user_id: admin.id,
          client_id,
          notification_type: "client_cancelled",
          title: `Client cancelled: ${client.business_name}`,
          body: `${client.business_name} has been cancelled. Reason: ${reason || "Not specified"}. ${cancelledInvoices.length} invoice(s) cancelled.`,
          related_entity_type: "Client",
          related_entity_id: client_id,
          action_url: `/clients/${client_id}`,
          is_read: false,
        });
      }
    } catch (notifErr) {
      console.error("[cancel-client] Admin notify failed:", notifErr);
    }

    return Response.json({
      success: true,
      client_id,
      status: "cancelled",
      cancelled_invoices: cancelledInvoices,
    });
  } catch (err) {
    console.error("[cancel-client] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});