import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

// =============================================================================
// PayFast checkout init — Step 6 of 10.
//
// Single server-side entry point for both checkout flows:
//   - Authenticated portal flow (/portal/checkout/:packageId)
//       client_id is derived from the session token; any client_id sent in the
//       request body is IGNORED. This is the security boundary that stops a
//       logged-in user from initiating a payment on behalf of another client.
//   - Anonymous prospect flow (/checkout/:packageId)
//       client_id is derived from email-based lookup-or-create on the Client
//       entity. New rows get status='lead', source='checkout'.
//
// On success this function:
//   1. Resolves the Client (session OR email-create).
//   2. Generates a unique m_payment_id.
//   3. Builds the signed PayFast field set (with custom_str2 = client_id).
//   4. Creates a Payment row with status='pending' (no invoice_id yet).
//   5. Returns { fields, process_url, m_payment_id, client_id }.
//
// PayFast signing rules (same as payfast-sign):
//   1. Take all form fields except `signature`.
//   2. Use PayFast's documented field order — NOT alphabetical.
//   3. URL-encode each value PHP-style (spaces → '+', uppercase hex).
//   4. Build query `key1=value1&key2=value2&...`.
//   5. Append `&passphrase=URL_ENCODED_PASSPHRASE`.
//   6. MD5 → 32 lowercase hex chars.
// =============================================================================

// Mirrored from src/config/payfastPackages.js — keep in sync with that file
// AND with base44/functions/payfast-sign/entry.ts until the catalogue moves
// to a DB table.
const PACKAGES: Array<{
  id: string;
  category: 'core' | 'addon' | 'test';
  name: string;
  description: string;
  amount: string;
  monthly_retainer: string;
  active?: boolean;
}> = [
  // Core
  { id: 'ignite',         category: 'core', name: 'Ignite Setup',                 description: 'Marketing iO Ignite package - one-time setup fee. R490/month retainer billed separately on debit order for 12 months.',                              amount: '3980.00', monthly_retainer: '490.00',  active: true },
  { id: 'accelerate',     category: 'core', name: 'Accelerate Setup',             description: 'Marketing iO Accelerate package - one-time setup fee. R890/month retainer billed separately on debit order for 12 months.',                          amount: '6500.00', monthly_retainer: '890.00',  active: true },
  { id: 'dominate',       category: 'core', name: 'Dominate Setup',               description: 'Marketing iO Dominate package - one-time setup fee. R1,490/month retainer billed separately on debit order for 12 months.',                          amount: '9800.00', monthly_retainer: '1490.00', active: true },
  { id: 'street-pulse',   category: 'core', name: 'Street Pulse Setup',           description: 'Marketing iO Street Pulse - flyer deployment campaign setup. R4,000/month retainer billed separately for the 3-month locked term.',                  amount: '700.00',  monthly_retainer: '4000.00', active: true },
  { id: 'township-pulse', category: 'core', name: 'Township Pulse',               description: 'Marketing iO Township Pulse - once-off township activation campaign. No monthly retainer.',                                                          amount: '2200.00', monthly_retainer: '0.00',    active: true },
  // Add-ons
  { id: 'ai-chatbot',              category: 'addon', name: 'AI Chatbot Setup',              description: 'AI-powered chatbot for your website. Setup fee includes configuration, training, and integration. R350/month maintenance billed separately.', amount: '6500.00', monthly_retainer: '350.00', active: true },
  { id: 'whatsapp-automation',     category: 'addon', name: 'WhatsApp Business Automation',  description: 'Automated WhatsApp Business setup with response flows and lead capture. R200/month maintenance billed separately.',                          amount: '3500.00', monthly_retainer: '200.00', active: true },
  { id: 'google-business-profile', category: 'addon', name: 'Google Business Profile Setup', description: 'Google Business Profile creation, verification, photos, and category setup. Once-off, no monthly fees.',                                     amount: '800.00',  monthly_retainer: '0.00',   active: true },
  { id: 'sms-marketing',           category: 'addon', name: 'SMS Marketing Setup',           description: 'SMS marketing platform setup and integration. R500/month base + per-SMS rate billed separately.',                                            amount: '500.00',  monthly_retainer: '500.00', active: true },
  { id: 'marketing-audit',         category: 'addon', name: 'Marketing Audit & Report',      description: 'Comprehensive marketing audit with detailed report and recommendations. Once-off deliverable.',                                              amount: '2000.00', monthly_retainer: '0.00',   active: true },
  { id: 'competitor-analysis',     category: 'addon', name: 'Competitor Analysis Report',    description: 'Detailed competitor analysis with market positioning insights. Once-off deliverable.',                                                       amount: '1500.00', monthly_retainer: '0.00',   active: true },
  { id: 'crm-training',            category: 'addon', name: 'CRM Training & Setup',          description: 'CRM platform training and initial setup for your team. Once-off deliverable.',                                                              amount: '3000.00', monthly_retainer: '0.00',   active: true },
  // Test
  { id: 'ignite-test',    category: 'test', name: 'Sandbox Test',                 description: 'R10 sandbox test transaction (DO NOT use in production).',                                                                                            amount: '10.00',   monthly_retainer: '0.00',    active: true },
];

