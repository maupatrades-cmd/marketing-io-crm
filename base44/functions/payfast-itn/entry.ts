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
// exact POST order PayFast sent them. PayFast's docs require the verifier to
// preserve the POST order rather than re-sort, so we walk the URLSearchParams
// in iteration order rather than ITN_FIELD_ORDER.
function buildSignatureString(
  params: URLSearchParams,
  passphrase: string
): string {
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'signature') continue;
    if (value === undefined || value === null || value === '') continue;
    pairs.push(`${key}=${payfastUrlEncode(String(value).trim())}`);
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
// confirmation. Expected response: literal "VALID".
async function postbackToPayFast(
  validateUrl: string,
  formBody: string
): Promise<string> {
  const res = await fetch(validateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
  });
  return (await res.text()).trim();
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
  const expectedSig = md5Hex(buildSignatureString(params, passphrase));
  if (expectedSig !== receivedSig) {
    console.error(
      `[payfast-itn] SECURITY: signature mismatch — m_payment_id=${mPaymentId}`
    );
    await recordSecurityEvent(base44, 'payment_signature_mismatch', emailAddress, sourceIp, {
      m_payment_id: mPaymentId,
      received_sig: receivedSig.slice(0, 16) + '…',
      expected_sig: expectedSig.slice(0, 16) + '…',
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
  }
}

// =============================================================================
// HTTP entry point — keep the response cycle tight.
// =============================================================================
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    // PayFast only ever POSTs. Anything else is bot/curl noise.
    return new Response('Method Not Allowed', { status: 405 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error('[payfast-itn] failed to read body:', err);
    // Still 200 — we don't want PayFast to retry a body we can't parse.
    return new Response('OK', { status: 200 });
  }

  const sourceIp  = clientIpFromRequest(req);
  const userAgent = req.headers.get('user-agent') ?? '';
  const base44    = createClientFromRequest(req);

  // Fire-and-forget — PayFast retries up to ~10 times if it doesn't see a
  // 200 within ~30s. Returning before validation completes keeps us under
  // that budget regardless of how slow the postback or DB writes are.
  // Errors inside processITN are logged inside the function; a top-level
  // .catch ensures one bad ITN can't crash the runtime.
  processITN(base44, rawBody, sourceIp, userAgent).catch((err) => {
    console.error('[payfast-itn] processITN crashed:', err);
  });

  return new Response('OK', { status: 200 });
});
