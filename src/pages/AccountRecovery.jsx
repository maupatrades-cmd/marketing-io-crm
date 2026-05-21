import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

const ALL_QUESTIONS = [
  { index: 1, text: "What is your mother's maiden name?" },
  { index: 2, text: "What primary school did you attend?" },
  { index: 3, text: "What is your favourite car?" },
  { index: 4, text: "What town were you born in?" }
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AccountRecovery() {
  const params = new URLSearchParams(window.location.search);
  const email = decodeURIComponent(params.get('email') || '');

  // Pick 3 random questions once on mount
  const selectedQuestions = useMemo(() => shuffle(ALL_QUESTIONS).slice(0, 3), []);

  const [answers, setAnswers] = useState({ 1: '', 2: '', 3: '', 4: '' });
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);

  // Stage 2 — password reset form
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [done, setDone] = useState(false);

  const allFilled = selectedQuestions.every(q => (answers[q.index] || '').trim().length > 0);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        email,
        answers: selectedQuestions.map(q => ({ question_index: q.index, answer: answers[q.index] || '' }))
      };
      const res = await base44.functions.invoke('recover-account', payload);
      setRecoveryToken(res.data.recovery_token);
    } catch (err) {
      const data = err?.response?.data || {};
      if (data.fallback || data.attempts_exhausted) {
        setFallback(true);
      }
      setAttemptsLeft(data.attempts_left ?? 0);
      setError(data.error || 'Incorrect answers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(newPassword)) { setPwError('Password must contain at least one uppercase letter.'); return; }
    if (!/[0-9]/.test(newPassword)) { setPwError('Password must contain at least one number.'); return; }
    setPwLoading(true);
    try {
      await base44.functions.invoke('complete-recovery', { recovery_token: recoveryToken, new_password: newPassword });
      setDone(true);
    } catch (err) {
      const data = err?.response?.data || {};
      setPwError(data.message || data.error || 'Something went wrong. Please try again.');
    } finally {
      setPwLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a14' }}>
        <div className="text-center">
          <p style={{ color: '#a8a8c0' }}>Invalid recovery link. <Link to="/login" style={{ color: '#a764e6' }}>Go back to login</Link></p>
        </div>
      </div>
    );
  }

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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <ShieldAlert className="w-7 h-7" style={{ color: '#ef4444' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#f4f4fa' }}>Account Recovery</h1>
          <p className="text-sm" style={{ color: '#a8a8c0' }}>
            Your account was locked for security reasons. Answer 3 security questions to recover access.
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'rgba(28,28,48,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Stage 1 — security questions */}
          {!recoveryToken && !done && (
            <>
              {fallback ? (
                <div className="text-center py-4">
                  <p className="text-sm mb-4" style={{ color: '#fca5a5' }}>You've used all 3 recovery attempts. Please reset your password via email instead.</p>
                  <Link
                    to={`/forgot-password?email=${encodeURIComponent(email)}`}
                    className="inline-block px-6 py-2.5 rounded-xl font-semibold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
                  >
                    Reset password via email →
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleVerify} className="space-y-4">
                  {error && (
                    <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                      {error}
                    </div>
                  )}
                  {attemptsLeft < 3 && attemptsLeft > 0 && (
                    <p className="text-xs text-center" style={{ color: '#f59e0b' }}>{attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining</p>
                  )}

                  {selectedQuestions.map((q, i) => (
                    <div key={q.index}>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: '#c4c4d4' }}>
                        <span className="text-xs font-semibold mr-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{i + 1}</span>
                        {q.text}
                      </label>
                      <input
                        type="text"
                        value={answers[q.index] || ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.index]: e.target.value }))}
                        required
                        autoComplete="off"
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f4f4fa' }}
                        placeholder="Your answer"
                      />
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={loading || !allFilled}
                    className="w-full py-3 rounded-xl font-semibold text-white text-sm transition disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
                  >
                    {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</span> : 'Verify answers →'}
                  </button>

                  <p className="text-center text-xs" style={{ color: '#6b6b85' }}>
                    Can't remember your answers?{' '}
                    <Link to={`/forgot-password?email=${encodeURIComponent(email)}`} style={{ color: '#a764e6' }}>Reset via email</Link>
                  </p>
                </form>
              )}
            </>
          )}

          {/* Stage 2 — set new password */}
          {recoveryToken && !done && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="rounded-lg px-4 py-3 text-sm mb-2" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                ✅ Identity verified. Now set a new password for your account.
              </div>
              {pwError && (
                <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                  {pwError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#c4c4d4' }}>New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f4f4fa' }}
                    placeholder="At least 8 chars, 1 uppercase, 1 number"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5" style={{ color: '#6b6b85' }}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#c4c4d4' }}>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f4f4fa' }}
                  placeholder="Repeat new password"
                />
              </div>
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
              >
                {pwLoading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Setting password…</span> : 'Set new password & log in →'}
              </button>
            </form>
          )}

          {/* Stage 3 — done */}
          {done && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#10b981' }} />
              <h2 className="text-lg font-bold mb-2" style={{ color: '#f4f4fa' }}>Password updated!</h2>
              <p className="text-sm mb-6" style={{ color: '#a8a8c0' }}>A confirmation email has been sent. You can now log in with your new password.</p>
              <Link
                to="/login"
                className="inline-block px-8 py-3 rounded-xl font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
              >
                Log in now →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}