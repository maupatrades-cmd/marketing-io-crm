import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// abandoned-cart-trigger — Step 8 PR E.1.
//
// Called by:
//   - payfast-itn (when ITN reports payment_status = FAILED / CANCELLED)
//   - payfast-mark-cancelled (when buyer hits PayFast's cancel_url)
//   - abandoned-cart-runner (PR E.2, when the scheduled scan promotes a
//     stuck-pending Payment or a stale CheckoutEngagement)
//
// What it does (the only thing it does):
//   1. Validate inputs.
//   2. Skip ignite-test and any package not in our copy table — sandbox
//      transactions don't need recovery emails.
//   3. Dedup against existing AbandonedCartSequence rows for the same
//      email + package_id within a 24h window (idempotent against the
//      same ITN being delivered to both payfast-itn and the
//      mark-cancelled redirect path).
//   4. Create one AbandonedCartSequence row in `abandoned_at: now`,
//      `unsubscribed: false`, no email sent yet.
//   5. Return JSON: { sequence_id, created | reused | skipped, reason }.
//
// What it does NOT do:
//   - Send emails. The 15-min runner picks up the row and sends email_1
//     after the brief's 5-minute cooling-off window.
//   - Generate images. Same — the runner does that lazily on first send.
//   - Write to Payment / Client. Those are owned by the upstream callers.
// =============================================================================

const ABANDONMENT_TYPES = new Set(['cancel_button', 'tab_closed', 'form_abandoned']);

// Mirrored from src/config/abandonedCartCopy.js — the 12 active products.
// ignite-test is intentionally absent so test transactions don't trigger a
// recovery sequence.
const RECOVERABLE_PACKAGE_IDS = new Set([
  'ignite',
  'accelerate',
  'dominate',
  'street-pulse',
  'township-pulse',
  'ai-chatbot',
  'whatsapp-automation',
  'google-business-profile',
  'sms-marketing',
  'marketing-audit',
  'competitor-analysis',
  'crm-training',
]);

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function lowerTrim(value: any): string {
  return String(value ?? '').trim().toLowerCase();
}

