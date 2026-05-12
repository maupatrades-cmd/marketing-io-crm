import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import Mascot from '@/components/Mascot';

function makeCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}

// Strict whitelist for ?next= — only the portal checkout flow is allowed,
// blocking open-redirect attacks via crafted login links.
const SAFE_NEXT_RE = /^\/portal\/checkout\/[a-z0-9][a-z0-9-]{0,49}$/;
function safeNext(raw) {
  const v = String(raw || '').trim();
  return SAFE_NEXT_RE.test(v) ? v : '';
}

function useTypewriter(text, { speed = 110, startDelay = 0, enabled = true } = {}) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!enabled) return;
    setOut('');
    let i = 0;
    let interval;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setOut(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, speed, startDelay, enabled]);
  return out;
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

  // Mascot + bubble sequencing
  const mascotControls = useAnimation();
  const [mascotLanded, setMascotLanded] = useState(false);
  const [bubble, setBubble] = useState(null); // 'tagline' | 'cta' | null
  const welcome = useTypewriter('Welcome', {
    speed: 130,
    startDelay: 300,
    enabled: mascotLanded,
  });

  useEffect(() => {
    let cancelled = false;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    async function runMascotSequence() {
      // 1. Slide in from left to off-center "waving spot"
      await mascotControls.start({
        x: '-22%',
        opacity: 1,
        transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] },
      });
      if (cancelled) return;

      // 2. Show tagline bubble + wave the hand (slower, fewer oscillations)
      setBubble('tagline');
      await mascotControls.start({
        rotate: [0, -14, 12, -12, 10, 0],
        transition: { duration: 4.2, ease: 'easeInOut' },
      });
      if (cancelled) return;

      // 3. Let the bubble linger a moment before moving
      await wait(1300);
      if (cancelled) return;

      // 4. Glide to centered "holding the card" position
      setBubble(null);
      await mascotControls.start({
        x: '0%',
        transition: { duration: 0.9, ease: 'easeOut' },
      });
      if (cancelled) return;

      // 5. Settled — kick off Welcome typing, then second bubble
      setMascotLanded(true);
      await wait(900);
      if (cancelled) return;
      setBubble('cta');
    }

    runMascotSequence();
    return () => {
      cancelled = true;
    };
  }, [mascotControls]);

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
    <div className="min-h-screen relative overflow-hidden bg-[#0A0F1C] flex flex-col items-center justify-start px-4 pt-8 pb-12">
      {/* Ambient gradient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7729FF 0%, #FF2994 45%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #00CCFF 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center">
        {/* Logo — glowing, big */}
        <motion.img
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
          alt="Marketing iO"
          className="h-64 sm:h-72 object-contain animate-mio-glow"
          style={{
            filter:
              'drop-shadow(0 0 18px rgba(119,41,255,0.75)) drop-shadow(0 0 36px rgba(255,41,148,0.55)) brightness(1.08)',
          }}
        />

        {/* Mascot + typing "Welcome" + speech bubble — overlap the top of the card */}
        <div className="relative w-full h-56 -mb-10">
          {/* "Welcome" typewriter — above mascot head */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-40 whitespace-nowrap pointer-events-none">
            <span
              className="text-4xl sm:text-5xl font-extrabold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #7729FF 0%, #FF2994 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {welcome || ' '}
            </span>
            {mascotLanded && welcome.length < 'Welcome'.length && (
              <span className="text-4xl sm:text-5xl font-extrabold text-[#FF2994] animate-pulse">|</span>
            )}
          </div>

          {/* Mascot — slides in from left, waves, then glides to centered "holding" pose */}
          <motion.div
            initial={{ x: '-160%', opacity: 0, rotate: 0 }}
            animate={mascotControls}
            style={{ originX: 0.5, originY: 1 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[360px] sm:w-[420px] z-20 pointer-events-none"
          >
            <Mascot />
          </motion.div>

          {/* Speech bubble */}
          <AnimatePresence mode="wait">
            {bubble && (
              <motion.div
                key={bubble}
                initial={{ opacity: 0, y: 8, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.85 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="absolute right-0 sm:right-[-10px] top-10 z-30"
              >
                <div className="relative bg-white text-[#0A0F1C] text-sm font-semibold px-4 py-2 rounded-2xl shadow-2xl max-w-[240px] leading-snug">
                  {bubble === 'tagline' ? (
                    <>
                      Done hiding your business?<br />
                      Same here.<br />
                      <span className="bg-gradient-to-r from-[#7729FF] to-[#FF2994] bg-clip-text text-transparent font-bold">Let's market it.</span>
                    </>
                  ) : (
                    'Sign in now ✨'
                  )}
                  <span className="absolute -bottom-1.5 left-6 w-3 h-3 bg-white rotate-45" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sign in card */}
        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          onSubmit={handleSubmit}
          className="relative w-full bg-[#111827]/85 backdrop-blur-xl border border-[#7729FF]/30 rounded-2xl p-6 sm:p-7 space-y-4 z-10"
          style={{ boxShadow: '0 25px 60px -15px rgba(119,41,255,0.45), 0 0 0 1px rgba(255,41,148,0.08) inset' }}
        >
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/40 text-[#EF4444] text-sm rounded-lg px-4 py-3">
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
              className="w-full bg-[#1A2235] border border-[#7729FF]/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7729FF] focus:border-transparent"
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
                className="w-full bg-[#1A2235] border border-[#7729FF]/20 text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#7729FF] focus:border-transparent"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
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
              className="w-full bg-[#1A2235] border border-[#7729FF]/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7729FF] focus:border-transparent"
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

        <p className="text-center text-xs text-slate-600 mt-6">
          Need help?{' '}
          <a href="mailto:support@marketingio.co.za" className="text-slate-500 hover:text-slate-400">
            support@marketingio.co.za
          </a>
        </p>
      </div>

      <style>{`
        @keyframes mio-logo-glow {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(119,41,255,0.75)) drop-shadow(0 0 36px rgba(255,41,148,0.55)) brightness(1.08); }
          50%      { filter: drop-shadow(0 0 28px rgba(119,41,255,0.95)) drop-shadow(0 0 56px rgba(255,41,148,0.75)) brightness(1.15); }
        }
        .animate-mio-glow { animation: mio-logo-glow 3.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
