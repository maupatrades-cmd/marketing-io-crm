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
  const [typedWelcome, setTypedWelcome] = useState('');
  const [mascotVisible, setMascotVisible] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [typedBubble, setTypedBubble] = useState('');
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    // Step 1: mascot drops in from top
    const t1 = setTimeout(() => setMascotVisible(true), 400);

    // Step 2: speech bubble pops up
    const t2 = setTimeout(() => {
      setShowBubble(true);
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setTypedBubble(BUBBLE_TEXT.slice(0, i));
        if (i >= BUBBLE_TEXT.length) clearInterval(iv);
      }, 30);
    }, 1100);

    // Step 3: form fades in
    const t3 = setTimeout(() => setFormVisible(true), 900);

    // Step 4: type "Welcome back"
    const t4 = setTimeout(() => {
      let j = 0;
      const iv2 = setInterval(() => {
        j++;
        setTypedWelcome(WELCOME_TEXT.slice(0, j));
        if (j >= WELCOME_TEXT.length) clearInterval(iv2);
      }, 90);
    }, 1000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #12102a 50%, #0a0a14 100%)' }}
    >
      <style>{`
        @keyframes mascotDrop {
          0% { transform: translateY(-120px); opacity: 0; }
          60% { transform: translateY(10px); opacity: 1; }
          80% { transform: translateY(-4px); }
          100% { transform: translateY(0px); opacity: 1; }
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bubblePop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes formFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(167,100,230,0.3); }
          50% { box-shadow: 0 0 50px rgba(167,100,230,0.55), 0 0 80px rgba(236,72,153,0.2); }
        }
        .mascot-drop {
          animation: mascotDrop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .mascot-bob {
          animation: bob 3s ease-in-out infinite;
        }
        .bubble-pop {
          animation: bubblePop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .form-fade {
          animation: formFade 0.5s ease forwards;
        }
        .card-glow {
          animation: glowPulse 3s ease-in-out infinite;
        }
        .cursor-blink::after {
          content: '|';
          color: #a764e6;
          animation: blink 0.7s step-end infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; } 50% { opacity: 0; }
        }
      `}</style>

      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #a764e6, transparent 70%)', transform: 'translateY(-50%)' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)', transform: 'translateY(50%)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Mascot peeking from top */}
        <div className="flex flex-col items-center" style={{ marginBottom: '-2px' }}>

          {/* Speech bubble — appears above mascot */}
          {showBubble && (
            <div className="bubble-pop mb-3 relative max-w-xs">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-2xl text-center">
                <p className="text-slate-800 text-sm font-medium leading-snug">
                  {typedBubble}
                  {typedBubble.length < BUBBLE_TEXT.length && (
                    <span className="inline-block w-0.5 h-3.5 bg-slate-700 ml-0.5 align-middle animate-pulse" />
                  )}
                </p>
              </div>
              {/* Tail pointing down toward mascot */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
                style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '10px solid white' }} />
            </div>
          )}

          {/* Mascot image — top half peeking over card */}
          <div
            className={mascotVisible ? (showBubble ? 'mascot-bob' : 'mascot-drop') : ''}
            style={{ opacity: mascotVisible ? 1 : 0 }}
          >
            <img
              src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/064a31584_io_astronaut_transparent.png"
              alt="Marketing iO Mascot"
              style={{
                width: '180px',
                height: '200px',
                objectFit: 'cover',
                objectPosition: 'top center',
                filter: 'drop-shadow(0 8px 24px rgba(167,100,230,0.5))',
                display: 'block',
              }}
            />
          </div>
        </div>

        {/* Login card */}
        <div
          className={`rounded-2xl border border-white/10 px-7 py-8 card-glow ${formVisible ? 'form-fade' : 'opacity-0'}`}
          style={{ background: 'rgba(20,18,40,0.92)', backdropFilter: 'blur(16px)' }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img
              src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
              alt="Marketing iO"
              className="h-10 object-contain"
              style={{ filter: "drop-shadow(0 0 3px white) brightness(1.1)" }}
            />
          </div>

          {/* Typed heading */}
          <div className="text-center mb-1">
            <h1
              className={`text-2xl font-bold text-white ${typedWelcome.length < WELCOME_TEXT.length ? 'cursor-blink' : ''}`}
              style={{ minHeight: '2rem' }}
            >
              {typedWelcome}
            </h1>
          </div>
          <p className="text-center text-slate-400 text-sm mb-6">Sign in to your Marketing iO account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                  placeholder="Your password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-xs text-purple-400 hover:text-purple-300">Forgot password?</Link>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Security: {captcha.question} = ?</label>
              <input
                type="number"
                value={captchaInput}
                onChange={e => setCaptchaInput(e.target.value)}
                required
                className="w-full border text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                placeholder="Answer"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition-all disabled:opacity-60 hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-purple-400 hover:text-purple-300 font-medium">Sign up</Link>
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700 mt-4">
          support@marketingio.co.za
        </p>
      </div>
    </div>
  );
}