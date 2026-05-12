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
  const [bubblePhase, setBubblePhase] = useState(0); // 0 idle, 1 question, 2 reply

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
      { text: 'Done hiding your Business?' },
      { text: 'Same here...' },
      { text: 'Login in Now and let us market it!!' },
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

      {/* Logo — bigger */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 flex flex-col items-center mb-3"
      >
        <img
          src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
          alt="Marketing iO"
          className="h-52 sm:h-64 object-contain"
          style={{
            filter: 'drop-shadow(0 0 14px rgba(119,41,255,0.7)) drop-shadow(0 0 28px rgba(255,41,148,0.5)) brightness(1.1)',
          }}
        />
        {/* Tagline */}
        <p
          className="text-center font-semibold tracking-widest uppercase select-none mt-1"
          style={{
            fontSize: '13px',
            letterSpacing: '3px',
            background: 'linear-gradient(90deg, #a764e6, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
          }}
        >
          Too Good To Stay Hidden
        </p>
      </motion.div>

      {/* Welcome back — typewriter */}
      <div
        className="relative z-10 text-white font-bold mb-8 select-none"
        style={{
          fontSize: '28px',
          letterSpacing: '0.5px',
          textShadow: '0 2px 14px rgba(119,41,255,0.45)',
          minHeight: '38px',
        }}
        aria-label="Welcome back"
      >
        {welcomeText}
        <span className="mio-caret" aria-hidden="true">|</span>
        <style>{`
          @keyframes mio-caret-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
          .mio-caret {
            display: inline-block;
            margin-left: 2px;
            color: #FF2994;
            animation: mio-caret-blink 0.9s steps(1) infinite;
          }
        `}</style>
      </div>

      {/* Card + mascot wrapper */}
      <div className="relative w-full max-w-sm z-10">

        {/* Mascot — rolls in from the left, lands centered, sitting low (just above the email) */}
        <motion.div
          initial={{ x: '-120vw', rotate: -720, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={{ delay: 1.5, duration: 1.9, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => setMascotLanded(true)}
          style={{
            position: 'absolute',
            top: '-120px',
            left: '50%',
            marginLeft: '-100px',
            width: '200px',
            height: '200px',
            zIndex: 30,
            pointerEvents: 'none',
            background: 'transparent',
          }}
        >
          <Mascot size={200} style={{ background: 'transparent' }} />
        </motion.div>

        {/* Speech bubble — sits NEXT TO the mascot, tail pointing left at its mouth.
            Stays below the logo/welcome line and to the right of the mascot. */}
        {mascotLanded && (() => {
          const phaseColor =
            bubblePhase === 1 ? '#0A1F44' :
            bubblePhase === 2 ? '#6B7280' :
            '#E63946';
          const phaseSize =
            bubblePhase === 1 ? '22px' :
            bubblePhase === 2 ? '18px' :
            '24px';
          const phaseWeight = bubblePhase === 2 ? 500 : 700;
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.55, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                top: '-75px',
                left: 'calc(50% + 100px)',
                width: '240px',
                maxWidth: '60vw',
                background: '#ffffff',
                borderRadius: '24px',
                padding: '14px 18px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                zIndex: 35,
                pointerEvents: 'none',
              }}
              role="status"
              aria-live="polite"
            >
              <div
                style={{
                  color: phaseColor,
                  fontWeight: phaseWeight,
                  fontSize: phaseSize,
                  lineHeight: 1.2,
                  minHeight: '46px',
                }}
              >
                {bubbleText}
                <span className="mio-bubble-caret" aria-hidden="true">|</span>
              </div>

              {/* tail — triangle on the LEFT side pointing at the mascot's mouth */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '46px',
                  left: '-13px',
                  width: 0,
                  height: 0,
                  borderTop: '12px solid transparent',
                  borderBottom: '12px solid transparent',
                  borderRight: '14px solid #ffffff',
                  filter: 'drop-shadow(-4px 4px 3px rgba(0,0,0,0.12))',
                }}
              />

              <style>{`
                @keyframes mio-bubble-caret-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
                .mio-bubble-caret {
                  display: inline-block;
                  margin-left: 2px;
                  color: ${phaseColor};
                  animation: mio-bubble-caret-blink 0.85s steps(1) infinite;
                }
              `}</style>
            </motion.div>
          );
        })()}

        {/* Login card */}
        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          onSubmit={handleSubmit}
          className="relative w-full rounded-2xl p-6 pt-10 space-y-4"
          style={{
            background:
              'linear-gradient(135deg, rgba(119,41,255,0.92) 0%, rgba(255,41,148,0.88) 55%, rgba(0,204,255,0.80) 130%)',
            border: '1px solid rgba(255,255,255,0.22)',
            boxShadow:
              '0 30px 70px -15px rgba(119,41,255,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset',
          }}
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-white/90 mb-1">Email address</label>
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
            <label className="block text-sm text-white/90 mb-1">Password</label>
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
              <Link to="/forgot-password" className="text-xs text-white/90 hover:text-white underline transition-colors">
                Forgot password?
              </Link>
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/90 mb-1">
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
              background: '#0A1F44',
              boxShadow: '0 10px 30px -10px rgba(10,31,68,0.7), 0 0 0 1px rgba(255,255,255,0.15) inset',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-white/80">
            Don't have an account?{' '}
            <Link to="/register" className="text-white underline hover:text-white/90 transition-colors font-semibold">
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