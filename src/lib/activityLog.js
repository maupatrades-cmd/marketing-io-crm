// =============================================================================
// activityLog.js — frontend ClientActivityLog write helper.
//
// PR A of the Client Portal upgrade. Used by client-side actions (button
// clicks, form submits in the portal) to record activity. Calls the public
// bridge function log-client-activity-public, which validates the request
// server-side and writes the row.
//
// Design rules:
//   1. Fire-and-forget. The await is optional. Failures don't block UI.
//   2. The session token is read from localStorage (the existing customAuth
//      convention) and forwarded so the bridge can derive actor_id without
//      trusting client-supplied identity.
//   3. Network failures swallow silently — the activity feed is "best
//      effort" and a transient outage shouldn't surface to the user.
// =============================================================================

import { base44 } from '@/api/base44Client';

const SESSION_KEY = 'mio_session_token';

/**
 * Log a client activity from the browser.
 *
 * @param {object} params
 * @param {string} params.clientId        FK Client (the user's own Client.id)
 * @param {string} params.eventType       Catalog string (e.g. 'invoice_viewed')
 * @param {string} params.eventCategory   One of: auth, profile, payment,
 *                                        invoice, document, communication,
 *                                        support, account
 * @param {string} params.eventSummary    Short human-readable line
 * @param {object} [params.eventMetadata] Event-specific JSON (defaults to {})
 * @returns {Promise<void>}
 */
export async function logClientActivityFromBrowser({
  clientId,
  eventType,
  eventCategory,
  eventSummary,
  eventMetadata = {},
}) {
  if (!clientId || !eventType || !eventCategory || !eventSummary) {
    console.warn('[activityLog] missing required params, skipping log');
    return;
  }

  const token = (() => {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
  })();

  try {
    await base44.functions.invoke('log-client-activity-public', {
      token,
      client_id:      clientId,
      event_type:     eventType,
      event_category: eventCategory,
      event_summary:  eventSummary,
      event_metadata: eventMetadata,
    });
  } catch (err) {
    // Best-effort logging. Never disrupt the user's flow.
    console.warn('[activityLog] write failed:', err);
  }
}
