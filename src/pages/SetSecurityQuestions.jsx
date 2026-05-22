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
      await base44.functions.invoke('set-security-questions', { session_token: sessionToken, answers });
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gray-50">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="h-10 mx-auto mb-6 object-contain"
          />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-blue-50 border border-blue-200">
            <ShieldCheck className="w-7 h-7 text-[#0A1F44]" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Set your security questions</h1>
          <p className="text-sm text-gray-500">
            These questions protect your account if you're ever locked out. Answer them carefully — they cannot be changed later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl p-6 bg-white border border-gray-200 shadow-sm">
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-600">{error}</div>
          )}

          {QUESTIONS.map((question, i) => (
            <div key={i}>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">
                <span className="text-xs font-semibold mr-2 px-1.5 py-0.5 rounded bg-blue-50 text-[#0A1F44] border border-blue-100">Q{i + 1}</span>
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
                required autoComplete="off"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-[#0A1F44] placeholder-gray-400"
                placeholder="Your answer"
              />
            </div>
          ))}

          <p className="text-xs text-gray-400">
            Answers are case-insensitive. Make sure you'll remember them — there is no way to change them without contacting support.
          </p>

          <button
            type="submit"
            disabled={loading || !allFilled}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition disabled:opacity-50"
            style={{ background: '#0A1F44' }}
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