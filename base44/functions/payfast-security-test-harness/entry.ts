import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

// =============================================================================
// PayFast security test harness — Step 8 PR A.
//
// One HTTP endpoint that runs five negative tests against the live
// payfast-itn handler and returns a JSON results report. Run on demand to
// re-prove the four security checks reject bad input.
//
// Auth: gated behind a PAYFAST_TEST_TOKEN secret. The harness writes
// disposable test rows + SecurityEvent entries to your live data, so we
// don't want it callable by anyone with the URL. Set the secret in Base44,
// pass it in the request body as { "test_token": "<value>" }.
//
// All test data is prefixed `TEST-` and uses the dummy email
// security-harness@example.invalid so it's easy to filter out of real
// dashboards / reports.
//
// HOW TO RUN
// ----------
//   curl -i -X POST https://devious-market-flow-crm.base44.app/api/functions/payfast-security-test-harness \
//     -H "Content-Type: application/json" \
//     -d '{"test_token":"<PAYFAST_TEST_TOKEN value>"}'
//
// HOW TO READ THE RESULTS
// -----------------------
// Response is `{ summary: {...}, tests: [...] }`. Each test entry has:
//   - name        : short identifier
//   - description : what the test proves
//   - passed      : true if the security check rejected as expected
//   - skipped     : true if the test couldn't run in this environment
//                   (sandbox skip on IP enforcement, postback gate)
//   - checks      : per-assertion pass/fail breakdown
//
// Tests:
//   1. forged_signature   — garbage signature → rejected at Check 1
//   2. tampered_amount    — valid signature on a payload PayFast never sent
//                           → rejected at Check 3 (postback validate)
//   3. replay_attack      — re-POSTs the most recent successful ITN twice
//                           → no Payment.updated_date change (idempotent)
//   4. ip_spoofing        — DEFERRED in sandbox (handler skips IP check by
//                           design when PAYFAST_PROCESS_URL points at the
//                           sandbox host); production-only test.
//   5. wrong_client_id    — DEFERRED (the field-equality check at Check 4b
//                           is gated behind passing Check 3 postback, which
//                           a forged payload can't do). Documented in the
//                           response.
// =============================================================================

// ---- helpers ---------------------------------------------------------------

// Match PayFast's PHP-style urlencode (same as production).
function payfastUrlEncode(value) {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/!/g,  '%21')
    .replace(/'/g,  '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g,  '%7E');
}

// Match the inbound-style signing the handler verifies against (no trim,
// no skip-empty). Used to forge a "validly-signed but tampered" payload.
function signInboundStyle(fields, passphrase) {
  const pairs = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'signature') continue;
    pairs.push(`${k}=${payfastUrlEncode(String(v))}`);
  }
  const stringToHash = `${pairs.join('&')}&passphrase=${payfastUrlEncode(passphrase)}`;
  return createHash('md5').update(stringToHash).digest('hex');
}

