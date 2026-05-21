import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Loader2 } from 'lucide-react';

const QUESTIONS = [
  "What is your mother's maiden name?",
  "What primary school did you attend?",
  "What is your favourite car?",
  "What town were you born in?"
];

export default function SetSecurityQuestions() {
  const [answers, setAnswers] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('mio_session_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setSessionToken(token);
  }, []);

  const allFilled = answers.every(a => a.trim().length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!allFilled) { setError('Please answer all 4 questions.'); return; }
    setLoading(true);
    try {
      await base44.functions.invoke('set-security-questions', {
        session_token: sessionToken,
        answers
      });
      // Redirect: new client signups go to /welcome; all others go to their portal
      const stored = localStorage.getItem('mio_session_user');
      const user = stored ? JSON.parse(stored) : null;
      const isNewSignup = localStorage.getItem('mio_new_signup') === '1';
      if (user?.role === 'owner') {
        window.location.href = '/';
      } else if (user?.role === 'client' && isNewSignup) {
        window.location.href = '/welcome';
      } else if (user?.role === 'client') {
        window.location.href = '/client-portal';
      } else {
        window.location.href = '/staff';
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#0a0a14' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
            alt="Marketing iO"
            className="h-10 mx-auto mb-6 object-contain"
            style={{ filter: 'invert(1) brightness(2)', mixBlendMode: 'screen' }}
          />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: 'rgba(167,100,230,0.15)', border: '1px solid rgba(167,100,230,0.3)' }}>
            <ShieldCheck className="w-7 h-7" style={{ color: '#a764e6' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#f4f4fa' }}>Set your security questions</h1>
          <p className="text-sm" style={{ color: '#a8a8c0' }}>
            These questions protect your account if you're ever locked out. Answer them carefully — they cannot be changed later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl p-6" style={{ background: 'rgba(28,28,48,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {QUESTIONS.map((question, i) => (
            <div key={i}>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#c4c4d4' }}>
                <span className="text-xs font-semibold mr-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,100,230,0.2)', color: '#a764e6' }}>Q{i + 1}</span>
                {question}
              </label>
              <input
                type="text"
                value={answers[i]}
                onChange={e => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                required
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#f4f4fa',
                  focusRingColor: '#a764e6'
                }}
                placeholder="Your answer"
              />
            </div>
          ))}

          <p className="text-xs" style={{ color: '#6b6b85' }}>
            Answers are case-insensitive. Make sure you'll remember them — there is no way to change them without contacting support.
          </p>

          <button
            type="submit"
            disabled={loading || !allFilled}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</span>
            ) : (
              'Save security questions & continue →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}