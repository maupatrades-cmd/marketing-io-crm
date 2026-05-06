// Returns the public PayFast form fields needed by /payfast-test.
//
// The values are read from Base44 secrets at request time so nothing is baked
// into the client bundle. PayFast Redirect (Standard) requires merchant_id /
// merchant_key / *_url to be POSTed from the buyer's browser, so they will
// appear in the rendered form HTML — but the *source of truth* stays in the
// Base44 secret store and never lands in the JS bundle or in version control.
//
// Step 2 of 10: no signature, no ITN, no Payment row — just config for the
// test form.

Deno.serve(async (_req) => {
  const merchantId  = Deno.env.get('PAYFAST_MERCHANT_ID');
  const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');
  const returnUrl   = Deno.env.get('PAYFAST_RETURN_URL');
  const cancelUrl   = Deno.env.get('PAYFAST_CANCEL_URL');
  const notifyUrl   = Deno.env.get('PAYFAST_NOTIFY_URL');
  const processUrl  = Deno.env.get('PAYFAST_PROCESS_URL');

  const missing = Object.entries({
    PAYFAST_MERCHANT_ID:  merchantId,
    PAYFAST_MERCHANT_KEY: merchantKey,
    PAYFAST_RETURN_URL:   returnUrl,
    PAYFAST_CANCEL_URL:   cancelUrl,
    PAYFAST_NOTIFY_URL:   notifyUrl,
    PAYFAST_PROCESS_URL:  processUrl,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    console.error('[payfast-test-config] missing secrets:', missing);
    return Response.json(
      { error: 'PayFast not configured', missing },
      { status: 500 }
    );
  }

  return Response.json({
    merchant_id:  merchantId,
    merchant_key: merchantKey,
    return_url:   returnUrl,
    cancel_url:   cancelUrl,
    notify_url:   notifyUrl,
    process_url:  processUrl,
  });
});