// PayFast's documented 16-field order. DO NOT alphabetize.
const FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'custom_str1',
  'custom_str2',
  'custom_str3',
] as const;

const OPTIONAL_FIELDS = new Set([
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'item_description',
  'custom_str1',
  'custom_str2',
  'custom_str3',
]);

// Base44 entity SDK has been observed to return entity rows in any of three
// shapes:
//   - the row itself ({ id, ...fields })
//   - an array of rows ([{...}, {...}])
//   - an envelope ({ data: <row> } or { data: [<row>, ...] })
// Older `Array.isArray(x) ? x[0] : x` is wrong for the envelope shape: it
// would pick the envelope itself, leaving x.id undefined and causing silent
// downstream failures (which is exactly what we're hunting). These helpers
// pick the row regardless of shape.
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

// PHP-style urlencode equivalent.
//
// PayFast's reference signing implementation uses PHP's urlencode(). JS's
// encodeURIComponent() matches it for most characters but DOES NOT encode
// any of:  ! ' ( ) * ~  — PHP urlencode does. If any of those characters
// appear in any field value (e.g. parens in an item_description), our
// hash and PayFast's hash diverge and PayFast returns "signature mismatch".
// The replacements below close that gap.
//
// Test cases:
//   "Ignite Setup"                     → "Ignite+Setup"
//   "john@doe.com"                     → "john%40doe.com"
//   "Test & Co."                       → "Test+%26+Co."
//   "(DO NOT use in production)."      → "%28DO+NOT+use+in+production%29."
//   "It's *fast*!"                     → "It%27s+%2Afast%2A%21"
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

// Returns BOTH the canonical query string (for hashing) and the MD5 signature
// (for the signature field). The hash is what we persist as
// signed_payload_hash so step 7's ITN handler can detect tampering.
function buildSignedSet(
  fields: Record<string, string>,
  passphrase: string
): { queryString: string; signature: string } {
  const queryString = FIELD_ORDER
    .filter((key) => {
      const v = fields[key];
      return v !== undefined && v !== null && String(v).trim() !== '';
    })
    .map((key) => `${key}=${payfastUrlEncode(String(fields[key]).trim())}`)
    .join('&');

  const stringToHash = `${queryString}&passphrase=${payfastUrlEncode(passphrase)}`;
  const signature = createHash('md5').update(stringToHash).digest('hex');
  return { queryString, signature };
}

const MID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomToken(len: number): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += MID_ALPHABET[buf[i] % MID_ALPHABET.length];
  }
  return out;
}

function generateMPaymentId(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp =
    `${d.getUTCFullYear()}` +
    `${pad(d.getUTCMonth() + 1)}` +
    `${pad(d.getUTCDate())}` +
    `T` +
    `${pad(d.getUTCHours())}` +
    `${pad(d.getUTCMinutes())}` +
    `${pad(d.getUTCSeconds())}`;
  return `MIO-${stamp}-${randomToken(6)}`;
}

// Map a package to the Payment.type enum. Setup-fee packages with a retainer
// map to setup_fee (core) or addon_setup (add-ons). Once-offs map to
// once_off_product. Sandbox test rides on once_off_product too.
function mapPackageToPaymentType(
  pkg: { category: string; monthly_retainer: string }
): 'setup_fee' | 'addon_setup' | 'once_off_product' {
  const hasRetainer = Number(pkg.monthly_retainer) > 0;
  if (!hasRetainer) return 'once_off_product';
  return pkg.category === 'core' ? 'setup_fee' : 'addon_setup';
}

