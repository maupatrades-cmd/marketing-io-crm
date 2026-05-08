/**
 * reactivate-client
 * Reactivates a cancelled client within the 30-day grace window.
 * Owner only. Refuses if client is churned.
 *
 * Input: { token, client_id }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { client_id } = body;

    if (!client_id) {
      return Response.json({ error: "client_id is required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "owner") {
      return Response.json({ error: "Forbidden: owner only" }, { status: 403 });
    }

    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;
    if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

    // Idempotency
    if (client.status === "active") {
      return Response.json({ skipped: true, current_status: "active" });
    }

    // Refuse if churned
    if (client.status === "churned") {
      return Response.json({
        error: "Cannot reactivate a churned client. Post-grace data may have been archived. Contact the owner for a manual data-console reset.",
        current_status: "churned",
      }, { status: 409 });
    }

    if (client.status !== "cancelled") {
      return Response.json({ error: `Client is not in cancelled status (current: ${client.status})` }, { status: 409 });
    }

    // Reactivate
    await base44.asServiceRole.entities.Client.update(client_id, {
      status: "active",
      deactivated_at: null,
      cancellation_reason: null,
    });

    // Log activity
    try {
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id,
        event_type: "client_reactivated",
        event_category: "account",
        event_label: `Client reactivated`,
        event_summary: `${client.business_name} was reactivated by ${user.full_name || user.email}`,
        metadata: { reactivated_by: user.id },
      });
    } catch (logErr) {
      console.error("[reactivate-client] ActivityLog failed:", logErr);
    }

    return Response.json({ success: true, client_id, status: "active" });
  } catch (err) {
    console.error("[reactivate-client] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});