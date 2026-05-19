import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// LB-031c: Confirmation + post-lockdown landing page.
// The "this wasn't me" email link points here (passive React route) so that
// email-client link previewers (Outlook/Gmail/iOS Mail) cannot silently
// fire the destructive lockdown POST. The real lockdown only happens when
// the user explicitly clicks the red button below.
export default function AccountLockedDown() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();

  const [phase, setPhase] = useState('confirm'); // 'confirm' | 'working' | 'done' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const handleConfirm = async () => {
    if (!token || phase === 'working') return;
    setPhase('working');
    try {
      const res = await base44.functions.invoke('emergency-account-lockdown', { token });
      const data = res?.data ?? res;
      if (data?.error) {
        setErrorMessage(data.message || 'This lockdown link is invalid or has expired.');
        setPhase('error');
        return;
      }
      setPhase('done');
    } catch (err) {
      const detail = err?.response?.data?.message || err?.response?.data?.error;
      setErrorMessage(detail || 'Could not complete the lockdown. Please contact info@marketingio.co.za.');
      setPhase('error');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #0A0F1C 0%, #1a0a2e 40%, #0d1a3a 100%)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-8 text-white"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 30px 70px -15px rgba(0,0,0,0.6)',
        }}
      >
        {!token && (
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h1 className="text-2xl font-bold mb-2">Invalid lockdown link</h1>
            <p className="text-slate-300 mb-6">
              This page needs a valid lockdown token from your password-change confirmation email.
              If you didn't change your password and didn't receive an email, contact{' '}
              <a href="mailto:info@marketingio.co.za" className="text-pink-300 underline">info@marketingio.co.za</a>.
            </p>
            <Link to="/login" className="text-sm text-slate-400 hover:text-white underline">Back to login</Link>
          </div>
        )}

        {token && phase === 'confirm' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-8 h-8 text-rose-400 shrink-0" />
              <h1 className="text-2xl font-bold">Confirm account lockdown</h1>
            </div>
            <p className="text-slate-300 mb-3">
              You're about to lock down your Marketing iO account because your password was just changed and it
              <strong> wasn't you</strong>.
            </p>
            <p className="text-slate-300 mb-2">Clicking the red button below will:</p>
            <ul className="list-disc list-inside text-slate-300 mb-6 space-y-1">
              <li>Sign you out of every device immediately</li>
              <li>Require you to reset your password before logging in again</li>
              <li>Alert the Marketing iO team to investigate</li>
            </ul>
            <p className="text-amber-300 text-sm mb-6">
              Only click if you did not change your password. This action cannot be undone from this page.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-3 rounded-lg font-semibold text-white text-sm transition hover:brightness-110"
              style={{ background: '#dc2626', boxShadow: '0 10px 30px -10px rgba(220,38,38,0.7)' }}
            >
              🔒 Yes — lock down my account now
            </button>
            <div className="text-center mt-4">
              <Link to="/login" className="text-sm text-slate-400 hover:text-white underline">
                Cancel — this was me
              </Link>
            </div>
          </>
        )}

        {token && phase === 'working' && (
          <div className="text-center py-6">
            <Loader2 className="w-10 h-10 text-pink-400 mx-auto mb-3 animate-spin" />
            <p className="text-slate-300">Locking down your account…</p>
          </div>
        )}

        {token && phase === 'done' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              <h1 className="text-2xl font-bold">Account locked down</h1>
            </div>
            <p className="text-slate-300 mb-3">
              We've signed you out of every device and frozen your account. The Marketing iO security team has been alerted.
            </p>
            <p className="text-slate-300 mb-6">
              <strong>Check your email</strong> — we've sent you a password reset link. If you don't see it within a few
              minutes, check your spam folder or contact{' '}
              <a href="mailto:info@marketingio.co.za" className="text-pink-300 underline">info@marketingio.co.za</a>.
            </p>
            <Link
              to="/login"
              className="block w-full text-center py-3 rounded-lg font-semibold text-white text-sm transition hover:brightness-110"
              style={{ background: '#0A1F44', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Back to login
            </Link>
          </>
        )}

        {token && phase === 'error' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
              <h1 className="text-2xl font-bold">Could not lock down account</h1>
            </div>
            <p className="text-slate-300 mb-6">{errorMessage}</p>
            <Link
              to="/login"
              className="block w-full text-center py-3 rounded-lg font-semibold text-white text-sm transition hover:brightness-110"
              style={{ background: '#0A1F44', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
