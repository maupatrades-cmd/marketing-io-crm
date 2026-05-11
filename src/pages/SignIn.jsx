import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
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

const WELCOME_TEXT = "Welcome back";
const BUBBLE_TEXT = "Done hiding your business? Same here. Let's market it.";

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

  // Animation states
  const [typedText, setTypedText] = useState('');
  const [mascotSlid, setMascotSlid] = useState(false);
  const [waving, setWaving] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [typedBubble, setTypedBubble] = useState('');

  useEffect(() => {
    // 1. Mascot slides in after 300ms
    const slideTimer = setTimeout(() => {
      setMascotSlid(true);

      // 2. Wave after slide-in completes (~700ms)
      setTimeout(() => {
        setWaving(true);

        // 3. Show bubble after wave starts (~400ms)
        setTimeout(() => {
          setShowBubble(true);

          // 4. Type bubble text
          let i = 0;
          const bubbleTyper = setInterval(() => {
            i++;
            setTypedBubble(BUBBLE_TEXT.slice(0, i));
            if (i >= BUBBLE_TEXT.length) clearInterval(bubbleTyper);
          }, 28);

          // 5. Stop waving after 2.5s
          setTimeout(() => setWaving(false), 2500);

        }, 400);
      }, 700);
    }, 300);

    // Type "Welcome back" heading — starts after 1.2s
    const headingTimer = setTimeout(() => {
      let j = 0;
      const headingTyper = setInterval(() => {
        j++;
        setTypedText(WELCOME_TEXT.slice(0, j));
        if (j >= WELCOME_TEXT.length) clearInterval(headingTyper);
      }, 80);
      return () => clearInterval(headingTyper);
    }, 1200);

    return () => {
      clearTimeout(slideTimer);
      clearTimeout(headingTimer);
    };
  }, []);

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
        password
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
        setError('Account temporarily locked. Please try again later or reset your password.');
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
    <div className="min-h-screen flex overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #12102a 50%, #0a0a14 100%)' }}>

      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #a764e6, transparent 70%)', transform: 'translate(-40%, -40%)' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)', transform: 'translate(40%, 40%)' }} />
      </div>

      <style>{`
        @keyframes waveHand {
          0%, 100% { transform: rotate(0deg); transform-origin: bottom right; }
          20% { transform: rotate(-20deg); transform-origin: bottom right; }
          40% { transform: rotate(15deg); transform-origin: bottom right; }
          60% { transform: rotate(-20deg); transform-origin: bottom right; }
          80% { transform: rotate(10deg); transform-origin: bottom right; }
        }
        @keyframes mascotBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bubblePop {
          0% { transform: scale(0) translateY(10px); opacity: 0; }
          60% { transform: scale(1.05) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mascot-wave {
          animation: waveHand 0.6s ease-in-out 3;
        }
        .mascot-bob {
          animation: mascotBob 3s ease-in-out infinite;
        }
        .cursor-blink::after {
          content: '|';
          animation: blink 0.7s step-end infinite;
          color: #a764e6;
          margin-left: 1px;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* LEFT — Mascot area */}
      <div className="relative flex-1 flex items-end justify-start overflow-hidden min-h-screen">

        {/* Mascot container — slides in from left */}
        <div
          className="absolute bottom-0 left-0 flex flex-col items-start"
          style={{
            transform: mascotSlid ? 'translateX(0)' : 'translateX(-110%)',
            transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Speech bubble */}
          {showBubble && (
            <div
              className="relative mb-4 ml-6 max-w-xs"
              style={{ animation: 'bubblePop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
            >
              <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-xl">
                <p className="text-slate-800 text-sm font-medium leading-snug" style={{ minHeight: '3em' }}>
                  {typedBubble}
                  {typedBubble.length < BUBBLE_TEXT.length && (
                    <span className="inline-block w-0.5 h-4 bg-slate-600 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              </div>
              {/* Bubble tail */}
              <div className="absolute -bottom-2 left-6 w-0 h-0" style={{
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '10px solid white',
              }} />
            </div>
          )}

          {/* Mascot image — half body cropped at bottom */}
          <div
            className={mascotSlid && !waving ? 'mascot-bob' : ''}
            style={{ position: 'relative' }}
          >
            <img
              src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/064a31584_io_astronaut_transparent.png"
              alt="Marketing iO Mascot"
              className={waving ? 'mascot-wave' : ''}
              style={{
                width: '320px',
                height: '420px',
                objectFit: 'cover',
                objectPosition: 'top center',
                filter: 'drop-shadow(0 0 30px rgba(167,100,230,0.45))',
                display: 'block',
              }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT — Login form */}
      <div className="w-full max-w-md flex flex-col justify-center px-8 py-12 relative z-10 min-h-screen">

        {/* Logo */}
        <div className="mb-6 text-center">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
            alt="Marketing iO"
            className="h-32 mx-auto object-contain"
            style={{ filter: "drop-shadow(0 0 2px white) drop-shadow(0 0 4px white) brightness(1.1)" }}
          />
        </div>

        {/* Animated heading */}
        <div className="mb-6 text-center">
          <h1
            className={`text-3xl font-bold text-white ${typedText.length < WELCOME_TEXT.length ? 'cursor-blink' : ''}`}
            style={{ animation: typedText.length === WELCOME_TEXT.length ? 'fadeSlideUp 0.4s ease forwards' : 'none', minHeight: '2.5rem' }}
          >
            {typedText}
          </h1>
          <p className="text-slate-400 mt-2 text-sm" style={{ animation: 'fadeSlideUp 0.5s ease 1.8s both' }}>
            Sign in to your Marketing iO account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl p-6 border border-white/10" style={{ background: 'rgba(28,28,48,0.75)', backdropFilter: 'blur(14px)' }}>
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
              className="w-full border text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)' }}
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
                className="w-full border text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)' }}
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
              className="w-full border text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)' }}
              placeholder="Answer"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 hover:opacity-90 active:scale-95"
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