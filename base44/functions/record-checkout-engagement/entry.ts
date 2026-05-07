import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// record-checkout-engagement — Step 8 cleanup PR.
//
// The form-abandonment producer the abandoned-cart-runner has been waiting
// for. The runner reads CheckoutEngagement rows older than 1h that never
// converted to a Payment and promotes them into AbandonedCartSequence; this
// function is what writes those rows.
//
// Called fire-and-forget from src/pages/Checkout.jsx with a 2-second debounce
// after the buyer types a valid-looking email. Anonymous (no session) — buyers
// haven't signed in yet at checkout time.
//
// Behaviour:
//   - Strict input validation (email format, package_id, SA cell normalised).
//   - Upsert by (email, package_id): one row per (buyer, package) combo, the
//     `engagement_at` timestamp slides forward each time the form is touched.
//     We don't want hundreds of rows per checkout session.
//   - Skip if a Payment already exists for this email + package — they're
//     in flight, not abandoning.
//   - converted_to_payment is left at its default (false). It flips later
//     when payfast-checkout-init creates a Payment.
//
// Defence:
//   - Per-IP rate limit (60 reqs / 5 min) is generous — debounced writes
//     from a normal session land 1-3 rows. Anything beyond is a flood.
//   - All output goes through asServiceRole; the entity is not exposed to
//     anonymous SDK callers directly.
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SA_CELL     = /^0[6-8]\d{8}$/;

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

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX       = 60;

const ipHits: Map<string, number[]> = new Map();

function clientIpFrom(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('cf-connecting-ip')?.trim() ||
    'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (ipHits.get(ip) || []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) {
    ipHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipHits.set(ip, recent);
  return false;
}

function lowerTrim(value: any): string {
  return String(value ?? '').trim().toLowerCase();
}

function trim(value: any): string {
  return String(value ?? '').trim();
}

// Mirrors Checkout.jsx — strip spaces/dashes/parens, drop a leading +,
// then convert a leading 27 to 0. Yields canonical 0XXXXXXXXX form.
function normaliseCell(raw: any): string {
  const stripped = String(raw ?? '').replace(/[\s\-()]+/g, '').replace(/^\+/, '');
  if (/^27\d{9}$/.test(stripped)) return '0' + stripped.slice(2);
  return stripped;
}

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'use POST' }, { status: 405 });
  }

  const ip = clientIpFrom(req);
  if (isRateLimited(ip)) {
    return Response.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email     = lowerTrim(body?.email);
  const packageId = trim(body?.package_id);
  const cellRaw   = trim(body?.cell_number);
  const cell      = cellRaw ? normaliseCell(cellRaw) : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    return Response.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!packageId || !RECOVERABLE_PACKAGE_IDS.has(packageId)) {
    // Sandbox / unknown packages — silently no-op so the front-end doesn't
    // surface validation errors for legitimate buyers on test SKUs.
    return Response.json({ skipped: true, reason: 'package_not_recoverable' });
  }
  if (cell && !SA_CELL.test(cell)) {
    // Cell is optional at engagement-write time; only validate when given.
    return Response.json({ error: 'invalid_cell' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  // Skip if a Payment already exists for this email + package — the buyer
  // is in flight, not abandoning. We don't want to seed the form-abandoned
  // sweep with rows that have a live payment attempt behind them.
  try {
    const clients = unwrapList(
      await base44.asServiceRole.entities.Client.filter({ email })
    );
    for (const c of clients) {
      const payments = unwrapList(
        await base44.asServiceRole.entities.Payment.filter({
          client_id:  c?.id,
          package_id: packageId,
        })
      );
      if (payments.length) {
        return Response.json({ skipped: true, reason: 'payment_exists' });
      }
    }
  } catch (err) {
    // Lookup failure is non-fatal — falling through to the upsert is still
    // correct behaviour (worst case the runner's own findSuccessfulPaymentForBuyer
    // dedupes downstream).
    console.error('[record-checkout-engagement] payment-exists check failed:', err);
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    email,
    name_first:    trim(body?.name_first),
    name_last:     trim(body?.name_last),
    cell_number:   cell,
    company_name:  trim(body?.company_name),
    package_id:    packageId,
    engagement_at: now,
  };

  // Upsert: one row per (email, package_id). Slide engagement_at forward
  // on every touch.
  let existing: any = null;
  try {
    const list = unwrapList(
      await base44.asServiceRole.entities.CheckoutEngagement.filter({
        email,
        package_id: packageId,
      })
    );
    existing = list[0] || null;
  } catch (err) {
    console.error('[record-checkout-engagement] CheckoutEngagement.filter failed:', err);
  }

  try {
    if (existing?.id) {
      await base44.asServiceRole.entities.CheckoutEngagement.update(existing.id, payload);
      return Response.json({ updated: true, id: existing.id });
    }
    const created = await base44.asServiceRole.entities.CheckoutEngagement.create({
      ...payload,
      converted_to_payment: false,
    });
    const createdRow = (created as any)?.id ? created : (created as any)?.data;
    return Response.json({ created: true, id: createdRow?.id ?? null });
  } catch (err) {
    console.error('[record-checkout-engagement] write failed:', err);
    return Response.json({ error: 'write_failed' }, { status: 500 });
  }
});
