import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

// LB-024: sticky banner shown on every authenticated page when the current
// user's Client has deletion_pending=true. Lets them cancel the pending
// deletion in-app (matches the email-link cancel flow).

function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch {
    return iso;
  }
}

export default function DeletionPendingBanner() {
  const { user, isAuthenticated } = useAuth();
  const [pending, setPending] = useState(null); // { scheduled_at } when active
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      if (!isAuthenticated || !user || user.role !== 'client') {
        setPending(null);
        return;
      }
      try {
        const res = await base44.functions.invoke('getMyClient', {
          token: localStorage.getItem('mio_session_token'),
        });
        const client = res?.data?.client ?? res?.client;
        if (cancelled) return;
        if (client?.deletion_pending && client?.deletion_scheduled_at) {
          setPending({ scheduled_at: client.deletion_scheduled_at });
        } else {
          setPending(null);
        }
      } catch {
        // Non-fatal: just don't show the banner. Errors (no client record,
        // expired session) are handled elsewhere.
        if (!cancelled) setPending(null);
      }
    };
    fetchStatus();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await base44.functions.invoke('cancel-account-deletion', {
        token: localStorage.getItem('mio_session_token'),
      });
      const data = res?.data ?? res;
      if (data?.success) {
        setPending(null);
        toast.success('Account deletion cancelled. Your account is safe.');
      } else {
        toast.error('Could not cancel deletion. Please try again or contact support.');
      }
    } catch (err) {
      console.error('[DeletionPendingBanner] cancel failed:', err);
      toast.error('Could not cancel deletion. Please try again or contact support.');
    } finally {
      setCancelling(false);
    }
  };

  if (!pending) return null;

  const days = daysUntil(pending.scheduled_at);
  const dateStr = formatDate(pending.scheduled_at);

  return (
    <div
      role="alert"
      style={{
        background: 'linear-gradient(135deg, #7f1d1d 0%, #9f1239 100%)',
        color: '#fff',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: '260px', fontSize: '14px', lineHeight: 1.5 }}>
        <strong>Your account is scheduled for deletion on {dateStr}</strong>
        {days !== null && ` (${days} day${days === 1 ? '' : 's'} from now)`}.
        <span style={{ marginLeft: 6 }}>Cancel any time before then to keep your account.</span>
      </div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={cancelling}
        style={{
          background: '#fff',
          color: '#7f1d1d',
          padding: '8px 16px',
          borderRadius: '6px',
          border: 'none',
          fontWeight: 600,
          fontSize: '14px',
          cursor: cancelling ? 'not-allowed' : 'pointer',
          opacity: cancelling ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {cancelling ? 'Cancelling…' : 'Cancel Deletion'}
      </button>
    </div>
  );
}
