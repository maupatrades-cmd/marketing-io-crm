/**
 * notify-staff
 * Helper backend function: writes a ClientNotification row for one or more
 * staff/admin recipients. Called by other backend functions (not frontend).
 *
 * Input:
 *   { recipient_user_ids: string[], type, title, body, action_url?,
 *     related_client_id?, related_entity_type?, related_entity_id? }
 *   OR
 *   { notify_all_admins: true, ... } — resolves all AppUser rows with role='admin'
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const {
      recipient_user_ids,
      notify_all_admins,
      type = "system_update",
      title,
      body: notifBody,
      action_url,
      related_client_id,
      related_entity_type,
      related_entity_id,
    } = body;

    if (!title || !notifBody) {
      return Response.json({ error: "title and body are required" }, { status: 400 });
    }

    let userIds = Array.isArray(recipient_user_ids) ? recipient_user_ids : [];

    if (notify_all_admins) {
      try {
        const admins = await base44.asServiceRole.entities.AppUser.filter({ role: "admin" });
        const adminList = Array.isArray(admins) ? admins : [];
        userIds = [...new Set([...userIds, ...adminList.map(u => u.id)])];
      } catch (err) {
        console.error("[notify-staff] Failed to fetch admins:", err);
      }
    }

    if (userIds.length === 0) {
      return Response.json({ skipped: true, reason: "no_recipients" });
    }

    const created = [];
    for (const uid of userIds) {
      try {
        const row = await base44.asServiceRole.entities.ClientNotification.create({
          recipient_user_id: uid,
          client_id: related_client_id || undefined,
          notification_type: type,
          title,
          body: notifBody,
          related_entity_type: related_entity_type || undefined,
          related_entity_id: related_entity_id || undefined,
          action_url: action_url || undefined,
          is_read: false,
        });
        created.push(row.id);
      } catch (err) {
        console.error(`[notify-staff] Failed for user ${uid}:`, err);
      }
    }

    return Response.json({ created_count: created.length, ids: created });
  } catch (err) {
    console.error("[notify-staff] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});