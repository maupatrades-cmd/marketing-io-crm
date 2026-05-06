import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  PAYFAST_PACKAGES,
  TEST_PAGE_PACKAGE_IDS,
} from '@/config/payfastPackages';

// /payfast-test is the developer debug page. Filtered to a small subset of
// the real catalogue so the form stays scannable.
const DEBUG_PACKAGES = TEST_PAGE_PACKAGE_IDS
  .map((id) => PAYFAST_PACKAGES.find((p) => p.id === id))
  .filter(Boolean);
const DEBUG_DEFAULT_ID = DEBUG_PACKAGES[0]?.id;

// Step 4 of 10 — PayFast test form with dynamic package + m_payment_id.
//
// The amount/item_name/item_description are NOT sent from the browser. We
// only send package_id; the function looks the rest up in its mirrored
// catalogue. That way a tampered DevTools request can at worst pick a
// different package — never set R3,980 to R10.

const DEFAULTS = {
  name_first:    'John',
  name_last:     'Doe',
  email_address: 'john@doe.com',
  cell_number:   '0823456789',
};

// Show the user their reference for ~1 second before redirecting. Long
// enough to read, short enough not to feel laggy.
const REFERENCE_VISIBLE_MS = 1100;

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

function formatRand(amount) {
  // amount is always "1234.56"; render as R1,234.56.
  const [whole, cents] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `R${grouped}.${cents}`;
}

export default function PayfastTest() {
  const [packageId, setPackageId] = useState(DEBUG_DEFAULT_ID);
  const [customer, setCustomer] = useState(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState(null);
  const [error, setError] = useState(null);

  const selectedPackage = DEBUG_PACKAGES.find((p) => p.id === packageId)
    || DEBUG_PACKAGES[0];

  const handleChange = (key) => (e) =>
    setCustomer((prev) => ({ ...prev, [key]: e.target.value }));

  const handlePay = async (e) => {
    e.preventDefault();
    setError(null);
    setReference(null);
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('payfast-sign', {
        package_id:    packageId,
        name_first:    customer.name_first,
        name_last:     customer.name_last,
        email_address: customer.email_address,
        cell_number:   customer.cell_number,
      });
      const data = res?.data ?? res;
      if (!data?.fields || !data?.process_url) {
        console.error('[PayfastTest] payfast-sign returned no fields/process_url:', res);
        setError(data?.error || 'Could not sign the payment form. Please try again.');
        setSubmitting(false);
        return;
      }

      // Show the reference briefly, then hand off to PayFast.
      setReference(data.m_payment_id || data.fields.m_payment_id || null);
      setTimeout(() => {
        postSignedFormToPayFast(data.process_url, data.fields);
      }, REFERENCE_VISIBLE_MS);
    } catch (err) {
      console.error('[PayfastTest] sign request failed:', err);
      setError('Could not reach the signing service. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold gradient-text">PayFast Test Checkout</h1>
          <p className="text-xs text-slate-500 mt-1">Step 4 — dynamic package + reference</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs text-slate-400 uppercase tracking-wider mb-1">
            Choose package
          </legend>
          {DEBUG_PACKAGES.map((pkg) => {
            const checked = packageId === pkg.id;
            return (
              <label
                key={pkg.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                  checked
                    ? 'border-purple-500 bg-purple-950/30'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="package"
                    value={pkg.id}
                    checked={checked}
                    onChange={() => setPackageId(pkg.id)}
                    className="accent-purple-500"
                  />
                  <div>
                    <p className="font-medium text-sm">{pkg.name}</p>
                    <p className="text-xs text-slate-500">{pkg.description}</p>
                  </div>
                </div>
                <span className="font-bold text-emerald-400 whitespace-nowrap">
                  {formatRand(pkg.amount)}
                </span>
              </label>
            );
          })}
        </fieldset>

        <form onSubmit={handlePay} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={customer.name_first}    onChange={handleChange('name_first')}    />
            <Field label="Last name"  value={customer.name_last}     onChange={handleChange('name_last')}     />
          </div>
          <Field label="Email"        value={customer.email_address} onChange={handleChange('email_address')} type="email" />
          <Field label="Cell number"  value={customer.cell_number}   onChange={handleChange('cell_number')}   inputMode="tel" />

          {error && (
            <div className="bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          {reference && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 rounded-xl p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-emerald-300/80">Your reference</p>
              <p className="font-mono mt-1 break-all">{reference}</p>
              <p className="text-xs text-emerald-400/70 mt-1">Redirecting to PayFast…</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-br from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-[1.02] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? reference ? 'Redirecting…' : 'Signing…'
              : `Pay Now — ${formatRand(selectedPackage.amount)}`}
          </button>
        </form>

        <div className="text-xs text-slate-400 border-t border-slate-800 pt-4 leading-relaxed">
          <p className="font-semibold text-slate-300 mb-1">Test instructions</p>
          <p>
            Pick a package (Sandbox Test = R10.00 is selected by default), tweak the customer
            fields if you like, then click <strong>Pay Now</strong>. You'll see your reference
            number for ~1 second, then the browser redirects to{' '}
            <code className="text-slate-200">sandbox.payfast.co.za</code>. Use sandbox test card{' '}
            <code className="text-slate-200">4000 0000 0000 0002</code>, any future expiry, any CVV.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', inputMode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
      />
    </label>
  );
}
