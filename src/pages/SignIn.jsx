import { useState, useEffect } from 'react';
import Mascot from '@/components/Mascot';
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
  const [welcomeText, setWelcomeText] = useState('');
  const [mascotLanded, setMascotLanded] = useState(false);
  const [bubbleText, setBubbleText] = useState('');
  const [bubblePhase, setBubblePhase] = useState(0);

  useEffect(() => {
    const full = 'Welcome back';
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setWelcomeText(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 115);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mascotLanded) return undefined;

    const PHASES = [
      { text: 'Tired of hiding? Same here.', bold: false },
      { text: 'Sign in. Be seen.', bold: true },
    ];
    const CHAR_MS = 70;
    const HOLD_MS = 1100;
    const START_MS = 250;

    let timer;

    const typeOut = (text, onDone) => {
      let i = 0;
      setBubbleText('');
      const step = () => {
        i += 1;
        setBubbleText(text.slice(0, i));
        if (i < text.length) {
          timer = setTimeout(step, CHAR_MS);
        } else {
          timer = setTimeout(onDone, HOLD_MS);
        }
      };
      timer = setTimeout(step, START_MS);
    };

    const runPhase = (n) => {
      if (n >= PHASES.length) return;
      setBubblePhase(n + 1);
      typeOut(PHASES[n].text, () => {
        if (n + 1 < PHASES.length) runPhase(n + 1);
      });
    };

    runPhase(0);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [mascotLanded]);

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
      if (status === 423 && detail === 'password_reset_required') {
        navigate(`/account-recovery?email=${encodeURIComponent(email.toLowerCase().trim())}`);
        return;
      } else if (status === 423) {
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

  const inputCls = "w-full bg-white border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A1F44] placeholder-gray-400";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6 relative overflow-hidden bg-white">
      {/* Subtle brand hints */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #0A1F44, #E63946)' }} />
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: 'radial-gradient(circle, #0A1F44 0%, #E63946 70%, transparent 100%)' }} />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 flex flex-col items-center mb-10"
      >
        <img
          src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
          alt="Marketing iO"
          className="h-32 sm:h-40 object-contain"
          style={{ filter: 'drop-shadow(0 0 18px rgba(10,31,68,0.55)) drop-shadow(0 0 36px rgba(230,57,70,0.40)) brightness(1.05)' }}
        />
        <p
          className="text-center font-semibold tracking-widest uppercase select-none mt-1"
          style={{ fontSize: '12px', letterSpacing: '3px', color: '#E63946' }}
        >
          Too Good To Stay Hidden
        </p>
        <div
          className="font-bold select-none mt-2"
          style={{ fontSize: '22px', minHeight: '36px', color: '#0A1F44' }}
          aria-label="Welcome back"
        >
          {welcomeText}
          <span className="mio-caret" aria-hidden="true">|</span>
          <style>{`
            @keyframes mio-caret-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
            .mio-caret { display: inline-block; margin-left: 2px; color: #E63946; animation: mio-caret-blink 0.9s steps(1) infinite; }
          `}</style>
        </div>
      </motion.div>

      {/* Card + mascot wrapper */}
      <div className="relative w-full max-w-sm z-10">

        {/* Mascot */}
        <motion.div
          initial={{ x: '-120vw', rotate: -720, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={{ delay: 1.5, duration: 1.9, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => setMascotLanded(true)}
          style={{
            position: 'absolute', top: '-55px', left: '50%', marginLeft: '-60px',
            width: '120px', height: '120px', zIndex: 30,
            pointerEvents: 'none', background: 'transparent',
          }}
        >
          <Mascot size={120} style={{ background: 'transparent' }} />
        </motion.div>

        {/* Speech bubble — desktop */}
        {mascotLanded && (
          <>
            <motion.div
              className="hidden sm:block"
              initial={{ opacity: 0, scale: 0.6, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute', top: '-38px', left: 'calc(50% + 62px)',
                width: '172px', background: '#ffffff', borderRadius: '14px',
                padding: '10px 13px', boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                zIndex: 35, pointerEvents: 'none', border: '1px solid #E3E3E3',
              }}
              role="status" aria-live="polite"
            >
              <div style={{ color: '#0A0A0F', fontWeight: bubblePhase === 2 ? 700 : 400, fontSize: bubblePhase === 2 ? '15px' : '13px', lineHeight: 1.35, minHeight: '32px' }}>
                {bubbleText}
                <span className="mio-bubble-caret" aria-hidden="true">|</span>
              </div>
              <span aria-hidden="true" style={{ position: 'absolute', top: '28px', left: '-12px', width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '13px solid #ffffff', filter: 'drop-shadow(-3px 2px 2px rgba(0,0,0,0.06))' }} />
              <style>{`@keyframes mio-bubble-caret-blink{0%,49%{opacity:1;}50%,100%{opacity:0;}} .mio-bubble-caret{display:inline-block;margin-left:2px;color:#0A0A0F;animation:mio-bubble-caret-blink 0.85s steps(1) infinite;}`}</style>
            </motion.div>

            {/* Mobile bubble */}
            <motion.div
              className="block sm:hidden"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                marginTop: '70px', marginLeft: '12px', marginRight: '12px',
                background: '#ffffff', borderRadius: '14px', padding: '10px 14px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.10)', zIndex: 35,
                pointerEvents: 'none', border: '1px solid #E3E3E3',
              }}
              role="status" aria-live="polite"
            >
              <div style={{ color: '#0A0A0F', fontWeight: bubblePhase === 2 ? 700 : 400, fontSize: bubblePhase === 2 ? '15px' : '13px', lineHeight: 1.35 }}>
                {bubbleText}
                <span className="mio-bubble-caret" aria-hidden="true">|</span>
              </div>
            </motion.div>
          </>
        )}

        {/* Login card */}
        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          onSubmit={handleSubmit}
          className="relative w-full rounded-2xl p-6 pt-10 space-y-4 bg-white"
          style={{ border: '1px solid #E3E3E3', boxShadow: '0 4px 24px rgba(10,31,68,0.08)' }}
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className={`${inputCls} pr-10`} placeholder="Your password" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-right mt-1">
              <Link to="/forgot-password" className="text-xs text-[#0A1F44] hover:underline font-medium">Forgot password?</Link>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Security check: {captcha.question} = ?</label>
            <input type="number" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} required className={inputCls} placeholder="Answer" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 hover:brightness-110"
            style={{ background: '#0A1F44', boxShadow: '0 4px 14px rgba(10,31,68,0.25)' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#0A1F44] font-semibold hover:underline">Sign up</Link>
          </p>
        </motion.form>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6 relative z-10">
        Need help?{' '}
        <a href="mailto:support@marketingio.co.za" className="text-gray-500 hover:text-gray-700">support@marketingio.co.za</a>
      </p>
    </div>
  );
}