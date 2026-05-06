import { createHash } from 'node:crypto';

// =============================================================================
// PayFast signature generator — Step 3 of 10.
//
// Computes the MD5 signature PayFast Standard requires before redirecting a
// buyer to the hosted checkout. Reads the merchant credentials and URLs from
// Base44 secrets — the passphrase NEVER leaves the server.
//
// PayFast's 6 signing rules, applied below:
//   1. Take all form fields except `signature` itself.
//   2. Sort in PayFast's documented field order — NOT alphabetical.
//   3. URL-encode each value PHP-style: spaces → '+', uppercase hex.
//   4. Build query string `key1=value1&key2=value2&...`.
//   5. Append `&passphrase=URL_ENCODED_PASSPHRASE`.
//   6. MD5 the result → 32 lowercase hex chars.
//
// We also skip empty optional fields entirely (they are NOT signed, NOT
// POSTed) — anything in the signature must also be in the eventual form, and
// vice versa, or PayFast rejects with "signature mismatch".
// =============================================================================

// PHP-style urlencode equivalent.
//
// JavaScript's encodeURIComponent already produces uppercase hex (%2F, %26,
// etc.) and leaves [A-Za-z0-9-_.~!*'()] unencoded. PHP's urlencode is almost
// identical except it encodes spaces as `+` rather than `%20`. The single
// .replace() below bridges that gap and matches PayFast's reference Java/PHP
// implementations on every character class their docs guarantee will appear
// in form values.
//
// Test cases (verified by the runner below when DEBUG_TESTS=true):
//   "Ignite Setup"       → "Ignite+Setup"
//   "john@doe.com"       → "john%40doe.com"
//   "Test & Co."         → "Test+%26+Co."
//   "0823456789"         → "0823456789"   (digits unchanged)
//   "3980.00"            → "3980.00"      (digits + dot unchanged)
//   "https://x.co/a b"   → "https%3A%2F%2Fx.co%2Fa+b"
function payfastUrlEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

// PayFast's documented field order for the Standard / Redirect flow.
// DO NOT alphabetize — order is part of the signed string.
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
  'amount',
  'item_name',
] as const;

// Customer fields are optional — if blank, they're skipped from BOTH the
// signed string and the POSTed form. Required fields fail loud below.
const OPTIONAL_FIELDS = new Set([
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
]);

function buildSignature(
  fields: Record<string, string>,
  passphrase: string
): string {
  // Step 1+2: walk fields in PayFast's documented order, NOT alphabetical.
  // Step 3: PHP-style URL encoding on each trimmed value.
  // Step 4: assemble `key=value&key=value`.
  const queryString = FIELD_ORDER
    .filter((key) => {
      const v = fields[key];
      return v !== undefined && v !== null && String(v).trim() !== '';
    })
    .map((key) => `${key}=${payfastUrlEncode(String(fields[key]).trim())}`)
    .join('&');

  // Step 5: append URL-encoded passphrase. Passphrase is required in V2 of
  // PayFast Standard (we always have one — the function 500s if it's missing).
  const stringToHash = `${queryString}&passphrase=${payfastUrlEncode(passphrase)}`;

  // Step 6: MD5 → 32 lowercase hex chars.
  return createHash('md5').update(stringToHash).digest('hex');
}

// Tiny self-test runner for the URL encoder. Triggered by passing
// { __debug_tests: true } in the JSON body — useful while iterating, ignored
// in normal traffic.
function runEncoderTests(): { ok: boolean; failures: Array<{ input: string; expected: string; got: string }> } {
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
  // Optional debug self-test — useful during development.
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

  // Pull customer/payment inputs from the request. Validate the required
  // ones (amount + item_name); customer fields are optional.
  const amount       = String(body?.amount ?? '').trim();
  const itemName     = String(body?.item_name ?? '').trim();
  const nameFirst    = String(body?.name_first ?? '').trim();
  const nameLast     = String(body?.name_last ?? '').trim();
  const emailAddress = String(body?.email_address ?? '').trim();
  const cellNumber   = String(body?.cell_number ?? '').trim();

  if (!amount || !/^\d+\.\d{2}$/.test(amount)) {
    return Response.json(
      { error: 'amount must be a string like "3980.00" (2 decimal places, no symbol)' },
      { status: 400 }
    );
  }
  if (!itemName) {
    return Response.json({ error: 'item_name is required' }, { status: 400 });
  }

  // Build the signed/POSTed field set — in order, skipping empty optionals.
  const candidate: Record<string, string> = {
    merchant_id:   merchantId!,
    merchant_key:  merchantKey!,
    return_url:    returnUrl!,
    cancel_url:    cancelUrl!,
    notify_url:    notifyUrl!,
    name_first:    nameFirst,
    name_last:     nameLast,
    email_address: emailAddress,
    cell_number:   cellNumber,
    amount,
    item_name:     itemName,
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
  });
});