// Resolve the authenticated user's Client row. Returns null if anything is
// off (invalid token, expired session, no Client linked). Mirrors auth-me's
// AppUser-then-User lookup so it works for both client portal and staff
// sessions.
async function resolveSessionClient(base44: any, sessionToken: string) {
  if (!sessionToken) return null;

  let user: any = null;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({
      session_token: sessionToken,
    });
    user = unwrapOne(appUsers);
  } catch (err) {
    console.error('[payfast-checkout-init] AppUser session lookup failed:', err);
  }
  if (!user) {
    try {
      const legacy = await base44.asServiceRole.entities.User.filter({
        session_token: sessionToken,
      });
      user = unwrapOne(legacy);
    } catch (err) {
      console.error('[payfast-checkout-init] User session lookup failed:', err);
    }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return null;
  }

  // Find Client row linked to this user. Try client_user_id first (current
  // schema), fall back to app_user_id (older rows) and finally email.
  for (const filter of [
    { client_user_id: user.id },
    { app_user_id: user.id },
    user.email ? { email: String(user.email).toLowerCase().trim() } : null,
  ].filter(Boolean) as Array<Record<string, string>>) {
    try {
      const found = await base44.asServiceRole.entities.Client.filter(filter);
      const client = unwrapOne(found);
      if (client) return { client, user };
    } catch (err) {
      console.error('[payfast-checkout-init] Client lookup failed for', filter, err);
    }
  }
  return { client: null, user };
}

