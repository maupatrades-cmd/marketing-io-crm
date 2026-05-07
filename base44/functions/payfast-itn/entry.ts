import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

// =============================================================================
// PayFast ITN handler — Step 7 of 10.
//
// PayFast POSTs an Instant Transaction Notification to this endpoint after
// the buyer interacts with the hosted checkout. We must:
//   1. Acknowledge with HTTP 200 quickly (or PayFast retries up to ~10 times).
//   2. Run four security checks:
//        a) MD5 signature equality
//        b) Source IP in PayFast's published ranges
//        c) Server-side postback to PayFast's /eng/query/validate → 'VALID'
//        d) amount_gross + tracking fields match the pending Payment row
//   3. Be idempotent — a duplicate ITN must not double-update.
//   4. Update Payment.status, snapshot the raw payload, mark the Client as
//      a paying customer if this is the success path.
//
// The handler responds 200 in every code path, including security failures.
// PayFast treats non-200 as a retry signal; we don't want bot/replay traffic
// to keep us busy. Failures are logged + recorded as SecurityEvent rows for
// audit, but never leaked back to the caller.
// =============================================================================

// PayFast's documented ITN field order. Used for canonical hashing of the
// incoming payload (Check 4 + the postback body — but for the postback we
// preserve the literal POST order received). DO NOT alphabetize.
const ITN_FIELD_ORDER = [
  'm_payment_id',
  'pf_payment_id',
  'payment_status',
  'item_name',
  'item_description',
  'amount_gross',
  'amount_fee',
  'amount_net',
  'custom_str1',
  'custom_str2',
  'custom_str3',
  'custom_str4',
  'custom_str5',
  'custom_int1',
  'custom_int2',
  'custom_int3',
  'custom_int4',
  'custom_int5',
  'name_first',
  'name_last',
  'email_address',
  'merchant_id',
] as const;

// PHP-style urlencode equivalent (matches payfast-checkout-init).
// JS encodeURIComponent leaves ! ' ( ) * ~ unencoded; PHP urlencode encodes
// them. PayFast uses PHP's encoding for signature math, so we must too.
function payfastUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/!/g,  '%21')
    .replace(/'/g,  '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g,  '%7E');
}

// Build the canonical query string from the *received* ITN field set, in the
// exact POST order PayFast sent them.
//
// IMPORTANT: this is INTENTIONALLY different from the outbound signing in
// payfast-checkout-init. Two rules differ:
//   1. Empty values are NOT skipped. PayFast's PHP reference iterates
//      $_POST and signs every key except `signature`, regardless of
//      whether the value is empty. If we skip empties our hash diverges.
//   2. Values are NOT trimmed. PayFast computed its hash over the raw
//      bytes it sent us; we must reproduce those exact bytes.
// Outbound signing trims + skips empties (correct, because we control the
// payload and PayFast verifies what they receive). Inbound verification
// must preserve every byte PayFast posted to us.
function buildSignatureString(
  params: URLSearchParams,
  passphrase: string
): string {
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'signature') continue;
    pairs.push(`${key}=${payfastUrlEncode(value)}`);
  }
  return `${pairs.join('&')}&passphrase=${payfastUrlEncode(passphrase)}`;
}

function md5Hex(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// Source-IP cache. Resolved DNS lookups for PayFast's ITN-source hostnames
// expire after 1 hour. Module-level state survives between invocations on
// warm function instances.
const PAYFAST_HOSTNAMES = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
];

// Known PayFast production source IPs. Used as a fallback if DNS lookups
// fail entirely — without this we'd fail-open and accept any source IP.
// These IPs are PayFast's published list and historically stable.
const PAYFAST_PROD_IPS_FALLBACK = [
  '197.97.145.144', '197.97.145.145',
  '41.74.179.194',  '41.74.179.195',  '41.74.179.196',  '41.74.179.197',
  '41.74.179.200',  '41.74.179.201',  '41.74.179.203',  '41.74.179.204',
  '41.74.179.210',  '41.74.179.211',
];