// `TEST-<scenario>-<utc-stamp>-<rand>` so test rows are immediately
// identifiable in the Payment / SecurityEvent tables.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randTok(n) {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}
function makeTestId(scenario) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `TEST-${scenario}-${stamp}-${randTok(4)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build a realistic-looking ITN field set. Override anything per-test.
function makePayload(overrides) {
  return {
    m_payment_id:     '',  // override per-test
    pf_payment_id:    '99999999',
    payment_status:   'COMPLETE',
    item_name:        'Security Test',
    item_description: 'Negative-test harness payload (NOT a real payment).',
    amount_gross:     '10.00',
    amount_fee:       '-0.23',
    amount_net:       '9.77',
    custom_str1:      'security-test',
    custom_str2:      'test-client-id',
    custom_str3:      'Test Co',
    custom_str4:      '',
    custom_str5:      '',
    custom_int1:      '',
    custom_int2:      '',
    custom_int3:      '',
    custom_int4:      '',
    custom_int5:      '',
    name_first:       'Test',
    name_last:        'Harness',
    email_address:    'security-harness@example.invalid',
    merchant_id:      '10000100',
    signature:        '',  // override per-test
    ...overrides,
  };
}

// POST form-encoded body to the live payfast-itn endpoint.
async function postItn(notifyUrl, fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) body.append(k, String(v));
  const t0 = Date.now();
  const res = await fetch(notifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  return { status: res.status, body: text.trim().slice(0, 200), latency_ms: Date.now() - t0 };
}

function unwrapList(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

// Find SecurityEvent rows whose `details` JSON mentions a specific
// m_payment_id. Filters by event_type to keep the scan small.
async function findSecurityEventsForMid(base44, eventType, mPaymentId) {
  const found = await base44.asServiceRole.entities.SecurityEvent.filter({
    event_type: eventType,
  });
  const list = unwrapList(found);
  return list.filter((e) =>
    typeof e?.details === 'string' && e.details.includes(mPaymentId)
  );
}

async function findPaymentsByRef(base44, mPaymentId) {
  const found = await base44.asServiceRole.entities.Payment.filter({
    gateway_reference: mPaymentId,
  });
  return unwrapList(found);
}

// =============================================================================
// Test 1: forged signature → rejected at Check 1
// =============================================================================
async function testForgedSignature(base44, notifyUrl) {
  const mPaymentId = makeTestId('FORGED-SIG');
  const fields = makePayload({
    m_payment_id: mPaymentId,
    // Garbage hex — anything that's not a valid MD5 of the rest+passphrase.
    signature: 'deadbeefcafe00000000000000000000',
  });

  const response = await postItn(notifyUrl, fields);
  await sleep(2500); // SecurityEvent.create is awaited inside processITN

  const events = await findSecurityEventsForMid(base44, 'payment_signature_mismatch', mPaymentId);
  const payments = await findPaymentsByRef(base44, mPaymentId);

  const handlerReturned200       = response.status === 200;
  const eventLogged              = events.length === 1;
  const noPaymentRowCreated      = payments.length === 0;
  const passed                   = handlerReturned200 && eventLogged && noPaymentRowCreated;

  return {
    name: 'forged_signature',
    description:
      'POST an ITN with a deliberately wrong signature. Handler must 200 ' +
      'PayFast, log a payment_signature_mismatch SecurityEvent, and not ' +
      'write a Payment row.',
    m_payment_id: mPaymentId,
    response,
    checks: {
      handler_returned_200:                    handlerReturned200,
      payment_signature_mismatch_event_logged: eventLogged,
      no_payment_row_created:                  noPaymentRowCreated,
    },
    passed,
    skipped: false,
  };
}

// =============================================================================
// Test 2: tampered amount → rejected at Check 3 (postback INVALID)
//
// We construct a payload that PayFast NEVER sent, sign it with the real
// PAYFAST_PASSPHRASE so it passes Check 1, then rely on PayFast's
// /eng/query/validate to reject it (because it has no record of this
// transaction). That fires payment_postback_invalid in the handler.
// =============================================================================
async function testTamperedAmount(base44, notifyUrl, passphrase) {
  const mPaymentId = makeTestId('TAMPER-AMT');
  const baseFields = makePayload({
    m_payment_id: mPaymentId,
    amount_gross: '999999.00',         // wildly tampered
    amount_fee:   '-100.00',
    amount_net:   '999899.00',
  });
  // Strip signature and recompute over the rest with our real passphrase.
  delete baseFields.signature;
  const sig = signInboundStyle(baseFields, passphrase);
  const fields = { ...baseFields, signature: sig };

  const response = await postItn(notifyUrl, fields);
  await sleep(4000); // postback to sandbox.payfast.co.za can take 1-3s

  const events = await findSecurityEventsForMid(base44, 'payment_postback_invalid', mPaymentId);
  const sigEvents = await findSecurityEventsForMid(base44, 'payment_signature_mismatch', mPaymentId);
  const payments = await findPaymentsByRef(base44, mPaymentId);

  const handlerReturned200      = response.status === 200;
  const passedSignatureCheck    = sigEvents.length === 0;
  const rejectedAtPostback      = events.length === 1;
  const noPaymentRowCreated     = payments.length === 0;
  const passed = handlerReturned200 && passedSignatureCheck && rejectedAtPostback && noPaymentRowCreated;

  return {
    name: 'tampered_amount',
    description:
      'Forge an ITN with our real PAYFAST_PASSPHRASE so it passes Check 1, ' +
      'but with an amount PayFast never authorised. PayFast validate URL ' +
      'should reject the payload (payment_postback_invalid event).',
    m_payment_id: mPaymentId,
    response,
    checks: {
      handler_returned_200:                handlerReturned200,
      passed_signature_check:              passedSignatureCheck,
      rejected_at_postback:                rejectedAtPostback,
      no_payment_row_created:              noPaymentRowCreated,
    },
    passed,
    skipped: false,
  };
}

// =============================================================================
// Test 3: replay attack → idempotency keeps Payment.updated_date constant
//
// We replay the most recent successful Payment's stored ipn_payload back
// to the handler twice. Because that Payment.status is already 'successful',
// the handler must short-circuit at the idempotency check and NOT modify
// the row (no double commission, no double email later, etc.).
//
// In sandbox PayFast may reject replayed payloads at the postback stage
// (returning INVALID). Either path counts as a pass — the row stays
// untouched. The test asserts that the row's updated_date is constant
// across the two replays.
// =============================================================================
async function testReplay(base44, notifyUrl) {
  // Find the most recent successful Payment with an ipn_payload to replay.
  const successful = await base44.asServiceRole.entities.Payment.filter({
    status: 'successful',
  });
  const list = unwrapList(successful)
    .filter((p) => p?.ipn_payload && typeof p.ipn_payload === 'object')
    .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
  const target = list[0];

  if (!target) {
    return {
      name: 'replay_attack',
      description: 'Replay the most recent successful ITN twice; verify Payment.updated_date is unchanged.',
      passed: false,
      skipped: true,
      skip_reason: 'No successful Payment with stored ipn_payload available to replay. Run a real test payment first, then re-run this harness.',
    };
  }

  const updatedBefore = target.updated_date;
  const fields = { ...target.ipn_payload };

  const response1 = await postItn(notifyUrl, fields);
  await sleep(3000);
  const response2 = await postItn(notifyUrl, fields);
  await sleep(3000);

  // Re-fetch the same row.
  const rows = await base44.asServiceRole.entities.Payment.filter({
    gateway_reference: target.gateway_reference,
  });
  const after = unwrapList(rows)[0];
  const updatedAfter = after?.updated_date;

  const stillSuccessful           = after?.status === 'successful';
  const updatedDateUnchanged      = updatedBefore === updatedAfter;
  const handlerReturned200Both    = response1.status === 200 && response2.status === 200;
  const passed = stillSuccessful && updatedDateUnchanged && handlerReturned200Both;

  return {
    name: 'replay_attack',
    description:
      'Replay the most recent successful ITN payload twice. Idempotency ' +
      'should leave the Payment row untouched (no updated_date change).',
    target_m_payment_id: target.gateway_reference,
    response_1: response1,
    response_2: response2,
    checks: {
      handler_returned_200_both_times:   handlerReturned200Both,
      payment_status_still_successful:   stillSuccessful,
      updated_date_unchanged:            updatedDateUnchanged,
      updated_before:                    updatedBefore,
      updated_after:                     updatedAfter,
    },
    passed,
    skipped: false,
  };
}

// =============================================================================
// Test 4: IP spoofing — DEFERRED in sandbox
//
// The handler's IP whitelist enforcement is DELIBERATELY skipped when
// PAYFAST_PROCESS_URL points at the sandbox host (sandbox uses dynamic
// IPs that don't resolve cleanly). So a forged-IP test in sandbox can't
// trigger payment_ip_rejected. Documented here for transparency.
// =============================================================================
function testIpSpoofingDeferred(processUrl) {
  const inSandbox = String(processUrl ?? '').includes('sandbox.payfast.co.za');
  return {
    name: 'ip_spoofing',
    description:
      'Source-IP whitelist test. In production the handler rejects POSTs ' +
      'whose source IP is not in PayFast\'s published IP set; in sandbox ' +
      'enforcement is deliberately skipped.',
    passed: false,
    skipped: true,
    skip_reason:
      inSandbox
        ? 'PAYFAST_PROCESS_URL is sandbox; IP whitelist is intentionally bypassed in this environment. Production deploys will enforce.'
        : 'Cannot inject a non-PayFast source IP from inside Base44; this test is meaningful only when triggered from a non-PayFast network. Recommend running via an external curl from a third-party host before going live.',
    code_reference: 'base44/functions/payfast-itn/entry.ts — Check 2 in processITN()',
  };
}

// =============================================================================
// Test 5: wrong client_id — DEFERRED (gated behind successful postback)
//
// The field-equality check at Check 4b runs only AFTER the postback at
// Check 3 returns VALID. PayFast's validate URL won't return VALID for any
// payload PayFast didn't actually send, so a forged payload can never
// reach Check 4b in this environment. Flag this in the response so we
// have a written record that this layer wasn't actively exercised.
// =============================================================================
function testWrongClientIdDeferred() {
  return {
    name: 'wrong_client_id',
    description:
      'Field-equality tamper detection on custom_str2 vs Payment.client_id. ' +
      'Test cannot run via forged-payload HTTP POSTs because Check 3 ' +
      '(postback to PayFast) rejects all forged payloads before Check 4b ' +
      'runs. The check is in source and would reject any real PayFast ' +
      'payload whose echoed custom_str2 differs from the stored Payment.client_id.',
    passed: false,
    skipped: true,
    skip_reason:
      'Reaching Check 4b requires a payload PayFast itself authored. We ' +
      'don\'t have a way to ask PayFast to echo back a tampered custom_str2 ' +
      'while keeping their signature valid. Verified by code review only.',
    code_reference:
      'base44/functions/payfast-itn/entry.ts — `trackingMismatches` block in processITN()',
  };
}

// =============================================================================
// HTTP entry point.
// =============================================================================
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json(
      { error: 'Use POST. See file header for usage.' },
      { status: 405 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const expectedToken = Deno.env.get('PAYFAST_TEST_TOKEN');
  if (!expectedToken) {
    return Response.json(
      {
        error:
          'Set PAYFAST_TEST_TOKEN secret in Base44 before running the ' +
          'harness. Pick any opaque string; you\'ll pass it in the body ' +
          'as { "test_token": "<value>" }.',
      },
      { status: 500 }
    );
  }
  if (body?.test_token !== expectedToken) {
    return Response.json(
      { error: 'unauthorized — test_token does not match PAYFAST_TEST_TOKEN' },
      { status: 401 }
    );
  }

  const notifyUrl = Deno.env.get('PAYFAST_NOTIFY_URL');
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE');
  const processUrl = Deno.env.get('PAYFAST_PROCESS_URL');
  const missing = Object.entries({ PAYFAST_NOTIFY_URL: notifyUrl, PAYFAST_PASSPHRASE: passphrase, PAYFAST_PROCESS_URL: processUrl })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    return Response.json({ error: 'PayFast not configured', missing }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);

  // Run the active tests serially — they share live entity tables, so
  // parallel runs would create write contention and confuse the
  // SecurityEvent assertions.
  const tests = [];
  tests.push(await testForgedSignature(base44, notifyUrl));
  tests.push(await testTamperedAmount(base44, notifyUrl, passphrase));
  tests.push(await testReplay(base44, notifyUrl));
  tests.push(testIpSpoofingDeferred(processUrl));
  tests.push(testWrongClientIdDeferred());

  const passed  = tests.filter((t) => t.passed).length;
  const skipped = tests.filter((t) => t.skipped).length;
  const failed  = tests.length - passed - skipped;

  return Response.json({
    summary: {
      total:   tests.length,
      passed,
      skipped,
      failed,
      verdict: failed === 0 ? 'all-checks-rejecting-as-expected' : 'some-checks-failed',
    },
    timestamp: new Date().toISOString(),
    notes: [
      'Test rows have m_payment_id prefixed with TEST- and email security-harness@example.invalid for easy filtering.',
      'No real Payment rows are modified. Test 3 (replay) reads the most recent successful Payment but does not write to it.',
      'Tests 4 + 5 are documented but cannot run actively in sandbox; see each test\'s skip_reason.',
    ],
    tests,
  });
});
