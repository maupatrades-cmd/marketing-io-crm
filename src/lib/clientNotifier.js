import { base44 } from "@/api/base44Client";

/**
 * Notify a client (portal user). Keeps client_id required, no recipient_user_id.
 */
export async function notifyClient({ clientId, type, title, body, relatedEntityType, relatedEntityId, actionUrl }) {
  if (!clientId) {
    console.warn("[notifyClient] clientId missing");
    return;
  }
  try {
    await base44.entities.ClientNotification.create({
      client_id: clientId,
      notification_type: type,
      title,
      body,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      action_url: actionUrl,
      is_read: false,
    });
  } catch (err) {
    console.error("[notifyClient] Failed to create notification:", err);
  }
}

/**
 * Notify a staff/admin user. recipient_user_id is required; client_id is optional context.
 */
export async function notifyStaff({ recipientUserId, type, title, body, actionUrl, relatedClientId, relatedEntityType, relatedEntityId }) {
  if (!recipientUserId) {
    console.warn("[notifyStaff] recipientUserId missing");
    return;
  }
  try {
    await base44.entities.ClientNotification.create({
      recipient_user_id: recipientUserId,
      client_id: relatedClientId || undefined,
      notification_type: type || "system_update",
      title,
      body,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      action_url: actionUrl,
      is_read: false,
    });
  } catch (err) {
    console.error("[notifyStaff] Failed to create notification:", err);
  }
}