// Lookup-or-create a Client by email (lowercased + trimmed). New rows get
// status='lead' and source='checkout'.
async function lookupOrCreateClientByEmail(
  base44: any,
  emailLower: string,
  details: { name_first: string; name_last: string; cell: string; company: string }
) {
  if (!emailLower) return null;
  let client: any = null;
  try {
    const found = await base44.asServiceRole.entities.Client.filter({ email: emailLower });
    client = unwrapOne(found);
  } catch (err) {
    console.error('[payfast-checkout-init] Client.filter by email failed:', err);
  }

  if (client) return client;

  const fullName = [details.name_first, details.name_last].filter(Boolean).join(' ').trim();
  try {
    const created = await base44.asServiceRole.entities.Client.create({
      business_name:  details.company || fullName || emailLower,
      contact_person: fullName,
      email:          emailLower,
      phone:          details.cell,
      status:         'lead',
      source:         'checkout',
    });
    const row = unwrapOne(created);
    if (!row?.id) {
      console.error(
        '[payfast-checkout-init] Client.create returned malformed object:',
        created
      );
      return null;
    }
    return row;
  } catch (err) {
    console.error('[payfast-checkout-init] Client.create failed:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Read PayFast secrets. Passphrase NEVER returned to the browser.
  const merchantId  = Deno.env.get('PAYFAST_MERCHANT_ID');
  const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');
  const passphrase  = Deno.env.get('PAYFAST_PASSPHRASE');
  const returnUrl   = Deno.env.get('PAYFAST_RETURN_URL');
  const cancelUrl   = Deno.env.get('PAYFAST_CANCEL_URL');
  const notifyUrl   = Deno.env.get('PAYFAST_NOTIFY_URL');
  const processUrl  = Deno.env.get('PAYFAST_PROCESS_URL');

  const missing = Object.entries({
    PAYFAST_MERCHANT_ID:  merchantId,
    PAYFAST_MERCHANT_KEY: merchantKey,
    PAYFAST_PASSPHRASE:   passphrase,
    PAYFAST_RETURN_URL:   returnUrl,
    PAYFAST_CANCEL_URL:   cancelUrl,
    PAYFAST_NOTIFY_URL:   notifyUrl,
    PAYFAST_PROCESS_URL:  processUrl,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error('[payfast-checkout-init] missing secrets:', missing);
    return Response.json({ error: 'PayFast not configured', missing }, { status: 500 });
  }

  // Inputs.
  const packageId    = String(body?.package_id ?? '').trim();
  const nameFirst    = String(body?.name_first ?? '').trim();
  const nameLast     = String(body?.name_last ?? '').trim();
  const emailRaw     = String(body?.email_address ?? '').trim();
  const emailLower   = emailRaw.toLowerCase();
  const cellNumber   = String(body?.cell_number ?? '').trim();
  const companyName  = String(body?.company_name ?? '').trim();
  const sessionToken = String(body?.session_token ?? '').trim();
  // NOTE: any body.client_id is intentionally IGNORED. The server is the
  // sole source of truth for which client a payment belongs to.

  if (!packageId) {
    return Response.json({ error: 'package_id is required' }, { status: 400 });
  }

  const pkg = PACKAGES.find((p) => p.id === packageId);
  if (!pkg || pkg.active === false) {
    return Response.json(
      { error: `Unknown or inactive package_id: ${packageId}` },
      { status: 400 }
    );
  }
  if (!/^\d+\.\d{2}$/.test(pkg.amount)) {
    console.error('[payfast-checkout-init] invalid amount in PACKAGES catalogue:', pkg);
    return Response.json(
      { error: 'Server package catalogue has an invalid amount' },
      { status: 500 }
    );
  }

  // ---- Resolve the Client. Two flows. -------------------------------------
  let client: any = null;
  let flow: 'session' | 'email' = 'email';

  if (sessionToken) {
    flow = 'session';
    const resolved = await resolveSessionClient(base44, sessionToken);
    if (!resolved) {
      return Response.json(
        { error: 'Session expired or invalid. Please sign in again.' },
        { status: 401 }
      );
    }
    if (!resolved.client) {
      return Response.json(
        { error: 'Your account has no client record yet. Please contact support.' },
        { status: 403 }
      );
    }
    client = resolved.client;
  } else {
    if (!emailLower) {
      return Response.json(
        { error: 'email_address is required for anonymous checkout' },
        { status: 400 }
      );
    }
    client = await lookupOrCreateClientByEmail(base44, emailLower, {
      name_first: nameFirst,
      name_last:  nameLast,
      cell:       cellNumber,
      company:    companyName,
    });
    if (!client) {
      return Response.json(
        { error: 'Could not create or find your client record. Please try again.' },
        { status: 500 }
      );
    }
  }

  // Sanity-check we resolved a real Client.id. If not, log the raw shape for
  // ops triage and return a clean user-facing error.
  const clientId   = String(client?.id ?? '');
  const clientName = String(
    client?.business_name || client?.contact_person || emailLower || ''
  );

  if (!clientId) {
    console.error('[payfast-checkout-init] resolved Client has no id', { flow, client });
    return Response.json(
      { error: 'Could not resolve your client record. Please try again.' },
      { status: 500 }
    );
  }

  // ---- Build the signed PayFast field set ---------------------------------
  const mPaymentId = generateMPaymentId();

  const candidate: Record<string, string> = {
    merchant_id:      merchantId!,
    merchant_key:     merchantKey!,
    return_url:       returnUrl!,
    cancel_url:       cancelUrl!,
    notify_url:       notifyUrl!,
    name_first:       nameFirst,
    name_last:        nameLast,
    email_address:    emailRaw,
    cell_number:      cellNumber,
    m_payment_id:     mPaymentId,
    amount:           pkg.amount,
    item_name:        pkg.name,
    item_description: pkg.description,
    custom_str1:      pkg.id,
    custom_str2:      clientId,    // ← step 6: the real client_id
    custom_str3:      companyName,
  };

  const fields: Record<string, string> = {};
  for (const key of FIELD_ORDER) {
    const v = candidate[key];
    if (v === undefined || v === null) continue;
    if (OPTIONAL_FIELDS.has(key) && String(v).trim() === '') continue;
    fields[key] = String(v).trim();
  }

  const { queryString, signature } = buildSignedSet(fields, passphrase!);
  fields.signature = signature;

  // SHA-256 of the canonical query string (without passphrase). Step 7's
  // ITN handler compares this against a fresh hash of the incoming payload
  // to detect tampering or mismatched ID reuse.
  const signedPayloadHash = createHash('sha256').update(queryString).digest('hex');

  // ---- Persist the pending Payment row ------------------------------------
  // Built as a separate object so the catch block has the exact payload to
  // log if Base44 rejects the create. The user-facing error stays generic;
  // operators can see the full failure details in server logs.
  const paymentPayload: Record<string, unknown> = {
    client_id:           clientId,
    client_name:         clientName,
    amount:              Number(pkg.amount),
    currency:            'ZAR',
    type:                mapPackageToPaymentType(pkg),
    status:              'pending',
    gateway:             'payfast',
    gateway_reference:   mPaymentId,
    package_id:          pkg.id,
    signed_payload_hash: signedPayloadHash,
    commission_calculated: false,
  };

  try {
    await base44.asServiceRole.entities.Payment.create(paymentPayload);
  } catch (err: any) {
    // Log every part of the error Base44's SDK exposes (response.data, body,
    // cause, errors) so operators can diagnose from logs. Don't leak any of
    // it to the buyer's browser.
    console.error('[payfast-checkout-init] Payment.create failed', {
      payload: paymentPayload,
      error: {
        message:    err?.message,
        name:       err?.name,
        status:     err?.status ?? err?.response?.status,
        statusText: err?.statusText ?? err?.response?.statusText,
        data:       err?.response?.data ?? err?.data ?? err?.body ?? null,
        errors:     err?.errors ?? null,
        cause:      err?.cause ? String(err.cause) : null,
      },
    });
    return Response.json(
      { error: 'Could not record the pending payment. Please try again.' },
      { status: 500 }
    );
  }

  return Response.json({
    fields,
    process_url: processUrl,
    m_payment_id: mPaymentId,
    client_id: clientId,
    flow,
  });
});
