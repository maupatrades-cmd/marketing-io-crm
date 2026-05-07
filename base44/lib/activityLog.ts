// =============================================================================
// activityLog.ts — canonical ClientActivityLog write helper.
//
// IMPORTANT — Base44 deployment constraint:
//   Each base44/functions/<name>/entry.ts is packaged as an isolated Deno
//   deployment. Functions CANNOT import from sibling paths like base44/lib/.
//   This file therefore acts as a source-of-truth reference: humans read it,
//   PR descriptions cite it, the catalog of event types is defined here.
//   At runtime, each consumer inlines a small ~15-line copy of the write
//   logic. See log-client-activity-public/entry.ts for the canonical shape.
//
// Used by every server function that performs a client-touching action. PR A
// of the Client Portal upgrade introduces this helper; PRs B-G extend the
// event_type catalog (see CATALOG below) without changing the helper itself.
//
// Design rules:
//   1. Failures must NEVER break the calling flow. Every write is wrapped in
//      a try/catch that logs to console.error and returns silently.
//   2. Helper writes BOTH the new fields (event_summary, event_category,
//      actor_role, etc.) AND the legacy fields (event_label, logged_by,
//      logged_by_name) so existing consumers of ClientActivityLog keep
//      working.
//   3. event_type is free-form string. The catalog below is documentation
//      only — JSON Schema does not constrain it.
// =============================================================================

// -- Event type catalog -------------------------------------------------------
// All event_types currently wired (PR A). Extend as PRs B-G add new actions.
// Keeping this in one place so the activity feed UI knows what to expect and
// the PDF generator can label categories consistently.
export const ACTIVITY_EVENT_TYPES = {
  // auth
  ACCOUNT_CREATED:           'account_created',
  LOGIN_SUCCESS:             'login_success',
  LOGIN_FAILED:              'login_failed',
  PASSWORD_CHANGED:          'password_changed',
  PASSWORD_RESET_REQUESTED:  'password_reset_requested',
  PASSWORD_RESET_COMPLETED:  'password_reset_completed',
  // profile
  PROFILE_UPDATED:           'profile_updated',
  EMAIL_CHANGED:             'email_changed',
  PHONE_CHANGED:             'phone_changed',
  // payment
  PAYMENT_INITIATED:         'payment_initiated',
  PAYMENT_SUCCEEDED:         'payment_succeeded',
  PAYMENT_FAILED:            'payment_failed',
  PAYMENT_CANCELLED:         'payment_cancelled',
  // invoice
  INVOICE_ISSUED:            'invoice_issued',
  INVOICE_VIEWED:            'invoice_viewed',
  INVOICE_CANCELLED_BY_CLIENT: 'invoice_cancelled_by_client',
  INVOICE_PAID:              'invoice_paid',
  // document
  DOCUMENT_UPLOADED:         'document_uploaded',
  BANK_LETTER_UPLOADED:      'bank_letter_uploaded',
  STATEMENT_DOWNLOADED:      'statement_downloaded',
  // communication
  MESSAGE_SENT_BY_CLIENT:    'message_sent_by_client',
  MESSAGE_RECEIVED_BY_CLIENT: 'message_received_by_client',
  // support
  SUPPORT_REQUEST_OPENED:    'support_request_opened',
  // account
  ACCOUNT_DEACTIVATED:       'account_deactivated',
  ACCOUNT_REACTIVATED:       'account_reactivated',
} as const;

// -- Types --------------------------------------------------------------------
export type ActorRole =
  | 'client' | 'admin' | 'owner' | 'cpc'
  | 'field_agent' | 'head_of_tech' | 'driver' | 'system';

export type EventCategory =
  | 'auth' | 'profile' | 'payment' | 'invoice'
  | 'document' | 'communication' | 'support' | 'account';

