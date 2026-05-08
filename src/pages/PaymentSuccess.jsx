import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getNextStepsCopy } from '@/config/packageCategories';
import { getCurrentUser } from '@/lib/customAuth';
import { logClientActivityFromBrowser } from '@/lib/activityLog';

// Step 8 PR F — buyer-facing payment success page.
//
// Reads ?ref=<m_payment_id> from the URL, fetches the Payment summary via
// payment-public-summary, and renders one of:
//   - loading             — initial fetch in flight
//   - pending             — Payment row exists but status === 'pending'.
//                           Auto-refreshes every 5s for up to 30s, then
//                           settles into a static "awaiting confirmation"
//                           state.
//   - successful          — full receipt-style summary with package-aware
//                           "what happens next" copy.
//   - failed              — inline recovery copy on this page (no redirect).
//   - cancelled           — redirected to /payment-cancelled?ref=...
//   - not_found / no ref  — friendly fallback with a link home.

const POLL_INTERVAL_MS = 5_000;
const POLL_BUDGET_MS   = 30_000;

function fmtZAR(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `R${amount}`;
  return `R${n.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone:  'Africa/Johannesburg',
  });
}

async function fetchSummary(ref) {
  const res = await base44.functions.invoke('payment-public-summary', { ref });
  return res?.data ?? res;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const navigate = useNavigate();

  const [phase, setPhase] = useState(ref ? 'loading' : 'no_ref');
  const [summary, setSummary] = useState(null);
  const pollStartedAt = useRef(null);

  // Initial fetch + polling while pending.
  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      try {
        const data = await fetchSummary(ref);
        if (cancelled) return;

        if (data?.error === 'not_found') {
          setPhase('not_found');
          return;
        }
        if (data?.error) {
          // Treat any other error (rate_limit / invalid_ref / lookup_failed)
          // as an unrecoverable lookup failure; no point in spamming retries.
          setPhase('error');
          return;
        }

        setSummary(data);

        if (data.status === 'cancelled') {
          navigate(`/payment-cancelled?ref=${encodeURIComponent(ref)}`, { replace: true });
          return;
        }
        if (data.status === 'failed') {
          setPhase('failed');
          return;
        }
        if (data.status === 'successful') {
          setPhase('successful');
          return;
        }

        // status === 'pending' — keep polling within the budget.
        if (pollStartedAt.current === null) pollStartedAt.current = Date.now();
        const elapsed = Date.now() - pollStartedAt.current;
        if (elapsed >= POLL_BUDGET_MS) {
          setPhase('pending_timeout');
          return;
        }
        setPhase('pending');
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        console.error('[PaymentSuccess] fetch failed:', err);
        if (!cancelled) setPhase('error');
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ref, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        {phase === 'no_ref' && <NoRefView />}
        {phase === 'loading' && <LoadingView />}
        {phase === 'not_found' && <NotFoundView />}
        {phase === 'error' && <ErrorView />}
        {phase === 'pending' && <PendingView summary={summary} />}
        {phase === 'pending_timeout' && <PendingTimeoutView summary={summary} />}
        {phase === 'failed' && <FailedView summary={summary} />}
        {phase === 'successful' && <SuccessfulView summary={summary} />}
      </div>
    </div>
  );
}

function BrandHeader({ label }) {
  return (
    <div className="-mx-6 -mt-6 sm:-mx-10 sm:-mt-10 mb-6 px-6 sm:px-10 py-4 rounded-t-2xl bg-gradient-to-r from-[#a764e6] to-[#ec4899] flex items-center justify-between">
      <span className="text-white font-bold tracking-wide">Marketing iO</span>
      <span className="text-xs uppercase tracking-widest text-white/90 font-semibold">{label}</span>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="text-center py-8">
      <Loader2 className="w-10 h-10 text-purple-400 mx-auto mb-4 animate-spin" />
      <p className="text-slate-300">Loading your payment details…</p>
    </div>
  );
}

function NoRefView() {
  return (
    <div className="text-center py-4">
      <BrandHeader label="Payment" />
      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">No payment reference</h1>
      <p className="text-slate-300 mb-6">
        We couldn't find a payment reference in this link. If you've just paid,
        check your email — your receipt will be there shortly.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#a764e6] to-[#ec4899] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
      >
        Back to Marketing iO <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function NotFoundView() {
  return (
    <div className="text-center py-4">
      <BrandHeader label="Payment" />
      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Payment not found</h1>
      <p className="text-slate-300 mb-6">
        We couldn't find a payment matching this reference. If this is
        unexpected, drop us a line at{' '}
        <a className="text-purple-300 underline" href="mailto:hello@marketingio.co.za">
          hello@marketingio.co.za
        </a>{' '}
        and we'll sort it out.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold border border-slate-700 hover:bg-slate-700 transition"
      >
        Back to Marketing iO <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function ErrorView() {
  return (
    <div className="text-center py-4">
      <BrandHeader label="Payment" />
      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-slate-300 mb-6">
        We couldn't load your payment details right now. Your payment is safe —
        please refresh in a moment, or check your email for the receipt.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-gradient-to-r from-[#a764e6] to-[#ec4899] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
      >
        Refresh
      </button>
    </div>
  );
}

function SummaryTable({ summary }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 mb-6 text-left">
      <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
        Amount paid
      </div>
      <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#a764e6] to-[#ec4899] bg-clip-text text-transparent mb-5">
        {fmtZAR(summary.amount)}
      </div>

      <dl className="text-sm text-slate-300 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
        <dt className="text-slate-500">Package</dt>
        <dd className="text-white font-semibold break-words">{summary.package_name}</dd>

        <dt className="text-slate-500">Reference</dt>
        <dd className="text-slate-200 font-mono text-xs break-all">{summary.ref}</dd>

        {summary.pf_payment_id && (
          <>
            <dt className="text-slate-500">PayFast ID</dt>
            <dd className="text-slate-200 font-mono text-xs break-all">{summary.pf_payment_id}</dd>
          </>
        )}

        {summary.completed_at && (
          <>
            <dt className="text-slate-500">Date</dt>
            <dd className="text-slate-200">{fmtDateTime(summary.completed_at)}</dd>
          </>
        )}

        {summary.customer_name && (
          <>
            <dt className="text-slate-500">Customer</dt>
            <dd className="text-slate-200">{summary.customer_name}</dd>
          </>
        )}

        {summary.company_name && (
          <>
            <dt className="text-slate-500">Company</dt>
            <dd className="text-slate-200">{summary.company_name}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

// PR #54 Part A — auto-redirect from successful receipt to dashboard.
//
// Behaviour:
//   - On mount, resolve the current user via getCurrentUser() (fast path
//     reads localStorage cache; falls back to auth-me network call).
//   - Authenticated  → /client-portal
//     Guest          → /login?next=/client-portal
//   - Visible 10-second countdown. Clicking anywhere on the receipt body
//     (other than the CTA button) cancels the auto-redirect and leaves
//     the user on the page; the CTA button itself still works.
//   - Best-effort ClientActivityLog write on every redirect (auto OR
//     manual) — never blocks navigation, never throws.
//   - Activity-log details (PR #52 schema):
//       event_category: 'payment'    (closest valid enum; brief said
//                                     'navigation' but the schema doesn't
//                                     include it — see PR #54 description)
//       event_type:     'payment_to_dashboard'
//       event_summary:  'Returned to dashboard after payment <ref>'
//       event_metadata: { source: 'auto'|'manual', ref }
const SUCCESS_COUNTDOWN_SEC = 10;

function SuccessfulView({ summary }) {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [countdownSec, setCountdownSec] = useState(SUCCESS_COUNTDOWN_SEC);
  const [autoRedirectCancelled, setAutoRedirectCancelled] = useState(false);
  const navigatedRef = useRef(false);

  // Resolve auth status once. getCurrentUser() returns null for guests
  // and a cached user object for authenticated buyers — fast path first,
  // network fallback only if no cache.
  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .then((u) => {
        if (!alive) return;
        setUser(u || null);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setAuthChecked(true);
      });
    return () => { alive = false; };
  }, []);

  const destination = user ? '/client-portal' : '/login?next=/client-portal';

  // Single navigation entry point — guarded against double-fire (auto and
  // manual paths both feed through here).
  const goToDashboard = useCallback(async (source) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;

    // Best-effort activity-log write. Only meaningful for authenticated
    // users (guests have no Client row to log against).
    if (user && summary?.ref) {
      try {
        const list = await base44.entities.Client.filter({ client_user_id: user.id }).catch(() => []);
        const arr = Array.isArray(list) ? list : (list?.data ?? []);
        const client = arr[0];
        if (client?.id) {
          logClientActivityFromBrowser({
            clientId:      client.id,
            eventType:     'payment_to_dashboard',
            eventCategory: 'payment',
            eventSummary:  `Returned to dashboard after payment ${summary.ref}`,
            eventMetadata: { source, ref: summary.ref },
          });
        }
      } catch (err) {
        // Never block navigation on log errors.
        console.warn('[PaymentSuccess] activity log skipped:', err);
      }
    }

    navigate(destination);
  }, [user, summary?.ref, navigate, destination]);

  // Countdown effect. Runs once auth is checked. Stops if the user
  // cancelled (clicked the receipt body) or already navigated.
  useEffect(() => {
    if (!authChecked) return;
    if (autoRedirectCancelled) return;
    if (navigatedRef.current) return;

    if (countdownSec <= 0) {
      goToDashboard('auto');
      return;
    }
    const t = setTimeout(() => setCountdownSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [authChecked, autoRedirectCancelled, countdownSec, goToDashboard]);

  if (!summary) return <LoadingView />;

  // Click-anywhere-on-the-body cancels the auto-redirect. The CTA button
  // stops propagation so it bypasses this and navigates immediately.
  const handleBodyClick = () => {
    if (!autoRedirectCancelled) setAutoRedirectCancelled(true);
  };

  const showCountdown = authChecked && !autoRedirectCancelled && countdownSec > 0;
  const ctaLabel = user ? 'Continue to Dashboard' : 'Continue to Sign In';

  return (
    <div className="text-center" onClick={handleBodyClick}>
      <BrandHeader label="Receipt" />
      <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
        Payment confirmed
      </h1>
      <p className="text-slate-300 mb-6">
        Thanks{summary.customer_name ? `, ${summary.customer_name.split(/\s+/)[0]}` : ''} —
        we've received your payment.
      </p>

      <SummaryTable summary={summary} />

      <div className="text-left bg-slate-950/40 border border-purple-500/20 rounded-xl p-4 sm:p-5 mb-6">
        <div className="text-[11px] uppercase tracking-widest text-purple-300 font-semibold mb-2">
          What happens next
        </div>
        <p className="text-slate-200 text-sm leading-relaxed">
          {getNextStepsCopy(summary.package_id)}
        </p>
      </div>

      <p className="text-xs text-slate-500 mb-5">
        A copy of this receipt has been emailed to you. Need anything? Reply to
        that email and we'll come back within one business day.
      </p>

      <button
        type="button"
        onClick={(e) => {
          // Stop the body's cancel-auto-redirect handler from firing —
          // we want the manual click to navigate, not just stop the timer.
          e.stopPropagation();
          goToDashboard('manual');
        }}
        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#a764e6] to-[#ec4899] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
      >
        {ctaLabel} <ArrowRight className="w-4 h-4" />
      </button>

      {showCountdown && (
        <p className="text-xs text-slate-500 mt-3">
          Redirecting in {countdownSec}s — click anywhere to stay on this page
        </p>
      )}
    </div>
  );
}

function PendingView({ summary }) {
  return (
    <div className="text-center">
      <BrandHeader label="Confirming" />
      <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-spin" />
      <h1 className="text-2xl font-bold text-white mb-2">Confirming your payment…</h1>
      <p className="text-slate-300 mb-6">
        Payment received from PayFast. We're confirming with the bank — this
        usually takes a few seconds.
      </p>
      {summary && <SummaryTable summary={summary} />}
    </div>
  );
}

function PendingTimeoutView({ summary }) {
  return (
    <div className="text-center">
      <BrandHeader label="Awaiting confirmation" />
      <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Payment received, awaiting confirmation</h1>
      <p className="text-slate-300 mb-6">
        Confirmation is taking a little longer than usual. Check your email in a
        few minutes — your receipt will arrive once the bank confirms.
      </p>
      {summary && <SummaryTable summary={summary} />}
      <button
        onClick={() => window.location.reload()}
        className="bg-gradient-to-r from-[#a764e6] to-[#ec4899] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
      >
        Check status
      </button>
    </div>
  );
}

function FailedView({ summary }) {
  if (!summary) return <LoadingView />;
  return (
    <div className="text-center">
      <BrandHeader label="Payment" />
      <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Payment didn't go through</h1>
      <p className="text-slate-300 mb-6">
        Your card may have been declined or there was a network issue. You
        haven't been charged.
      </p>

      <SummaryTable summary={summary} />

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={
            summary.package_id
              ? `/checkout/${summary.package_id}${summary.email ? `?email=${encodeURIComponent(summary.email)}` : ''}`
              : '/'
          }
          className="bg-gradient-to-r from-[#a764e6] to-[#ec4899] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
        >
          Try again
        </Link>
        <a
          href="mailto:hello@marketingio.co.za?subject=Payment%20didn't%20go%20through"
          className="bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold border border-slate-700 hover:bg-slate-700 transition"
        >
          Email support
        </a>
      </div>
    </div>
  );
}
