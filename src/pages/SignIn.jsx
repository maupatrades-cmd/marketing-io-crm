import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { verifyPassword, generateOTP } from '@/lib/customAuth';

function makeCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [captcha] = useState(makeCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (parseInt(captchaInput) !== captcha.answer) {
      setError('Incorrect answer to the security question.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const users = await base44.entities.User.filter({ email: email.toLowerCase().trim() });

      if (!users || users.length === 0) {
        await base44.entities.LoginAttempt.create({ email_attempted: email, success: false, failure_reason: 'account_not_found', attempted_at: new Date().toISOString() });
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }

      const user = users[0];

      // Check lockout
      if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
        setError('Account temporarily locked due to multiple failed attempts. Please try again later or reset your password.');
        setLoading(false);
        return;
      }

      // Check pending verification
      if (user.pending_verification) {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}&purpose=signup_verification`);
        return;
      }

      // Verify password
      const valid = verifyPassword(password, user.password_hash);
      if (!valid) {
        const newCount = (user.failed_login_count || 0) + 1;
        const updateData = { failed_login_count: newCount };
        if (newCount >= 5) {
          updateData.lockout_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }
        await base44.entities.User.update(user.id, updateData);
        await base44.entities.LoginAttempt.create({ email_attempted: email, success: false, failure_reason: 'wrong_password', attempted_at: new Date().toISOString(), user_id: user.id });
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }

      // Send MFA OTP
      const otp = generateOTP();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await base44.entities.OTPCode.create({
        email: email.toLowerCase().trim(),
        code: otp,
        purpose: 'login_mfa',
        expires_at: expires,
        used: false,
        generated_at: new Date().toISOString(),
        user_id: user.id
      });

      try {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: `Your Marketing iO login code: ${otp}`,
          body: `Hi ${user.full_name || 'there'},\n\nYour login code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't try to log in, please contact info@marketingio.co.za immediately.\n\n— The Marketing iO Team`
        });
      } catch (emailErr) {
        console.error('OTP email failed:', emailErr);
      }

      navigate(`/verify-otp?email=${encodeURIComponent(email.toLowerCase().trim())}&purpose=login_mfa`);
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to your Marketing iO account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your password"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-right mt-1">
              <Link to="/forgot-password" className="text-xs text-purple-400 hover:text-purple-300">Forgot password?</Link>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Security check: {captcha.question} = ?</label>
            <input
              type="number"
              value={captchaInput}
              onChange={e => setCaptchaInput(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Answer"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-purple-400 hover:text-purple-300 font-medium">Sign up</Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Need help?{' '}
          <a href="mailto:support@marketingio.co.za" className="text-slate-500 hover:text-slate-400">support@marketingio.co.za</a>
        </p>
      </div>
    </div>
  );
}