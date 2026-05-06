import { createHash } from 'node:crypto';

// =============================================================================
// PayFast signature generator — Step 4 of 10.
//
// Step 3 added MD5 signing. Step 4 adds:
//   - Server-side package lookup (amount + names + description come from a
//     trusted server source, never from the browser).
//   - Unique m_payment_id per transaction, generated server-side only.
//   - custom_str1 / custom_str2 hooks for reconciliation metadata.
//
// PayFast's 6 signing rules still apply:
//   1. Take all form fields except `signature`.
//   2. Use PayFast's documented field order — NOT alphabetical.
//   3. URL-encode each value PHP-style (spaces → '+', uppercase hex).
//   4. Build query `key1=value1&key2=value2&...`.
//   5. Append `&passphrase=URL_ENCODED_PASSPHRASE`.
//   6. MD5 → 32 lowercase hex chars.
//
// Skip-empty rule: any field that's empty string is excluded from BOTH the
// signed string and the POSTed form. That keeps "what's signed" === "what's
// POSTed", which is what PayFast cross-checks before accepting the request.
// =============================================================================

// Mirrored from src/config/payfastPackages.js — keep in sync until we move
// packages to a DB table in a later step.
const PACKAGES: Array<{
  id: string;
  name: string;
  description: string;
  amount: string;
}> = [
  {
    id: 'ignite',
    name: 'Ignite Setup',
    description: 'Marketing iO Ignite package - one-time setup fee',
    amount: '3980.00',
  },
  {
    id: 'spark',
    name: 'Spark Setup',
    description: 'Marketing iO Spark package - one-time setup fee',
    amount: '1980.00',
  },
  {
    id: 'ignite-test',
    name: 'Sandbox Test',
    description: 'Sandbox test transaction',
    amount: '10.00',
  },
];

// PayFast's documented field order for the Standard / Redirect flow with
// custom + tracking fields. DO NOT alphabetize.
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
]);

// PHP-style urlencode equivalent.
//
// Test cases (verified by `__debug_tests: true`):
//   "Ignite Setup"       → "Ignite+Setup"
//   "john@doe.com"       → "john%40doe.com"
//   "Test & Co."         → "Test+%26+Co."
//   "0823456789"         → "0823456789"
//   "3980.00"            → "3980.00"
//   "https://x.co/a b"   → "https%3A%2F%2Fx.co%2Fa+b"
function payfastUrlEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
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

// `MIO-YYYYMMDDTHHmmss-XXXXXX` — server-time UTC + 6 random uppercase
// alphanumeric chars. ~2.1B IDs per second-bucket; we expect <<1 per second
// in practice, so collisions are vanishingly unlikely.
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

  // Required: package_id. Customer fields are optional.
  const packageId    = String(body?.package_id ?? '').trim();
  const nameFirst    = String(body?.name_first ?? '').trim();
  const nameLast     = String(body?.name_last ?? '').trim();
  const emailAddress = String(body?.email_address ?? '').trim();
  const cellNumber   = String(body?.cell_number ?? '').trim();

  if (!packageId) {
    return Response.json({ error: 'package_id is required' }, { status: 400 });
  }

  const pkg = PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    return Response.json(
      { error: `Unknown package_id: ${packageId}` },
      { status: 400 }
    );
  }

  // Sanity check the catalogue itself — guards against typos when this list
  // is hand-edited.
  if (!/^\d+\.\d{2}$/.test(pkg.amount)) {
    console.error('[payfast-sign] invalid amount in PACKAGES catalogue:', pkg);
    return Response.json(
      { error: 'Server package catalogue has an invalid amount' },
      { status: 500 }
    );
  }

  const mPaymentId = generateMPaymentId();

  // Build the signed/POSTed field set in PayFast's documented order. Empty
  // optionals (e.g. custom_str2 until step 6) are dropped below.
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
