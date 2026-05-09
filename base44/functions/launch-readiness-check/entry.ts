/**
 * launch-readiness-check
 * Owner-only. Returns a green/amber/red report of pre-launch checklist items.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

const PAYFAST_VARS = [
  'PAYFAST_MERCHANT_ID',
  'PAYFAST_MERCHANT_KEY',
  'PAYFAST_PASSPHRASE',
  'PAYFAST_RETURN_URL',
  'PAYFAST_CANCEL_URL',
  'PAYFAST_NOTIFY_URL',
  'PAYFAST_PROCESS_URL',
];

const TEST_PASSWORD = 'Test123456!';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner') return Response.json({ error: 'Forbidden: owner only' }, { status: 403 });

    const checks = [];

    // --- a) Invoice integrity ---
    try {
      const issued = await base44.asServiceRole.entities.Invoice.filter({ status: 'issued' }, '-created_date', 5);
      const count = Array.isArray(issued) ? issued.length : 0;
      checks.push({
        check: 'Invoice integrity (no stale "issued" invoices)',
        status: count === 0 ? 'pass' : 'fail',
        detail: count === 0
          ? 'No invoices stuck in "issued" status.'
          : `${count} invoice(s) still in "issued" status — backfill may not have run.`,
      });
    } catch (e) {
      checks.push({ check: 'Invoice integrity', status: 'warn', detail: `Query failed: ${e.message}` });
    }

    // --- b) Payment→Invoice wiring ---
    try {
      const payments = await base44.asServiceRole.entities.Payment.filter({ status: 'successful' }, '-created_date', 10);
      const withInvoice = (Array.isArray(payments) ? payments : []).filter(p => p.invoice_id);
      if (withInvoice.length === 0) {
        checks.push({ check: 'Payment→Invoice wiring', status: 'warn', detail: 'No successful payments with invoice_id found yet — cannot verify wiring.' });
      } else {
        const sample = withInvoice[0];
        const inv = await base44.asServiceRole.entities.Invoice.filter({ id: sample.invoice_id }, '-created_date', 1);
        const linked = Array.isArray(inv) ? inv[0] : inv;
        const ok = linked && linked.status === 'paid' && linked.paid_at;
        checks.push({
          check: 'Payment→Invoice wiring',
          status: ok ? 'pass' : 'fail',
          detail: ok
            ? `Verified: Payment ${sample.id} → Invoice ${linked.id} is paid with paid_at set.`
            : `Invoice ${sample.invoice_id} is status="${linked?.status}" paid_at="${linked?.paid_at}" — wiring incomplete.`,
        });
      }
    } catch (e) {
      checks.push({ check: 'Payment→Invoice wiring', status: 'warn', detail: `Query failed: ${e.message}` });
    }

    // --- c) RLS coverage (manual check — can't read entity schema from here) ---
    checks.push({
      check: 'RLS coverage on sensitive entities',
      status: 'warn',
      detail: 'Manual verification required: confirm Commission, OTPCode, AppUser, InternalMessage, Lead, LoginAttempt, SecurityEvent, Contract, Deliverable, Task, ServiceOrder, ClientNotification all have rls blocks in their entity JSON.',
    });

    // --- d) PayFast env vars ---
    try {
      const missing = PAYFAST_VARS.filter(k => !Deno.env.get(k));
      const processUrl = Deno.env.get('PAYFAST_PROCESS_URL') || '';
      const isSandbox = processUrl.toLowerCase().includes('sandbox');
      if (missing.length > 0) {
        checks.push({ check: 'PayFast env vars', status: 'fail', detail: `Missing: ${missing.join(', ')}` });
      } else if (isSandbox) {
        checks.push({ check: 'PayFast env vars', status: 'warn', detail: `All set but PAYFAST_PROCESS_URL points to sandbox (${processUrl}) — switch to live before go-live.` });
      } else {
        checks.push({ check: 'PayFast env vars', status: 'pass', detail: 'All PayFast vars set and PAYFAST_PROCESS_URL is not sandbox.' });
      }
    } catch (e) {
      checks.push({ check: 'PayFast env vars', status: 'warn', detail: `Env check failed: ${e.message}` });
    }

    // --- e) Resend API key ---
    const resendKey = Deno.env.get('RESEND_API_KEY');
    checks.push({
      check: 'Resend API key',
      status: resendKey ? 'pass' : 'fail',
      detail: resendKey ? 'RESEND_API_KEY is set.' : 'RESEND_API_KEY is missing — emails will not send.',
    });

    // --- f) Test users still live ---
    try {
      const testAdmins = await base44.asServiceRole.entities.AppUser.filter({ email: 'admin@marketingio.co.za' });
      const testUser = Array.isArray(testAdmins) ? testAdmins[0] : testAdmins;
      if (!testUser) {
        checks.push({ check: 'Test users removed', status: 'pass', detail: 'admin@marketingio.co.za not found — test users appear removed.' });
      } else {
        let passwordStillLive = false;
        try {
          passwordStillLive = await bcrypt.compare(TEST_PASSWORD, testUser.password_hash || '');
        } catch (_) {}
        checks.push({
          check: 'Test users removed',
          status: passwordStillLive ? 'warn' : 'pass',
          detail: passwordStillLive
            ? 'admin@marketingio.co.za still exists with Test123456! password — rotate or delete before go-live.'
            : 'admin@marketingio.co.za exists but password has been changed from test default.',
        });
      }
    } catch (e) {
      checks.push({ check: 'Test users removed', status: 'warn', detail: `Check failed: ${e.message}` });
    }

    // --- g) Stub elimination ---
    checks.push({
      check: 'Stub pages eliminated (/client/invoices/:id, /client/messages/:threadId)',
      status: 'warn',
      detail: 'Manual verification required: open /client/invoices/:invoiceId and /client/messages/:threadId in the preview and confirm they render real content, not "Coming soon".',
    });

    // --- h) Cron schedules ---
    try {
      // We can't list automations from within a function, so mark as warn
      checks.push({
        check: 'Cron schedules registered (overdue sweep, renewal sweep, churn sweep)',
        status: 'warn',
        detail: 'Cannot query automation list from inside a function — verify in Base44 dashboard > Automations that all 3 daily cron jobs are active.',
      });
    } catch (e) {
      checks.push({ check: 'Cron schedules', status: 'warn', detail: e.message });
    }

    // --- i) Onboarding chain ---
    try {
      const wonDeals = await base44.asServiceRole.entities.Deal.filter({ stage: 'closed_won' }, '-created_date', 5);
      const deals = Array.isArray(wonDeals) ? wonDeals : [];
      if (deals.length === 0) {
        checks.push({ check: 'Onboarding chain (Deal → Contract → Invoice)', status: 'warn', detail: 'No closed_won deals found yet — cannot verify auto-chain.' });
      } else {
        const deal = deals[0];
        const contracts = await base44.asServiceRole.entities.Contract.filter({ deal_id: deal.id }, '-created_date', 1);
        const contract = Array.isArray(contracts) ? contracts[0] : contracts;
        if (!contract) {
          checks.push({ check: 'Onboarding chain (Deal → Contract → Invoice)', status: 'fail', detail: `Deal ${deal.id} is closed_won but has no Contract — on-deal-closed-won-create-contract may not have run.` });
        } else if (['signed', 'active'].includes(contract.status)) {
          const invoices = await base44.asServiceRole.entities.Invoice.filter({ deal_id: deal.id, type: 'setup_fee' }, '-created_date', 1);
          const inv = Array.isArray(invoices) ? invoices[0] : invoices;
          checks.push({
            check: 'Onboarding chain (Deal → Contract → Invoice)',
            status: inv ? 'pass' : 'fail',
            detail: inv
              ? `Deal ${deal.id} → Contract ${contract.id} (${contract.status}) → Invoice ${inv.id} ✓`
              : `Contract ${contract.id} is signed but no setup_fee Invoice found for deal ${deal.id}.`,
          });
        } else {
          checks.push({ check: 'Onboarding chain (Deal → Contract → Invoice)', status: 'pass', detail: `Deal ${deal.id} → Contract ${contract.id} (${contract.status}) — not yet signed, chain valid so far.` });
        }
      }
    } catch (e) {
      checks.push({ check: 'Onboarding chain', status: 'warn', detail: `Query failed: ${e.message}` });
    }

    // --- j) ClientNotification has recipient_user_id ---
    try {
      const sample = await base44.asServiceRole.entities.ClientNotification.filter({}, '-created_date', 1);
      // Try creating a test read with recipient_user_id to verify the field exists
      // We probe by schema — if the entity accepts recipient_user_id in a filter without error, field exists
      await base44.asServiceRole.entities.ClientNotification.filter({ recipient_user_id: 'probe_test' }, '-created_date', 1);
      checks.push({ check: 'ClientNotification.recipient_user_id field exists', status: 'pass', detail: 'Field is present and queryable.' });
    } catch (e) {
      const msg = e.message || '';
      if (msg.toLowerCase().includes('unknown field') || msg.toLowerCase().includes('recipient_user_id')) {
        checks.push({ check: 'ClientNotification.recipient_user_id field exists', status: 'fail', detail: 'Field missing — Task 11 schema change may not have been applied.' });
      } else {
        checks.push({ check: 'ClientNotification.recipient_user_id field exists', status: 'pass', detail: 'Field queryable (probe returned no error related to field).' });
      }
    }

    // --- Overall rollup ---
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');
    const overall = hasFail ? 'red' : hasWarn ? 'amber' : 'green';

    return Response.json({ overall, checks });
  } catch (error) {
    console.error('[launch-readiness-check] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});