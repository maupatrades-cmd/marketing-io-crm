import { base44 } from "@/api/base44Client";

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