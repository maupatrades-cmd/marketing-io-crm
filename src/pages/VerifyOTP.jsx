import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function VerifyOTP() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const email = decodeURIComponent(params.get('email') || '');
  const purpose = params.get('purpose') || 'login_mfa';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let interval;
    if (resendCooldown > 0) {
      interval = setInterval(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('Please enter the 6-digit code.'); return; }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('auth-verify-otp', { email, code, purpose });
      const { token, user } = res.data;

      localStorage.setItem('mio_session_token', token);
      localStorage.setItem('mio_session_user', JSON.stringify(user));

      if (purpose === 'password_reset') {
        navigate(`/reset-password?token=${code}&email=${encodeURIComponent(email)}`);
        return;
      }

      if (user.role === 'owner') { window.location.href = '/'; }
      else if (user.role === 'client') { window.location.href = '/client-portal'; }
      else { window.location.href = '/staff'; }
    } catch (err) {
      setError('Code is incorrect or has expired. Please try again or resend.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCount >= 3) { setError('Maximum resend attempts reached. Please go back and try again.'); return; }
    if (resendCooldown > 0) return;

    try {
      await base44.functions.invoke('resend-otp', { email, purpose });
      setResendCount(c => c + 1);
      setResendCooldown(60);
      setError('');
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }
  };

  const purposeLabel = purpose === 'signup_verification' ? 'verify your account' : 'complete your login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
            alt="Marketing iO"
            className="h-12 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-white">Check your email</h1>
          <p className="text-slate-400 mt-1 text-sm">
            We sent a 6-digit code to <strong className="text-slate-200">{email}</strong> to {purposeLabel}.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4 bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-2 text-center">Enter your 6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 text-2xl text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
          >
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendCount >= 3}
              className="text-sm text-purple-400 hover:text-purple-300 disabled:text-slate-600 disabled:cursor-not-allowed transition"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : resendCount >= 3 ? 'Max resends reached' : 'Resend code'}
            </button>
          </div>

          <p className="text-center text-xs text-slate-500">
            Wrong email?{' '}
            <a href="/login" className="text-purple-400 hover:text-purple-300">Go back</a>
          </p>
        </form>
      </div>
    </div>
  );
}