const IP_CACHE_TTL_MS = 60 * 60 * 1000;
let ipCache: { expiresAt: number; ips: Set<string> } | null = null;

async function getAllowedPayfastIps(): Promise<Set<string>> {
  const now = Date.now();
  if (ipCache && ipCache.expiresAt > now) return ipCache.ips;

  const ips = new Set<string>(PAYFAST_PROD_IPS_FALLBACK);
  await Promise.all(
    PAYFAST_HOSTNAMES.map(async (host) => {
      try {
        const records = await Deno.resolveDns(host, 'A');
        for (const ip of records) ips.add(ip);
      } catch (err) {
        console.error(`[payfast-itn] DNS resolve failed for ${host}:`, err);
      }
    })
  );

  ipCache = { expiresAt: now + IP_CACHE_TTL_MS, ips };
  return ips;
}

function clientIpFromRequest(req: Request): string {
  // Base44 sits behind a proxy, so the trusted source IP is in
  // X-Forwarded-For (first hop) or X-Real-IP / Forwarded headers.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const fwd = req.headers.get('forwarded');
  if (fwd) {
    const m = fwd.match(/for=([^;,\s]+)/i);
    if (m) return m[1].replace(/^"?\[?|\]?"?$/g, '');
  }
  return 'unknown';
}

