import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function AccountUnlocked() {
  const [status, setStatus] = useState('loading'); // loading | success | invalid | expired
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('invalid');
      return;
    }

    base44.functions.invoke('unlock-account', { token })
      .then(res => {
        setEmail(res.data?.email || '');
        setStatus('success');
      })
      .catch(err => {
        const errorCode = err?.response?.data?.error;
        setStatus(errorCode === 'expired_token' ? 'expired' : 'invalid');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a14' }}>
      <div className="w-full max-w-md text-center">
        <img
          src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
          alt="Marketing iO"
          className="h-10 mx-auto mb-8 object-contain"
          style={{ filter: 'invert(1) brightness(2)', mixBlendMode: 'screen' }}
        />

        {status === 'loading' && (
          <div>
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: '#a764e6' }} />
            <p style={{ color: '#a8a8c0' }}>Unlocking your account…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="glass rounded-2xl p-8">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: '#10b981' }} />
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#f4f4fa' }}>Account Unlocked</h1>
            {email && <p className="mb-4 text-sm" style={{ color: '#a8a8c0' }}>{email}</p>}
            <p className="mb-6" style={{ color: '#a8a8c0' }}>Your account has been successfully unlocked. You can now log in.</p>
            <Link
              to="/login"
              className="inline-block w-full py-3 rounded-xl font-semibold text-white gradient-bg text-center"
            >
              Log in now →
            </Link>
          </div>
        )}

        {status === 'invalid' && (
          <div className="glass rounded-2xl p-8">
            <XCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#ef4444' }} />
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#f4f4fa' }}>Link Invalid</h1>
            <p className="mb-6" style={{ color: '#a8a8c0' }}>This unlock link is invalid or has already been used. If your account is still locked, wait 15 minutes for the auto-unlock.</p>
            <Link to="/login" className="inline-block w-full py-3 rounded-xl font-semibold text-white gradient-bg text-center">
              Back to login
            </Link>
          </div>
        )}

        {status === 'expired' && (
          <div className="glass rounded-2xl p-8">
            <XCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#f59e0b' }} />
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#f4f4fa' }}>Link Expired</h1>
            <p className="mb-6" style={{ color: '#a8a8c0' }}>This unlock link has expired. Your account will auto-unlock after 15 minutes, or you can reset your password.</p>
            <div className="flex flex-col gap-3">
              <Link to="/forgot-password" className="inline-block w-full py-3 rounded-xl font-semibold text-white gradient-bg text-center">
                Reset my password
              </Link>
              <Link to="/login" className="inline-block w-full py-3 rounded-xl font-semibold border text-center" style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#a8a8c0' }}>
                Back to login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}