export interface ActivityLogParams {
  clientId:        string;
  actorId?:        string | null;
  actorRole:       ActorRole;
  actorName?:      string | null;
  eventType:       string;
  eventCategory:   EventCategory;
  eventSummary:    string;
  eventMetadata?:  Record<string, unknown>;
  ipAddress?:      string | null;
  userAgent?:      string | null;
  // Optional snapshot of Client.business_name or contact_person — frozen on
  // the row so audit history survives Client renames. If omitted the helper
  // looks it up.
  clientName?:     string | null;
}

// -- Helper -------------------------------------------------------------------
//
// Usage from a server function:
//
//   import { logClientActivity } from '@/lib/activityLog';
//   await logClientActivity(base44, {
//     clientId,
//     actorId:       userId,
//     actorRole:     'admin',
//     actorName:     'Admin Smith',
//     eventType:     'invoice_issued',
//     eventCategory: 'invoice',
//     eventSummary:  `Invoice ${invoiceNumber} issued for R${amount}`,
//     eventMetadata: { invoice_id, amount, currency: 'ZAR' },
//   });
//
// Returns void. Never throws — caller's flow is preserved on failure.
// =============================================================================
export async function logClientActivity(
  base44: any,
  params: ActivityLogParams,
): Promise<void> {
  try {
    const {
      clientId, actorId = null, actorRole, actorName = null,
      eventType, eventCategory, eventSummary, eventMetadata = {},
      ipAddress = null, userAgent = null,
    } = params;

    if (!clientId) {
      console.error('[activityLog] clientId is required — skipping write');
      return;
    }

    // Snapshot client_name if not supplied. Best-effort lookup so we never
    // block the caller on a slow Client.filter.
    let clientName = params.clientName ?? null;
    if (!clientName) {
      try {
        const result = await base44.asServiceRole.entities.Client.filter({ id: clientId });
        const list = Array.isArray(result) ? result : (result?.data ?? []);
        const c = list?.[0];
        if (c) clientName = String(c.business_name || c.contact_person || '').trim() || null;
      } catch {
        // Non-fatal — proceed without the name.
      }
    }

    const row: Record<string, unknown> = {
      client_id:      clientId,
      client_name:    clientName || '',
      actor_id:       actorId || '',
      actor_role:     actorRole,
      event_type:     eventType,
      event_category: eventCategory,
      event_summary:  eventSummary,
      event_metadata: eventMetadata,
      // Legacy back-compat mirrors. Old consumers query event_label /
      // logged_by / logged_by_name; new code reads event_summary /
      // actor_id / actor_name. Writing both keeps everyone happy.
      event_label:    eventSummary,
      logged_by:      actorId || '',
      logged_by_name: actorName || '',
    };
    if (ipAddress) row.ip_address = ipAddress.slice(0, 64);
    if (userAgent) row.user_agent = userAgent.slice(0, 500);

    await base44.asServiceRole.entities.ClientActivityLog.create(row);
  } catch (err) {
    // Failures must never break the calling flow.
    console.error('[activityLog] write failed:', err);
  }
}

// -- Convenience: derive actor info from a session-token payload --------------
// Used by log-client-activity-public to avoid duplicating the AppUser→User
// fallback every call. Returns { userId, role, fullName } on a valid session
// or null if the token is missing/invalid.
export async function deriveActorFromSessionToken(
  base44: any,
  token: string | null | undefined,
): Promise<{ userId: string; role: string; fullName: string } | null> {
  if (!token) return null;
  let user: any = null;
  try {
    const list = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    user = (Array.isArray(list) ? list : list?.data ?? [])[0] || null;
  } catch {
    // Try legacy User next.
  }
  if (!user) {
    try {
      const list = await base44.asServiceRole.entities.User.filter({ session_token: token });
      user = (Array.isArray(list) ? list : list?.data ?? [])[0] || null;
    } catch {
      return null;
    }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) return null;
  return {
    userId:   String(user.id || ''),
    role:     String(user.role || 'client'),
    fullName: String(user.full_name || user.email || ''),
  };
}
