import { useState } from 'react';
import AnimatedBot from '@/components/auth/AnimatedBot';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';

function makeCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}

const SAFE_NEXT_RE = /^\/portal\/checkout\/[a-z0-9][a-z0-9-]{0,49}$/;
function safeNext(raw) {
  const v = String(raw || '').trim();
  return SAFE_NEXT_RE.test(v) ? v : '';
}



export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [captcha] = useState(makeCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mascotDone, setMascotDone] = useState(false);

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
      const res = await base44.functions.invoke('auth-login', {
        email: email.toLowerCase().trim(),
        password,
      });
      const data = res.data;

      const nextParam = next ? `&next=${encodeURIComponent(next)}` : '';
      if (data.needs_verification) {
        navigate(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=signup_verification${nextParam}`);
        return;
      }
      if (data.needs_otp) {
        localStorage.setItem('mio_pending_login', JSON.stringify({ email: data.email, user_id: data.user_id }));
        navigate(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=login_mfa${nextParam}`);
        return;
      }
      if (data.token) {
        base44.auth.setToken(data.token);
        localStorage.setItem('mio_session_token', data.token);
        window.location.href = next || '/client-portal';
        return;
      }
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error;
      if (status === 423) {
        setError('Account temporarily locked due to multiple failed attempts. Please try again later or reset your password.');
      } else if (status === 401 && detail?.includes('not found')) {
        setError('No account found with this email. Please sign up first.');
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0A0F1C 0%, #1a0a2e 40%, #0d1a3a 100%)',
      }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7729FF 0%, #FF2994 50%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #00CCFF 0%, transparent 70%)' }} />
      </div>

      {/* Logo */}
      <motion.img
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
        alt="Marketing iO"
        className="h-20 object-contain mb-1 relative z-10"
        style={{
          filter: 'drop-shadow(0 0 14px rgba(119,41,255,0.7)) drop-shadow(0 0 28px rgba(255,41,148,0.5)) brightness(1.1)',
        }}
      />

      {/* Card + mascot wrapper */}
      <div className="relative w-full max-w-sm z-10">

        {/* Mascot wrapper — centered, overlapping the top of the card */}
        <div style={{
          position: 'absolute',
          top: '-170px',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 20,
          pointerEvents: 'none',
          height: '200px',
        }}>
          {!mascotDone ? (
            <motion.div
              initial={{ x: '-110vw' }}
              animate={{ x: 0 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => setMascotDone(true)}
              style={{ width: '220px', height: '220px', flexShrink: 0 }}
            >
              <AnimatedBot style={{ width: '100%', height: '100%' }} />
            </motion.div>
          ) : (
            <AnimatedBot style={{ width: '220px', height: '220px' }} />
          )}
        </div>

        {/* Login card */}
        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          onSubmit={handleSubmit}
          className="relative w-full rounded-2xl p-6 pt-14 space-y-4"
          style={{
            background: 'rgba(17, 24, 39, 0.88)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(119,41,255,0.35)',
            boxShadow: '0 30px 70px -15px rgba(119,41,255,0.5), 0 0 0 1px rgba(255,41,148,0.07) inset',
          }}
        >
          <h2 className="text-center text-xl font-bold text-white">Welcome back 👋</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#1A2235] border border-[#7729FF]/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7729FF]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#1A2235] border border-[#7729FF]/20 text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#7729FF]"
                placeholder="Your password"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-right mt-1">
              <Link to="/forgot-password" className="text-xs text-[#FF2994] hover:text-[#7729FF] transition-colors">
                Forgot password?
              </Link>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Security check: {captcha.question} = ?
            </label>
            <input
              type="number"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              required
              className="w-full bg-[#1A2235] border border-[#7729FF]/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7729FF]"
              placeholder="Answer"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #7729FF 0%, #FF2994 100%)',
              boxShadow: '0 10px 30px -10px rgba(119,41,255,0.6)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#FF2994] hover:text-[#7729FF] transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </motion.form>
      </div>

      <p className="text-center text-xs text-slate-600 mt-6 relative z-10">
        Need help?{' '}
        <a href="mailto:support@marketingio.co.za" className="text-slate-500 hover:text-slate-400">
          support@marketingio.co.za
        </a>
      </p>
    </div>
  );
}