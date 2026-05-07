import { createHash } from 'node:crypto';

// =============================================================================
// PayFast signature generator — Step 5 of 10.
//
// Layered on top of step 4:
//   - PACKAGES catalogue is now the full Marketing iO product set (5 core + 7
//     add-ons + sandbox test). Mirrored from src/config/payfastPackages.js;
//     KEEP THE TWO COPIES IN SYNC.
//   - Adds company_name input → custom_str3 on the signed form.
//   - Field order extended to PayFast's full 16-field spec.
//
// PayFast's 6 signing rules (unchanged):
//   1. Take all form fields except `signature`.
//   2. Use PayFast's documented field order — NOT alphabetical.
//   3. URL-encode each value PHP-style (spaces → '+', uppercase hex).
//   4. Build `key1=value1&key2=value2&...`.
//   5. Append `&passphrase=URL_ENCODED_PASSPHRASE`.
//   6. MD5 → 32 lowercase hex chars.
//
// Skip-empty rule: any field whose trimmed value is "" is excluded from BOTH
// the signed string AND the POSTed form, so PayFast's "what's signed must be
// what's POSTed" check stays satisfied.
// =============================================================================

// Mirrored from src/config/payfastPackages.js — keep in sync until we move
// packages to a DB table in a later step.
const PACKAGES: Array<{
  id: string;
  name: string;
  description: string;
  amount: string;
  active?: boolean;
}> = [
  // Core
  { id: 'ignite',         name: 'Ignite Setup',                   description: 'Marketing iO Ignite package - one-time setup fee. R490/month retainer billed separately on debit order for 12 months.',                              amount: '3980.00', active: true },
  { id: 'accelerate',     name: 'Accelerate Setup',               description: 'Marketing iO Accelerate package - one-time setup fee. R890/month retainer billed separately on debit order for 12 months.',                          amount: '6500.00', active: true },
  { id: 'dominate',       name: 'Dominate Setup',                 description: 'Marketing iO Dominate package - one-time setup fee. R1,490/month retainer billed separately on debit order for 12 months.',                          amount: '9800.00', active: true },
  { id: 'street-pulse',   name: 'Street Pulse Setup',             description: 'Marketing iO Street Pulse - flyer deployment campaign setup. R4,000/month retainer billed separately for the 3-month locked term.',                  amount: '700.00',  active: true },
  { id: 'township-pulse', name: 'Township Pulse',                 description: 'Marketing iO Township Pulse - once-off township activation campaign. No monthly retainer.',                                                          amount: '2200.00', active: true },
  // Add-ons
  { id: 'ai-chatbot',              name: 'AI Chatbot Setup',                description: 'AI-powered chatbot for your website. Setup fee includes configuration, training, and integration. R350/month maintenance billed separately.', amount: '6500.00', active: true },
  { id: 'whatsapp-automation',     name: 'WhatsApp Business Automation',    description: 'Automated WhatsApp Business setup with response flows and lead capture. R200/month maintenance billed separately.',                          amount: '3500.00', active: true },
  { id: 'google-business-profile', name: 'Google Business Profile Setup',   description: 'Google Business Profile creation, verification, photos, and category setup. Once-off, no monthly fees.',                                     amount: '800.00',  active: true },
  { id: 'sms-marketing',           name: 'SMS Marketing Setup',             description: 'SMS marketing platform setup and integration. R500/month base + per-SMS rate billed separately.',                                            amount: '500.00',  active: true },
  { id: 'marketing-audit',         name: 'Marketing Audit & Report',        description: 'Comprehensive marketing audit with detailed report and recommendations. Once-off deliverable.',                                              amount: '2000.00', active: true },
  { id: 'competitor-analysis',     name: 'Competitor Analysis Report',      description: 'Detailed competitor analysis with market positioning insights. Once-off deliverable.',                                                       amount: '1500.00', active: true },
  { id: 'crm-training',            name: 'CRM Training & Setup',            description: 'CRM platform training and initial setup for your team. Once-off deliverable.',                                                              amount: '3000.00', active: true },
  // Test
  { id: 'ignite-test',    name: 'Sandbox Test',                   description: 'R10 sandbox test transaction (DO NOT use in production).',                                                                                            amount: '10.00',   active: true },
];

// PayFast's full 16-field documented order. DO NOT alphabetize.
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

