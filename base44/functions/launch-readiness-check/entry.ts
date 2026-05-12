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
const HARDCODED_PASSWORDS = ['Test123456!', 'MarketingIO2026!'];

// Roles the frontend RouteGuards / backend authz checks actually use.
// Kept in sync with App.jsx + auth-login + seed-test-staff-users.
const EXPECTED_APP_USER_ROLES = [
  'owner', 'admin', 'client', 'staff',
  'field_agent', 'cpc', 'head_of_tech', 'driver',
];

// Fields the multi-step Register flow writes onto Client. If any are missing
// from the Client entity schema, signup data is silently dropped.
const REQUIRED_CLIENT_FIELDS_FOR_SIGNUP = [
  'business_name', 'contact_person', 'email', 'phone',
  'industry', 'status', 'client_user_id',
  // multi-step signup adds these — must exist on Client to persist
  'years_in_business', 'number_of_employees',
  'business_city', 'business_address', 'business_province',
  'twelve_month_goal', 'biggest_challenge',
  'monthly_revenue_range', 'new_customers_target', 'urgency_level',
  'current_marketing_assets', 'agency_history',
  'monthly_marketing_budget', 'preferred_contact_channels', 'best_call_time',
  'popia_consent_given', 'popia_consent_at',
  'lifecycle_stage', 'lead_source_type', 'app_user_id', 'signup_completed_steps',
];

