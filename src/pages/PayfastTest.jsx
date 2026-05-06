import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Step 2 of 10 — PayFast test form.
// Hardcoded amount + item_name on purpose. Real values come in step 4.
const TEST_AMOUNT = '3980.00';
const TEST_ITEM_NAME = 'Ignite Setup';

export default function PayfastTest() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke('payfast-test-config', {})
      .then((res) => {
        const data = res?.data ?? res;
        if (!data?.merchant_id || !data?.process_url) {
          setError(data?.error || 'Could not load PayFast config.');
          return;
        }
        setConfig(data);
      })
      .catch((err) => {
        console.error('[PayfastTest] config fetch failed:', err);
        setError('Could not load PayFast config.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold gradient-text">PayFast Test Checkout</h1>
          <p className="text-xs text-slate-500 mt-1">Step 2 — sandbox redirect smoke test</p>
        </div>

        <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Package</p>
          <p className="text-xl font-semibold mt-1">Ignite Setup</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">R3,980.00</p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {!config && !error && (
          <div className="text-slate-400 text-sm">Loading PayFast config…</div>
        )}

        {config && (
          <form action={config.process_url} method="post" className="space-y-4">
            <input type="hidden" name="merchant_id"  value={config.merchant_id} />
            <input type="hidden" name="merchant_key" value={config.merchant_key} />
            <input type="hidden" name="return_url"   value={config.return_url} />
            <input type="hidden" name="cancel_url"   value={config.cancel_url} />
            <input type="hidden" name="notify_url"   value={config.notify_url} />
            <input type="hidden" name="amount"       value={TEST_AMOUNT} />
            <input type="hidden" name="item_name"    value={TEST_ITEM_NAME} />

            <button
              type="submit"
              className="w-full bg-gradient-to-br from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-[1.02] transition"
            >
              Pay Now — R3,980.00
            </button>
          </form>
        )}

        <div className="text-xs text-slate-400 border-t border-slate-800 pt-4 leading-relaxed">
          <p className="font-semibold text-slate-300 mb-1">Test instructions</p>
          <p>
            Click <strong>Pay Now</strong> → you should be redirected to{' '}
            <code className="text-slate-200">sandbox.payfast.co.za</code>. Use sandbox test card{' '}
            <code className="text-slate-200">4000 0000 0000 0002</code>, any future expiry, any CVV.
          </p>
          <p className="mt-2 text-slate-500">
            The sandbox payment will be <strong>rejected</strong> at this stage because the form
            has no signature yet — that's expected. We're only confirming the redirect works.
          </p>
        </div>
      </div>
    </div>
  );
}
