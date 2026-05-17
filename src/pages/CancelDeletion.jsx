import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// LB-024: public landing page for the cancel-deletion link in Email 1.
// URL: /cancel-deletion?token=<deletion_cancel_token>
//
// On mount: call cancel-account-deletion with the one-time token. On success,
// stores the returned session_token (auto-login) and redirects to the client
// portal with a confirmation toast.

const STATES = {
  WORKING: 'working',
  SUCCESS: 'success',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  ERROR: 'error',
};

export default function CancelDeletion() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState(STATES.WORKING);
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    const cancelToken = params.get('token');
    if (!cancelToken) {
      setState(STATES.INVALID);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const res = await base44.functions.invoke('cancel-account-deletion', {
          cancel_token: cancelToken,
        });
        const data = res?.data ?? res;
        if (cancelled) return;
        if (!data?.success) {
          setState(STATES.ERROR);
          setErrorDetail(data?.error || 'Unknown error');
          return;
        }
        // Auto-login if a fresh session_token came back.
        if (data.session_token) {
          try { base44.auth.setToken(data.session_token); } catch (_) {}
          localStorage.setItem('mio_session_token', data.session_token);
          if (data.user) {
            localStorage.setItem('mio_session_user', JSON.stringify(data.user));
          }
        }
        setState(STATES.SUCCESS);
        toast.success('Account deletion cancelled. Your account is safe.');
        // Redirect after a short pause so the user reads the confirmation.
        setTimeout(() => {
          if (cancelled) return;
          navigate(data.session_token ? '/client-portal' : '/login');
        }, 1800);
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        const detail = err?.response?.data?.error || err?.message || '';
        if (status === 401) {
          setState(detail === 'invalid_or_used_token' ? STATES.INVALID : STATES.EXPIRED);
        } else if (status === 410) {
          setState(STATES.EXPIRED);
        } else {
          setState(STATES.ERROR);
        }
        setErrorDetail(detail);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [params, navigate]);

  const containerStyle = {
    minHeight: '100vh',
    background: '#0a0a2e',
    color: '#f4f4fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const cardStyle = {
    background: '#16162d',
    border: '1px solid rgba(167,100,230,0.25)',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
  };

  if (state === STATES.WORKING) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: '20px', marginBottom: '12px' }}>Cancelling your account deletion…</h1>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>One moment.</p>
        </div>
      </div>
    );
  }

  if (state === STATES.SUCCESS) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>✓</div>
          <h1 style={{ fontSize: '22px', marginBottom: '12px' }}>Your account is safe</h1>
          <p style={{ color: '#cbd5e1', fontSize: '15px', marginBottom: '8px' }}>
            We've cancelled the pending deletion. Redirecting you back to your portal…
          </p>
        </div>
      </div>
    );
  }

  if (state === STATES.INVALID) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: '22px', marginBottom: '12px' }}>This cancel link is no longer valid</h1>
          <p style={{ color: '#cbd5e1', fontSize: '15px', marginBottom: '16px' }}>
            The link may have already been used, or it never existed. If you still want to keep your account, sign in and use the banner at the top of your dashboard.
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg,#a764e6 0%,#ec4899 100%)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (state === STATES.EXPIRED) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: '22px', marginBottom: '12px' }}>This cancel link has expired</h1>
          <p style={{ color: '#cbd5e1', fontSize: '15px', marginBottom: '16px' }}>
            The 14-day cooling-off window has passed and the account may already have been deleted. If you'd like to use Marketing iO again, please sign up again at <a href="https://marketingio.co.za" style={{ color: '#a764e6' }}>marketingio.co.za</a>.
          </p>
        </div>
      </div>
    );
  }

  // ERROR
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '22px', marginBottom: '12px' }}>Something went wrong</h1>
        <p style={{ color: '#cbd5e1', fontSize: '15px', marginBottom: '16px' }}>
          We couldn't cancel your deletion right now. Please try again, or contact <a href="mailto:info@marketingio.co.za" style={{ color: '#a764e6' }}>info@marketingio.co.za</a>.
        </p>
        {errorDetail && (
          <p style={{ color: '#94a3b8', fontSize: '12px' }}>Error: {String(errorDetail)}</p>
        )}
      </div>
    </div>
  );
}