// 32-byte URL-safe random token used as the unsubscribe link's `token` query
// param. Distinct from the row id so a buyer can't unsubscribe someone else's
// sequence by guessing/incrementing ids.
function generateUnsubscribeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'use POST' }, { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email            = lowerTrim(body?.email_address);
  const packageId        = String(body?.package_id ?? '').trim();
  const abandonmentType  = String(body?.abandonment_type ?? '').trim();
  const clientId         = String(body?.client_id ?? '').trim();
  const mPaymentId       = String(body?.m_payment_id ?? '').trim();
  const paymentId        = String(body?.payment_id ?? '').trim();
  const nameFirst        = String(body?.name_first ?? '').trim();

  // Validation. Required fields are package_id and abandonment_type.
  // email is also required because the entire system is email-driven; if
  // we don't have one we can't recover.
  if (!packageId) {
    return Response.json(
      { error: 'package_id is required', skipped: true, reason: 'no_package_id' },
      { status: 400 }
    );
  }
  if (!ABANDONMENT_TYPES.has(abandonmentType)) {
    return Response.json(
      {
        error: 'abandonment_type must be one of cancel_button, tab_closed, form_abandoned',
        skipped: true,
        reason: 'invalid_abandonment_type',
      },
      { status: 400 }
    );
  }

  const base44 = createClientFromRequest(req);

  // If the caller didn't pass an email but did pass a Payment.id or
  // Client.id, try to back-fill the email from there. This is the path
  // payfast-mark-cancelled takes — it doesn't have email_address in the
  // cancel_url redirect.
  let resolvedEmail = email;
  let resolvedNameFirst = nameFirst;
  if (!resolvedEmail && paymentId) {
    try {
      const payments = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
      const payment = unwrapList(payments)[0];
      const ipnEmail = lowerTrim(payment?.ipn_payload?.email_address);
      const ipnFirst = String(payment?.ipn_payload?.name_first ?? '').trim();
      if (ipnEmail) resolvedEmail = ipnEmail;
      if (ipnFirst && !resolvedNameFirst) resolvedNameFirst = ipnFirst;
      // Prefer the Client row's email/name if Payment had a client_id.
      if (payment?.client_id) {
        const clients = await base44.asServiceRole.entities.Client.filter({ id: payment.client_id });
        const client = unwrapList(clients)[0];
        if (client?.email) resolvedEmail = lowerTrim(client.email);
        if (client?.contact_person && !resolvedNameFirst) {
          resolvedNameFirst = String(client.contact_person).split(/\s+/)[0] || '';
        }
      }
    } catch (err) {
      console.error('[abandoned-cart-trigger] back-fill from Payment failed:', err);
    }
  }

  if (!resolvedEmail) {
    console.log(
      `[abandoned-cart-trigger] skipped — no email available, ` +
      `package_id=${packageId}, abandonment_type=${abandonmentType}`
    );
    return Response.json(
      { skipped: true, reason: 'no_email_address' },
      { status: 200 }
    );
  }

  // Sandbox / unrecognised packages: skip silently. The runner only ships
  // copy for the 12 active products.
  if (!RECOVERABLE_PACKAGE_IDS.has(packageId)) {
    console.log(
      `[abandoned-cart-trigger] skipped — package not recoverable, ` +
      `package_id=${packageId}, email=${resolvedEmail}`
    );
    return Response.json(
      { skipped: true, reason: 'package_not_recoverable', package_id: packageId },
      { status: 200 }
    );
  }

  // Dedup. If a sequence for this email + package already exists within
  // the last 24h, reuse it instead of creating a duplicate. Multiple
  // signals (cancel button + ITN-CANCELLED hitting the same buyer) MUST
  // not produce two recovery sequences for the same abandonment.
  let existing: any = null;
  try {
    const found = await base44.asServiceRole.entities.AbandonedCartSequence.filter({
      email: resolvedEmail,
      package_id: packageId,
    });
    const list = unwrapList(found);
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    existing = list.find((row: any) => {
      const at = row?.abandoned_at ? new Date(row.abandoned_at).getTime() : 0;
      return at >= cutoff && !row?.recovered_at;
    });
  } catch (err) {
    console.error('[abandoned-cart-trigger] dedup query failed:', err);
    // Non-fatal — proceed to create. Worst case we end up with a near-
    // duplicate sequence; the runner's per-email rate limit absorbs it.
  }

  if (existing?.id) {
    console.log(
      `[abandoned-cart-trigger] reused existing sequence — id=${existing.id}, ` +
      `email=${resolvedEmail}, package_id=${packageId}`
    );
    return Response.json(
      {
        sequence_id: existing.id,
        reused:      true,
        skipped:     false,
        reason:      'recent_existing_sequence',
      },
      { status: 200 }
    );
  }

  // Create the sequence.
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    email:             resolvedEmail,
    name_first:        resolvedNameFirst,
    package_id:        packageId,
    abandonment_type:  abandonmentType,
    abandoned_at:      now,
    unsubscribed:      false,
    unsubscribe_token: generateUnsubscribeToken(),
  };
  if (clientId)   payload.client_id    = clientId;
  if (mPaymentId) payload.m_payment_id = mPaymentId;
  if (paymentId)  payload.payment_id   = paymentId;

  let created: any;
  try {
    created = await base44.asServiceRole.entities.AbandonedCartSequence.create(payload);
  } catch (err) {
    console.error('[abandoned-cart-trigger] AbandonedCartSequence.create failed:', err);
    return Response.json(
      { error: 'create_failed' },
      { status: 500 }
    );
  }

  const createdRow = created?.id ? created : created?.data;
  console.log(
    `[abandoned-cart-trigger] created sequence — id=${createdRow?.id}, ` +
    `email=${resolvedEmail}, package_id=${packageId}, ` +
    `abandonment_type=${abandonmentType}`
  );

  return Response.json({
    sequence_id: createdRow?.id ?? null,
    created:     true,
    email:       resolvedEmail,
    package_id:  packageId,
  });
});