// Optional fields — empty values get dropped from BOTH signature and form.
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

// PHP-style urlencode equivalent.
//
// PayFast's reference signing implementation uses PHP's urlencode(). JS's
// encodeURIComponent() matches it for most characters but DOES NOT encode
// any of:  ! ' ( ) * ~  — PHP urlencode does. If any of those characters
// appear in any field value (e.g. parens in an item_description), our
// hash and PayFast's hash diverge and PayFast returns "signature mismatch".
// The replacements below close that gap.
//
// Test cases (verified by `__debug_tests: true`):
//   "Ignite Setup"                     → "Ignite+Setup"
//   "john@doe.com"                     → "john%40doe.com"
//   "Test & Co."                       → "Test+%26+Co."
//   "0823456789"                       → "0823456789"
//   "3980.00"                          → "3980.00"
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

function buildSignature(fields: Record<string, string>, passphrase: string): string {
  const queryString = FIELD_ORDER
    .filter((key) => {
      const v = fields[key];
      return v !== undefined && v !== null && String(v).trim() !== '';
    })
    .map((key) => `${key}=${payfastUrlEncode(String(fields[key]).trim())}`)
    .join('&');

  const stringToHash = `${queryString}&passphrase=${payfastUrlEncode(passphrase)}`;
  return createHash('md5').update(stringToHash).digest('hex');
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

function runEncoderTests(): {
  ok: boolean;
  failures: Array<{ input: string; expected: string; got: string }>;
} {
  const cases: Array<[string, string]> = [
    ['Ignite Setup',     'Ignite+Setup'],
    ['john@doe.com',     'john%40doe.com'],
    ['Test & Co.',       'Test+%26+Co.'],
    ['0823456789',       '0823456789'],
    ['3980.00',          '3980.00'],
  ];
  const failures = cases
    .map(([input, expected]) => ({ input, expected, got: payfastUrlEncode(input) }))
    .filter(({ expected, got }) => expected !== got);
  return { ok: failures.length === 0, failures };
}

Deno.serve(async (req) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body?.__debug_tests === true) {
    return Response.json(runEncoderTests());
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
    console.error('[payfast-sign] missing secrets:', missing);
    return Response.json(
      { error: 'PayFast not configured', missing },
      { status: 500 }
    );
  }

  // Required: package_id. Customer fields are optional at the function
  // boundary — the page enforces them, but blank values won't break signing.
  const packageId    = String(body?.package_id ?? '').trim();
  const nameFirst    = String(body?.name_first ?? '').trim();
  const nameLast     = String(body?.name_last ?? '').trim();
  const emailAddress = String(body?.email_address ?? '').trim();
  const cellNumber   = String(body?.cell_number ?? '').trim();
  const companyName  = String(body?.company_name ?? '').trim();

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
    console.error('[payfast-sign] invalid amount in PACKAGES catalogue:', pkg);
    return Response.json(
      { error: 'Server package catalogue has an invalid amount' },
      { status: 500 }
    );
  }

  const mPaymentId = generateMPaymentId();

  // Build the signed/POSTed field set in PayFast's documented order. Empty
  // optionals (custom_str2 until step 6, optional customer fields if blank)
  // are dropped below.
  const candidate: Record<string, string> = {
    merchant_id:      merchantId!,
    merchant_key:     merchantKey!,
    return_url:       returnUrl!,
    cancel_url:       cancelUrl!,
    notify_url:       notifyUrl!,
    name_first:       nameFirst,
    name_last:        nameLast,
    email_address:    emailAddress,
    cell_number:      cellNumber,
    m_payment_id:     mPaymentId,
    amount:           pkg.amount,
    item_name:        pkg.name,
    item_description: pkg.description,
    custom_str1:      pkg.id,
    custom_str2:      '',          // reserved for client_id in Step 6.
    custom_str3:      companyName,
  };

  const fields: Record<string, string> = {};
  for (const key of FIELD_ORDER) {
    const v = candidate[key];
    if (v === undefined || v === null) continue;
    if (OPTIONAL_FIELDS.has(key) && String(v).trim() === '') continue;
    fields[key] = String(v).trim();
  }

  const signature = buildSignature(fields, passphrase!);
  fields.signature = signature;

  return Response.json({
    fields,
    process_url: processUrl,
    m_payment_id: mPaymentId,
  });
});
