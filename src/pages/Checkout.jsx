import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  DEFAULT_PACKAGE_ID,
  findPackage,
  isActivePackage,
} from '@/config/payfastPackages';

// ---------------------------------------------------------------------------
// Step 5 of 10 — public Marketing iO checkout page.
//
// Route: /checkout/:packageId. If :packageId is unknown or inactive we fall
// back to /checkout/<DEFAULT_PACKAGE_ID> with a <Navigate replace>, so the
// browser history doesn't accumulate dead URLs.
// ---------------------------------------------------------------------------

const NAME_REGEX  = /^[\p{L}\s\-']{2,50}$/u;       // letters + spaces + - + '
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  // brief's regex
const SA_CELL     = /^0[6-8]\d{8}$/;               // SA mobile after normalize

// Strip spaces/dashes/parens, drop a leading +, then convert a leading 27 to
// 0 — gives a single canonical 0XXXXXXXXX form to validate.
function normaliseCell(raw) {
  const stripped = String(raw || '').replace(/[\s\-()]+/g, '').replace(/^\+/, '');
  if (/^27\d{9}$/.test(stripped)) return '0' + stripped.slice(2);
  return stripped;
}

function validateField(name, value) {
  const v = String(value ?? '').trim();
  switch (name) {
    case 'name_first':
    case 'name_last': {
      if (!v) return 'Required.';
      if (v.length < 2) return 'Must be at least 2 characters.';
      if (v.length > 50) return 'Must be 50 characters or fewer.';
      if (!NAME_REGEX.test(v)) return 'Letters, spaces, hyphens and apostrophes only.';
      return '';
    }
    case 'email_address': {
      if (!v) return 'Required.';
      if (!EMAIL_REGEX.test(v)) return 'Please enter a valid email address.';
      return '';
    }
    case 'cell_number': {
      if (!v) return 'Required.';
      const n = normaliseCell(v);
      if (!SA_CELL.test(n)) return 'Enter a SA cell number (e.g. 082 345 6789).';
      return '';
    }
    case 'company_name': {
      if (!v) return 'Required.';
      if (v.length < 2) return 'Must be at least 2 characters.';
      if (v.length > 100) return 'Must be 100 characters or fewer.';
      return '';
    }
    default:
      return '';
  }
}

function formatRand(amount) {
  if (!amount) return '';
  const [whole, cents] = String(amount).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `R${grouped}${cents ? '.' + cents : ''}`;
}

function postSignedFormToPayFast(processUrl, fields) {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = processUrl;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

const REFERENCE_VISIBLE_MS = 1100;

export default function Checkout() {
  const { packageId } = useParams();
  const [searchParams] = useSearchParams();

  // Unknown / inactive → bounce to default. `replace` so the bad URL doesn't
  // sit in browser history.
  if (!packageId || !isActivePackage(packageId)) {
    return <Navigate to={`/checkout/${DEFAULT_PACKAGE_ID}`} replace />;
  }

  const pkg = findPackage(packageId);

  // Pre-fill email when arriving from /payment-cancelled's "Try again" CTA.
  // Only valid-looking emails are accepted; anything else is ignored so a
  // crafted URL can't seed the field with garbage.
  const emailFromQuery = (() => {
    const raw = searchParams.get('email');
    if (!raw) return '';
    const trimmed = raw.trim();
    return EMAIL_REGEX.test(trimmed) ? trimmed : '';
  })();

  return <CheckoutForm pkg={pkg} initialEmail={emailFromQuery} />;
}

function CheckoutForm({ pkg, initialEmail = '' }) {
  const [form, setForm] = useState({
    name_first:    '',
    name_last:     '',
    email_address: initialEmail,
    cell_number:   '',
    company_name:  '',
  });
  const [touched, setTouched] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'signing' | 'redirecting'
  const [reference, setReference] = useState(null);
  const [error, setError] = useState(null);

  const errors = useMemo(
    () => ({
      name_first:    validateField('name_first',    form.name_first),
      name_last:     validateField('name_last',     form.name_last),
      email_address: validateField('email_address', form.email_address),
      cell_number:   validateField('cell_number',   form.cell_number),
      company_name:  validateField('company_name',  form.company_name),
    }),
    [form]
  );

  const formValid = Object.values(errors).every((e) => !e);
  const canSubmit = formValid && agreed && phase === 'idle';

  // Form-abandonment producer: 2-second debounce after the buyer types a
  // valid-looking email, fire-and-forget a CheckoutEngagement upsert. The
  // abandoned-cart-runner sweeps these every 15 minutes — anything older
  // than an hour with no Payment becomes an AbandonedCartSequence.
  //
  // Fire-and-forget by intent: the SDK invoke promise is started and not
  // awaited from the render path. We swallow rejections so transient
  // network failures never poison the user's checkout.
  const lastSentRef = useRef('');
  useEffect(() => {
    const email = String(form.email_address || '').trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) return;

    const handle = setTimeout(() => {
      // Avoid resending an identical payload back-to-back.
      const fingerprint = JSON.stringify({
        e: email,
        f: form.name_first,
        l: form.name_last,
        c: form.cell_number,
        co: form.company_name,
        p: pkg.id,
      });
      if (fingerprint === lastSentRef.current) return;
      lastSentRef.current = fingerprint;

      base44.functions.invoke('record-checkout-engagement', {
        email,
        name_first:   form.name_first,
        name_last:    form.name_last,
        cell_number:  form.cell_number,
        company_name: form.company_name,
        package_id:   pkg.id,
      }).catch((err) => {
        // Non-blocking. Log to console for diagnostic purposes only.
        console.warn('[Checkout] record-checkout-engagement failed:', err);
      });
    }, 2000);

    return () => clearTimeout(handle);
  }, [
    form.email_address,
    form.name_first,
    form.name_last,
    form.cell_number,
    form.company_name,
    pkg.id,
  ]);

  const showRetainer =
    pkg.contract_months > 0 && Number(pkg.monthly_retainer) > 0;

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };
  const markTouched = (key) => () =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      // Reveal all errors on a forced submit.
      setTouched({
        name_first: true, name_last: true, email_address: true,
        cell_number: true, company_name: true,
      });
      return;
    }

    setPhase('signing');
    try {
      // payfast-checkout-init does the lookup-or-create Client step AND the
      // pending Payment row write AND the signing in a single round trip.
      // Anonymous flow: no session_token, server creates a Client(status='lead').
      const res = await base44.functions.invoke('payfast-checkout-init', {
        package_id:    pkg.id,
        name_first:    form.name_first.trim(),
        name_last:     form.name_last.trim(),
        email_address: form.email_address.trim(),
        cell_number:   normaliseCell(form.cell_number),
        company_name:  form.company_name.trim(),
      });
      const data = res?.data ?? res;
      if (!data?.fields || !data?.process_url) {
        console.error('[Checkout] payfast-checkout-init returned no fields/process_url:', res);
        setError(data?.error || 'Could not generate a secure payment link. Please try again.');
        setPhase('idle');
        return;
      }
      setReference(data.m_payment_id || data.fields.m_payment_id || null);
      setPhase('redirecting');
      setTimeout(() => {
        postSignedFormToPayFast(data.process_url, data.fields);
      }, REFERENCE_VISIBLE_MS);
    } catch (err) {
      console.error('[Checkout] sign request failed:', err);
      setError('We could not reach our payment system. Please try again in a moment.');
      setPhase('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* ============== Package summary ============== */}
        <header className="mb-8">
          <CategoryBadge category={pkg.category} />
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text mt-3">
            {pkg.name}
          </h1>
          <div className="mt-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Once-off setup fee</p>
            <p className="text-4xl sm:text-5xl font-bold text-emerald-400 mt-1">
              {formatRand(pkg.amount)}
            </p>
            {showRetainer && (
              <p className="text-sm text-slate-400 mt-2">
                Then{' '}
                <span className="text-slate-200 font-semibold">
                  {formatRand(pkg.monthly_retainer)}/month
                </span>{' '}
                for {pkg.contract_months} months
                <span className="text-slate-500"> (debit order, billed separately)</span>
              </p>
            )}
          </div>
          <p className="mt-5 text-sm text-slate-300 leading-relaxed">{pkg.description}</p>
        </header>

        {/* ============== Form ============== */}
        <form onSubmit={onSubmit} noValidate className="space-y-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-100">Your details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="First name"
              value={form.name_first}
              onChange={setField('name_first')}
              onBlur={markTouched('name_first')}
              error={touched.name_first ? errors.name_first : ''}
              autoComplete="given-name"
            />
            <Field
              label="Last name"
              value={form.name_last}
              onChange={setField('name_last')}
              onBlur={markTouched('name_last')}
              error={touched.name_last ? errors.name_last : ''}
              autoComplete="family-name"
            />
          </div>

          <Field
            label="Email address"
            type="email"
            value={form.email_address}
            onChange={setField('email_address')}
            onBlur={markTouched('email_address')}
            error={touched.email_address ? errors.email_address : ''}
            autoComplete="email"
          />
          <Field
            label="Cell number"
            value={form.cell_number}
            onChange={setField('cell_number')}
            onBlur={markTouched('cell_number')}
            error={touched.cell_number ? errors.cell_number : ''}
            inputMode="tel"
            autoComplete="tel"
            help="South African mobile — e.g. 082 345 6789, +27 82 345 6789."
          />
          <Field
            label="Company name"
            value={form.company_name}
            onChange={setField('company_name')}
            onBlur={markTouched('company_name')}
            error={touched.company_name ? errors.company_name : ''}
            autoComplete="organization"
          />

          {/* Terms */}
          <label className="flex items-start gap-3 text-sm text-slate-300 select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 accent-purple-500"
            />
            <span>
              I have read and agree to the{' '}
              <a href="#" className="text-purple-300 underline hover:text-purple-200">Service Agreement</a>,{' '}
              <a href="#" className="text-purple-300 underline hover:text-purple-200">Terms &amp; Conditions</a>, and{' '}
              <a href="#" className="text-purple-300 underline hover:text-purple-200">Refund Policy</a>.
            </span>
          </label>

          {error && (
            <div className="bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          {phase === 'redirecting' && reference && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 rounded-xl p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-emerald-300/80">Reference</p>
              <p className="font-mono mt-1 break-all">{reference}</p>
              <p className="text-xs text-emerald-400/70 mt-1">Redirecting to PayFast…</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-gradient-to-br from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold transition hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {phase === 'signing'
              ? 'Generating secure payment link…'
              : phase === 'redirecting'
                ? 'Redirecting…'
                : `Pay Now — ${formatRand(pkg.amount)}`}
          </button>

          <p className="text-center text-xs text-slate-500">
            Secure payment powered by PayFast
          </p>
        </form>

        <footer className="mt-10 text-center">
          <p className="text-xs text-slate-500 italic">Marketing iO — Too good to stay hidden.</p>
        </footer>
      </div>
    </div>
  );
}

function CategoryBadge({ category }) {
  const map = {
    core:  { label: 'Core Package', cls: 'bg-purple-950/40 border-purple-500/40 text-purple-200' },
    addon: { label: 'Add-On',       cls: 'bg-pink-950/40 border-pink-500/40 text-pink-200' },
    test:  { label: 'Sandbox Test', cls: 'bg-amber-950/40 border-amber-500/40 text-amber-200' },
  };
  const cfg = map[category] || map.core;
  return (
    <span className={`inline-block text-xs uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Field({ label, value, onChange, onBlur, error, type = 'text', inputMode, autoComplete, help }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`mt-1 w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition ${
          error ? 'border-red-500/60 focus:border-red-400' : 'border-slate-800 focus:border-purple-500'
        }`}
      />
      {help && !error && <p className="mt-1 text-xs text-slate-500">{help}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}

