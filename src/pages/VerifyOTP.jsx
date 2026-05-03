import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createSession, generateOTP } from '@/lib/customAuth';

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
      const now = new Date();
      const otps = await base44.entities.OTPCode.filter({ email, purpose, used: false });

      if (!otps || otps.length === 0) {
        setError('No valid code found. Please request a new one.');
        setLoading(false);
        return;
      }

      // Find matching unexpired code
      const match = otps.find(o => o.code === code && new Date(o.expires_at) > now);
      if (!match) {
        setError('Code is incorrect or has expired. Please try again or resend.');
        setLoading(false);
        return;
      }

      // Mark used
      await base44.entities.OTPCode.update(match.id, { used: true, used_at: now.toISOString() });

      // Get user
      const users = await base44.entities.User.filter({ email });
      if (!users || users.length === 0) { setError('User not found.'); setLoading(false); return; }
      const user = users[0];

      if (purpose === 'signup_verification') {
        await base44.entities.User.update(user.id, { pending_verification: false, email_verified: true });
        await createSession(user.id);
        window.location.href = '/client-portal';
      } else if (purpose === 'login_mfa') {
        await base44.entities.User.update(user.id, { failed_login_count: 0, last_login_at: now.toISOString() });
        await createSession(user.id);
        const role = user.role;
        if (role === 'owner') { window.location.href = '/'; }
        else if (role === 'client') { window.location.href = '/client-portal'; }
        else { window.location.href = '/staff'; }
      } else if (purpose === 'password_reset') {
        // Reuse existing reset flow — redirect to reset-password with token
        const token = match.code;
        navigate(`/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCount >= 3) { setError('Maximum resend attempts reached. Please go back and try again.'); return; }
    if (resendCooldown > 0) return;

    try {
      const otp = generateOTP();
      const expires = new Date(Date.now() + (purpose === 'signup_verification' ? 15 : 10) * 60 * 1000).toISOString();
      const users = await base44.entities.User.filter({ email });
      const userId = users?.[0]?.id;
      const fullName = users?.[0]?.full_name || 'there';

      await base44.entities.OTPCode.create({
        email,
        code: otp,
        purpose,
        expires_at: expires,
        used: false,
        generated_at: new Date().toISOString(),
        user_id: userId
      });

      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Your new Marketing iO verification code',
        body: `Hi ${fullName},\n\nYour new verification code is: ${otp}\n\nThis code expires in ${purpose === 'signup_verification' ? '15' : '10'} minutes.\n\n— The Marketing iO Team`
      });

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
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="h-10 mx-auto mb-4 object-contain"
            style={{ filter: 'invert(1) brightness(2)', mixBlendMode: 'screen' }}
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