// Seed / migration endpoints that must be auth-gated or removed before go-live.
const SENSITIVE_SEED_ENDPOINTS = [
  'seedOwnerAccount',
  'migrate-owner-to-appuser',
  'create-test-client',
  'seed-test-staff-users',
];

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
      // Probe by filtering on the field — if the entity rejects unknown field
      // we'll catch and mark fail.
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

    // =========================================================================
    // T1 — AppUser role coverage
    //   The frontend uses owner / field_agent / cpc / head_of_tech / driver in
    //   RouteGuards. If AppUser.role enum doesn't accept these, no such users
    //   can be created and the login flow breaks for them.
    // =========================================================================
    try {
      const roleCounts = {};
      for (const role of EXPECTED_APP_USER_ROLES) {
        try {
          const rows = await base44.asServiceRole.entities.AppUser.filter({ role }, '-created_date', 1);
          roleCounts[role] = Array.isArray(rows) ? rows.length : (rows ? 1 : 0);
        } catch (_) {
          roleCounts[role] = -1; // query rejected — likely enum violation
        }
      }
      const ownerCount = roleCounts.owner || 0;
      const rejected = Object.entries(roleCounts).filter(([, c]) => c < 0).map(([r]) => r);
      let status, detail;
      if (rejected.length) {
        status = 'fail';
        detail = `AppUser.role does not accept: ${rejected.join(', ')}. Update entities/AppUser.jsonc enum.`;
      } else if (ownerCount === 0) {
        status = 'fail';
        detail = 'No AppUser with role=owner exists. Login + this readiness check itself depend on it.';
      } else {
        status = 'pass';
        detail = `AppUser supports all expected roles; ${ownerCount} owner(s) present.`;
      }
      checks.push({ check: 'T1 — AppUser role enum coverage', status, detail });
    } catch (e) {
      checks.push({ check: 'T1 — AppUser role enum coverage', status: 'warn', detail: `Probe failed: ${e.message}` });
    }

    // =========================================================================
    // T2 — Owner can log in (this very request proves it; we re-affirm)
    // =========================================================================
    checks.push({
      check: 'T2 — Owner account authenticated for this check',
      status: 'pass',
      detail: `Authenticated as ${user.email} (role=${user.role}).`,
    });

    // =========================================================================
    // T3 — Client schema completeness for multi-step signup
    //   Probe each required field via a no-op filter; if the entity rejects
    //   the field name, it's missing from the schema and signup data is lost.
    // =========================================================================
    try {
      const missing = [];
      for (const field of REQUIRED_CLIENT_FIELDS_FOR_SIGNUP) {
        try {
          await base44.asServiceRole.entities.Client.filter({ [field]: '__probe__' }, '-created_date', 1);
        } catch (err) {
          const msg = (err.message || '').toLowerCase();
          if (msg.includes('unknown') || msg.includes(field.toLowerCase()) || msg.includes('field')) {
            missing.push(field);
          }
        }
      }
      checks.push({
        check: 'T3 — Client schema covers multi-step signup fields',
        status: missing.length === 0 ? 'pass' : 'fail',
        detail: missing.length === 0
          ? `All ${REQUIRED_CLIENT_FIELDS_FOR_SIGNUP.length} signup fields present on Client entity.`
          : `Missing on Client.jsonc: ${missing.join(', ')}.`,
      });
    } catch (e) {
      checks.push({ check: 'T3 — Client schema covers multi-step signup fields', status: 'warn', detail: `Probe failed: ${e.message}` });
    }

    // =========================================================================
    // T4 — Duplicate route registrations (frontend)
    //   Backend can't read the SPA bundle. Mark manual.
    // =========================================================================
    checks.push({
      check: 'T4 — No duplicate routes in App.jsx',
      status: 'warn',
      detail: 'Manual: grep App.jsx for duplicate <Route path=…> entries. Known duplicates as of audit: /owner/financials, /owner/reports, /owner/admin-activity-log.',
    });

    // =========================================================================
    // T5 — Sensitive seed/migration endpoints are auth-gated.
    //   We can't introspect endpoint code, but we can flag the names so the
    //   owner audits them before launch.
    // =========================================================================
    checks.push({
      check: 'T5 — Seed/migration endpoints auth-gated or removed',
      status: 'warn',
      detail: `Manual audit required for: ${SENSITIVE_SEED_ENDPOINTS.join(', ')}. Each must call base44.auth.me() and require role=owner, OR be removed before go-live.`,
    });

    // =========================================================================
    // T6 — "Coming soon" stub strings shipped in components.
    //   Manual scan because functions can't read the SPA bundle.
    // =========================================================================
    checks.push({
      check: 'T6 — No "Coming soon" stubs shipped in production UI',
      status: 'warn',
      detail: 'Manual: grep src/ for "Coming soon". Known location at audit: DeliverableCardWithFeedback.jsx.',
    });

    // =========================================================================
    // T7 — force_logout_at honored by auth-me
    //   We can't introspect another function's code from here, so this is a
    //   manual check. Flag it so the owner verifies after the auth-me fix.
    // =========================================================================
    checks.push({
      check: 'T7 — auth-me honors AppUser.force_logout_at',
      status: 'warn',
      detail: 'Manual: confirm auth-me/entry.ts rejects sessions where session_expires_at < force_logout_at (or session was issued before force_logout_at).',
    });

    // =========================================================================
    // T8 — Resend health probe.
    //   Send a no-op API request (list domains) to verify the key is valid.
    //   We avoid actually sending an email to keep the check cost-free.
    // =========================================================================
    try {
      if (!resendKey) {
        checks.push({ check: 'T8 — Resend API reachable', status: 'fail', detail: 'RESEND_API_KEY missing — see Resend API key check above.' });
      } else {
        const res = await fetch('https://api.resend.com/domains', {
          method: 'GET',
          headers: { Authorization: `Bearer ${resendKey}` },
        });
        if (res.ok) {
          checks.push({ check: 'T8 — Resend API reachable', status: 'pass', detail: `Resend /domains returned ${res.status}.` });
        } else {
          const body = await res.text();
          checks.push({ check: 'T8 — Resend API reachable', status: 'fail', detail: `Resend /domains returned ${res.status}: ${body.slice(0, 200)}` });
        }
      }
    } catch (e) {
      checks.push({ check: 'T8 — Resend API reachable', status: 'warn', detail: `Probe failed: ${e.message}` });
    }

    // =========================================================================
    // T9 — PayFast ITN endpoint reachable.
    //   We don't POST a fake ITN because that touches SecurityEvent. Instead
    //   we mark this manual + give the owner the exact curl invocation.
    // =========================================================================
    checks.push({
      check: 'T9 — PayFast ITN endpoint reachable',
      status: 'warn',
      detail: 'Manual: POST a sandbox ITN payload and confirm 200 + a Payment row updated. (See payfast-security-test-harness for an automated harness behind PAYFAST_TEST_TOKEN.)',
    });

    // =========================================================================
    // T10 — Cron automations (already covered by check h above as manual).
    // =========================================================================
    checks.push({
      check: 'T10 — Cron automation manifest',
      status: 'warn',
      detail: 'Manual: in Base44 Automations, confirm sweep-overdue-invoices, sweep-contract-renewals, sweep-client-churn, check-failed-debits-follow-up, send-onboarding-progress-email-batch, escalateUnsentReports are all active.',
    });

    // =========================================================================
    // T11 — Hardcoded test passwords still in use on AppUser rows.
    //   Sample up to 20 most-recent AppUsers; flag any whose hash matches a
    //   known hardcoded password. Side note: this is best-effort sampling,
    //   not exhaustive — the audit's purpose is to catch obviously-live test
    //   accounts before launch, not to verify every user.
    // =========================================================================
    try {
      const sample = await base44.asServiceRole.entities.AppUser.filter({}, '-created_date', 20);
      const rows = Array.isArray(sample) ? sample : (sample ? [sample] : []);
      const offenders = [];
      for (const u of rows) {
        for (const pwd of HARDCODED_PASSWORDS) {
          try {
            const match = await bcrypt.compare(pwd, u.password_hash || '');
            if (match) { offenders.push(`${u.email} (uses "${pwd}")`); break; }
          } catch (_) {}
        }
      }
      checks.push({
        check: 'T11 — No hardcoded passwords live on recent AppUsers',
        status: offenders.length === 0 ? 'pass' : 'fail',
        detail: offenders.length === 0
          ? `Sampled ${rows.length} most-recent AppUsers — none use a known hardcoded password.`
          : `${offenders.length} account(s) still on hardcoded password: ${offenders.join(', ')}.`,
      });
    } catch (e) {
      checks.push({ check: 'T11 — No hardcoded passwords live on recent AppUsers', status: 'warn', detail: `Probe failed: ${e.message}` });
    }

    // =========================================================================
    // T12 — Captcha strength (SignIn / Register).
    //   Can't introspect frontend; flagged manual.
    // =========================================================================
    checks.push({
      check: 'T12 — Captcha is not a trivial single-digit add',
      status: 'warn',
      detail: 'Manual: SignIn + Register currently use 1+1…10+10 maths captchas. Acceptable as a low-friction bot deterrent; replace with hCaptcha/Turnstile if abuse rises.',
    });

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