// POST the same form-encoded body back to PayFast for server-side
// confirmation. Expected response: literal "VALID". 10s timeout via
// AbortController so a hung connection can't keep the whole handler waiting.
async function postbackToPayFast(
  validateUrl: string,
  formBody: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
      signal: controller.signal,
    });
    return (await res.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

function chooseValidateUrl(processUrl: string | undefined): string {
  // Mirror logic from payfast-checkout-init: derive the validate URL from
  // the configured process URL so sandbox/live always agree.
  if (processUrl && processUrl.includes('sandbox.payfast.co.za')) {
    return 'https://sandbox.payfast.co.za/eng/query/validate';
  }
  return 'https://www.payfast.co.za/eng/query/validate';
}

// PayFast → Base44 status mapping.
function mapItnStatusToPaymentStatus(
  itnStatus: string
): 'successful' | 'failed' | 'cancelled' | null {
  switch (itnStatus) {
    case 'COMPLETE':  return 'successful';
    case 'FAILED':    return 'failed';
    case 'CANCELLED': return 'cancelled';
    case 'PENDING':   return null; // do nothing yet
    default:          return null;
  }
}

// Defensive Base44 SDK return-shape unwrapper (single row).
function unwrapOne(result: any): any {
  if (result == null) return null;
  if (Array.isArray(result)) return result[0] ?? null;
  if (typeof result === 'object') {
    if (result.id) return result;
    const inner = (result as any).data;
    if (Array.isArray(inner)) return inner[0] ?? null;
    if (inner && typeof inner === 'object' && inner.id) return inner;
  }
  return null;
}

// Best-effort SecurityEvent record. Failure here is non-fatal.
async function recordSecurityEvent(
  base44: any,
  eventType: string,
  email: string,
  ipAddress: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await base44.asServiceRole.entities.SecurityEvent.create({
      event_type: eventType,
      email:      email || 'unknown@payfast-itn',
      ip_address: ipAddress || '',
      details:    JSON.stringify(details).slice(0, 4000),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[payfast-itn] SecurityEvent.create failed:', err);
  }
}

// =============================================================================
// Background processor — runs after we 200 PayFast.
// =============================================================================
async function processITN(
  base44: any,
  rawBody: string,
  sourceIp: string,
  userAgent: string
): Promise<void> {
  const params = new URLSearchParams(rawBody);

  // Snapshot the full payload as a plain object for audit / DB write.
  const payloadObj: Record<string, string> = {};
  for (const [k, v] of params.entries()) payloadObj[k] = v;

  const mPaymentId   = String(params.get('m_payment_id') ?? '').trim();
  const pfPaymentId  = String(params.get('pf_payment_id') ?? '').trim();
  const paymentStatus = String(params.get('payment_status') ?? '').trim();
  const amountGross  = String(params.get('amount_gross') ?? '').trim();
  const customStr1   = String(params.get('custom_str1') ?? '').trim();
  const customStr2   = String(params.get('custom_str2') ?? '').trim();
  const customStr3   = String(params.get('custom_str3') ?? '').trim();
  const emailAddress = String(params.get('email_address') ?? '').trim();
  const receivedSig  = String(params.get('signature') ?? '').trim();

  console.log(
    `[payfast-itn] received: m_payment_id=${mPaymentId}, ` +
    `pf_payment_id=${pfPaymentId}, status=${paymentStatus}, ` +
    `amount_gross=${amountGross}, source_ip=${sourceIp}`
  );

  if (!mPaymentId) {
    console.error('[payfast-itn] payload missing m_payment_id, dropping');
    return;
  }

  // Read secrets.
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') || '';
  const processUrl = Deno.env.get('PAYFAST_PROCESS_URL') || '';
  if (!passphrase || !processUrl) {
    console.error(
      '[payfast-itn] PAYFAST_PASSPHRASE or PAYFAST_PROCESS_URL not set — ' +
      'cannot validate ITN'
    );
    return;
  }

  // ---- Check 1: signature ------------------------------------------------
  const sigString    = buildSignatureString(params, passphrase);
  const expectedSig  = md5Hex(sigString);
  if (expectedSig !== receivedSig) {
    // Diagnostic: capture the field names + lengths that went into the
    // hash, plus the canonical sigString WITHOUT the passphrase tail.
    // Lengths only — we never log raw values that might leak PII or the
    // passphrase. This lets us spot trim/empty/encoding divergences on
    // the next mismatch without re-deploying.
    const fieldShape: Record<string, number> = {};
    for (const [k, v] of params.entries()) {
      if (k === 'signature') continue;
      fieldShape[k] = v.length;
    }
    const sigStringNoPassphrase = sigString.replace(
      /&passphrase=[^&]*$/,
      '&passphrase=…'
    );
    console.error(
      `[payfast-itn] SECURITY: signature mismatch — m_payment_id=${mPaymentId}`
    );
    await recordSecurityEvent(base44, 'payment_signature_mismatch', emailAddress, sourceIp, {
      m_payment_id:    mPaymentId,
      received_sig:    receivedSig.slice(0, 16) + '…',
      expected_sig:    expectedSig.slice(0, 16) + '…',
      field_shape:     fieldShape,
      sig_string_len:  sigString.length,
      sig_string_head: sigStringNoPassphrase.slice(0, 800),
      passphrase_set:  Boolean(passphrase),
      passphrase_len:  passphrase.length,
    });
    return;
  }
  console.log('[payfast-itn] signature OK');

  // ---- Check 2: source IP -----------------------------------------------
  const allowedIps = await getAllowedPayfastIps();
  // Sandbox uses dynamic IPs that won't necessarily resolve from the
  // canonical hostnames — log but don't reject in sandbox so dev testing
  // works. Production rejects.
  const isSandbox = processUrl.includes('sandbox.payfast.co.za');
  if (!isSandbox && allowedIps.size > 0 && !allowedIps.has(sourceIp)) {
    console.error(
      `[payfast-itn] SECURITY: source IP rejected — ip=${sourceIp}, ` +
      `m_payment_id=${mPaymentId}`
    );
    await recordSecurityEvent(base44, 'payment_ip_rejected', emailAddress, sourceIp, {
      m_payment_id: mPaymentId,
      source_ip:    sourceIp,
      allowed_count: allowedIps.size,
    });
    return;
  }
  if (isSandbox && allowedIps.size > 0 && !allowedIps.has(sourceIp)) {
    console.log(
      `[payfast-itn] sandbox: source IP ${sourceIp} not in resolved set ` +
      `(allowed=${allowedIps.size}) — skipping enforcement`
    );
  }

  // ---- Check 3: server-side postback ------------------------------------
  const validateUrl = chooseValidateUrl(processUrl);
  let postbackResp = '';
  try {
    postbackResp = await postbackToPayFast(validateUrl, rawBody);
  } catch (err) {
    console.error('[payfast-itn] postback to PayFast failed:', err);
    await recordSecurityEvent(base44, 'payment_postback_invalid', emailAddress, sourceIp, {
      m_payment_id: mPaymentId,
      reason:       'fetch_failed',
      error:        String((err as Error)?.message ?? err),
    });
    return;
  }
  if (postbackResp !== 'VALID') {
    console.error(
      `[payfast-itn] SECURITY: PayFast postback returned ${postbackResp || '(empty)'}`
    );
    await recordSecurityEvent(base44, 'payment_postback_invalid', emailAddress, sourceIp, {
      m_payment_id: mPaymentId,
      response:     postbackResp.slice(0, 200),
    });
    return;
  }

  // ---- Look up the pending Payment row ----------------------------------
  let payment: any = null;
  try {
    const found = await base44.asServiceRole.entities.Payment.filter({
      gateway_reference: mPaymentId,
    });
    payment = unwrapOne(found);
  } catch (err) {
    console.error(
      `[payfast-itn] Payment lookup failed for m_payment_id=${mPaymentId}:`,
      err
    );
    return;
  }
  if (!payment?.id) {
    console.error(
      `[payfast-itn] no Payment row for m_payment_id=${mPaymentId} — ignoring`
    );
    return;
  }

  // ---- Idempotency: drop duplicates on already-final rows ---------------
  if (payment.status === 'successful') {
    console.log(
      `[payfast-itn] duplicate ignored — m_payment_id=${mPaymentId}, ` +
      `Payment already successful`
    );
    return;
  }
  if (
    payment.gateway_pf_payment_id &&
    pfPaymentId &&
    payment.gateway_pf_payment_id === pfPaymentId &&
    payment.status !== 'pending'
  ) {
    console.log(
      `[payfast-itn] duplicate ignored — m_payment_id=${mPaymentId}, ` +
      `pf_payment_id already recorded with status=${payment.status}`
    );
    return;
  }

  // ---- Check 4a: amount equality ----------------------------------------
  const expectedAmount = Number(payment.amount);
  const receivedAmount = Number(amountGross);
  if (
    !Number.isFinite(expectedAmount) ||
    !Number.isFinite(receivedAmount) ||
    Math.abs(expectedAmount - receivedAmount) > 0.005
  ) {
    console.error(
      `[payfast-itn] SECURITY: amount mismatch — expected=${expectedAmount}, ` +
      `received=${receivedAmount}, m_payment_id=${mPaymentId}`
    );
    await recordSecurityEvent(base44, 'payment_amount_mismatch', emailAddress, sourceIp, {
      m_payment_id:    mPaymentId,
      expected_amount: expectedAmount,
      received_amount: receivedAmount,
    });
    return;
  }

  // ---- Check 4b: tracking-field equality (lightweight tamper check) -----
  // The signed_payload_hash in step 6 was computed over the OUTBOUND signed
  // query (which includes secrets like merchant_key + URLs not echoed in the
  // ITN). It can't be byte-equal to anything we can recompute from the ITN.
  // Instead we verify that the fields PayFast echoes back match what we
  // stored on the Payment row. Same tamper-detection effect, with concrete
  // field-level equality checks.
  const trackingMismatches: string[] = [];
  if (customStr1 && payment.package_id && customStr1 !== payment.package_id) {
    trackingMismatches.push(
      `custom_str1 expected="${payment.package_id}" got="${customStr1}"`
    );
  }
  if (customStr2 && payment.client_id && customStr2 !== payment.client_id) {
    trackingMismatches.push(
      `custom_str2 expected="${payment.client_id}" got="${customStr2}"`
    );
  }
  if (trackingMismatches.length) {
    console.error(
      `[payfast-itn] SECURITY: payload hash mismatch — m_payment_id=${mPaymentId} — ${trackingMismatches.join('; ')}`
    );
    await recordSecurityEvent(base44, 'payment_hash_mismatch', emailAddress, sourceIp, {
      m_payment_id:        mPaymentId,
      tracking_mismatches: trackingMismatches,
    });
    return;
  }

  // ---- Map PayFast status to our enum, then update -----------------------
  const newStatus = mapItnStatusToPaymentStatus(paymentStatus);
  if (newStatus === null) {
    console.log(
      `[payfast-itn] non-final payment_status="${paymentStatus}" — leaving ` +
      `Payment as ${payment.status}, no update`
    );
    return;
  }
  if (payment.status !== 'pending' && newStatus !== payment.status) {
    console.log(
      `[payfast-itn] Payment.status=${payment.status} blocks transition to ` +
      `${newStatus} — m_payment_id=${mPaymentId}`
    );
    return;
  }

  const updates: Record<string, unknown> = {
    status:                 newStatus,
    gateway_pf_payment_id:  pfPaymentId || payment.gateway_pf_payment_id || '',
    gateway_payment_status: paymentStatus,
    ipn_payload:            payloadObj,
  };
  if (newStatus === 'successful') {
    updates.completed_at = new Date().toISOString();
  }
  if (newStatus === 'failed') {
    updates.failed_reason =
      String(params.get('failed_reason') ?? '').trim() || `PayFast: ${paymentStatus}`;
  }

  try {
    await base44.asServiceRole.entities.Payment.update(payment.id, updates);
  } catch (err) {
    console.error(
      `[payfast-itn] Payment.update failed — m_payment_id=${mPaymentId}:`,
      err
    );
    return;
  }

  console.log(
    `[payfast-itn] payment ${newStatus} — m_payment_id=${mPaymentId}, ` +
    `client_id=${payment.client_id}, amount=${expectedAmount}`
  );

  // ---- Downstream: only on successful path -------------------------------
  if (newStatus === 'successful') {
    // Promote the Client out of lead/prospect status; mark setup fee paid.
    try {
      const clients = await base44.asServiceRole.entities.Client.filter({
        id: payment.client_id,
      });
      const client = unwrapOne(clients);
      if (client?.id) {
        const clientUpdates: Record<string, unknown> = {
          setup_fee_paid:   true,
          setup_fee_amount: expectedAmount,
        };
        if (client.status === 'lead' || client.status === 'prospect') {
          clientUpdates.status = 'active';
        }
        await base44.asServiceRole.entities.Client.update(client.id, clientUpdates);
      } else {
        console.error(
          `[payfast-itn] Client.id=${payment.client_id} not found when ` +
          `promoting after success — m_payment_id=${mPaymentId}`
        );
      }
    } catch (err) {
      console.error('[payfast-itn] Client promotion failed:', err);
      // Non-fatal; Payment row is already correct.
    }

    // Audit trail.
    await recordSecurityEvent(base44, 'payment_completed', emailAddress, sourceIp, {
      m_payment_id:  mPaymentId,
      pf_payment_id: pfPaymentId,
      payment_id:    payment.id,
      client_id:     payment.client_id,
      amount:        expectedAmount,
      package_id:    customStr1 || payment.package_id || '',
    });

    // Trigger commission calculation. Wrapped in try/catch — a failure here
    // (calculate-commission unreachable, schema error, etc.) MUST NOT break
    // the ITN flow. The Payment row is already in its terminal state and the
    // SecurityEvent audit row is already written; the worst case is that
    // commission_calculated stays false and we re-trigger via a manual
    // recalc or scheduled job.
    //
    // We await the invoke even though the brief described it as
    // "fire-and-forget" — Base44's serverless runtime drops un-awaited
    // promises (the same lesson that broke step 7's processITN until PR #38
    // awaited it). A pure fire-and-forget here would silently never run.
    // Idempotency comes from calculate-commission's existing
    // `commission_calculated` flag on Payment, so re-triggers are safe and
    // we don't add a second guard.
    try {
      await base44.functions.invoke('calculate-commission', {
        payment_id: payment.id,
      });
      console.log(
        `[payfast-itn] commission triggered for payment_id=${payment.id}`
      );
    } catch (err) {
      console.error(
        `[payfast-itn] commission trigger failed for payment_id=${payment.id}:`,
        err
      );
      // Non-fatal — do not return.
    }

    // Buyer receipt email (PR D). Wrapped in try/catch — same rationale as
    // the commission trigger above. If Resend is misconfigured or the
    // function errors, the Payment row is already final and the buyer
    // already saw "Payment Successful" on the success page; the worst
    // outcome is they don't get an email and we can resend manually.
    try {
      await base44.functions.invoke('payfast-send-receipt', {
        payment_id: payment.id,
      });
      console.log(
        `[payfast-itn] receipt sent for payment_id=${payment.id}`
      );
    } catch (err) {
      console.error(
        `[payfast-itn] receipt send failed for payment_id=${payment.id}:`,
        err
      );
      // Non-fatal — do not return.
    }
  }

  // ---- Failed / cancelled paths: trigger abandoned-cart recovery ---------
  // Mirrors the success path's commission trigger. abandoned-cart-trigger
  // is implemented in PR E; until then this invoke will fail and the
  // try/catch absorbs it without disturbing the ITN flow.
  if (newStatus === 'failed' || newStatus === 'cancelled') {
    try {
      await base44.functions.invoke('abandoned-cart-trigger', {
        m_payment_id:     mPaymentId,
        payment_id:       payment.id,
        // PR E's abandonment_type enum is { cancel_button, tab_closed,
        // form_abandoned }. ITN-driven FAILED/CANCELLED both map to
        // cancel_button — the buyer reached PayFast and the transaction
        // ended without a successful charge, regardless of who pulled
        // the plug. PR E may want to add a 'gateway_failed' value if
        // it cares to distinguish.
        abandonment_type: 'cancel_button',
        client_id:        payment.client_id,
        package_id:       customStr1 || payment.package_id || '',
        email_address:    emailAddress,
        name_first:       String(params.get('name_first') ?? '').trim(),
        source:           'itn_handler',
        itn_status:       newStatus,
      });
      console.log(
        `[payfast-itn] abandoned-cart trigger for payment_id=${payment.id}, status=${newStatus}`
      );
    } catch (err) {
      console.error(
        `[payfast-itn] abandoned-cart trigger failed for payment_id=${payment.id}:`,
        err
      );
    }
  }
}

// =============================================================================
// HTTP entry point.
//
// Awaits processITN to completion before returning 200. Earlier "fire and
// forget" pattern was dropped by Base44's serverless runtime — the response
// returned, the function instance was killed, and the validation+DB-write
// promise never ran. processITN typically completes in 2-5s (signature →
// IP check → 10s-bounded postback to PayFast → DB writes), well under
// PayFast's ~30s retry threshold.
// =============================================================================
const HANDLER_VERSION = 'step7-await-v1';

Deno.serve(async (req) => {
  // First line of every invocation. Confirms the function is reachable and
  // tells us in Base44 logs which build is live.
  console.log(
    `[payfast-itn] hit: method=${req.method}, url=${req.url}, ` +
    `version=${HANDLER_VERSION}`
  );

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error('[payfast-itn] failed to read body:', err);
    return new Response('OK', { status: 200 });
  }

  const sourceIp  = clientIpFromRequest(req);
  const userAgent = req.headers.get('user-agent') ?? '';
  const base44    = createClientFromRequest(req);

  try {
    await processITN(base44, rawBody, sourceIp, userAgent);
  } catch (err) {
    // Any uncaught failure inside processITN is swallowed here. PayFast
    // still gets 200 — failures are logged + recorded as SecurityEvent
    // rows inside processITN where possible.
    console.error('[payfast-itn] processITN crashed:', err);
  }

  return new Response('OK', { status: 200 });
});
