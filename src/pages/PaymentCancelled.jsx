import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { XCircle, AlertTriangle, Loader2, ArrowRight, Mail, MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { mailtoLink, whatsappLink } from '@/config/contacts';

// Step 8 PR F — buyer-facing payment-cancelled page.
//
// Two things happen on mount:
//   1. payfast-mark-cancelled is fired (idempotent, fire-and-forget). Flips
//      the Payment row from `pending → cancelled` and kicks off the
//      abandoned-cart recovery sequence (PR E).
//   2. payment-public-summary is fetched so we can show the buyer what they
//      were trying to buy and pre-fill the recovery CTAs.
//
// Recovery CTAs (in order of effort): Try again with email pre-fill, email
// support, WhatsApp support — each pre-populated with the package context so
// the buyer doesn't have to retype.

function fmtZAR(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `R${amount}`;
  return `R${n.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function timeSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Date.now() - t;
  if (ms < 60_000) return 'a moment ago';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function PaymentCancelled() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');

  const [summary, setSummary] = useState(null);
  const [phase, setPhase]     = useState(ref ? 'loading' : 'no_ref');

  // Fire mark-cancelled (idempotent, fire-and-forget) and fetch the summary.
  // The two run in parallel — neither depends on the other and we don't
  // gate rendering on mark-cancelled (it's an audit-trail update, not
  // user-facing).
  useEffect(() => {
    if (!ref) return;
    let cancelled = false;

    base44.functions
      .invoke('payfast-mark-cancelled', { m_payment_id: ref })
      .catch((err) => console.error('[PaymentCancelled] mark-cancelled failed:', err));

    base44.functions
      .invoke('payment-public-summary', { ref })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? res;
        if (data?.error === 'not_found') {
          setPhase('not_found');
          return;
        }
        if (data?.error) {
          setPhase('error');
          return;
        }
        setSummary(data);
        setPhase('loaded');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[PaymentCancelled] summary fetch failed:', err);
        setPhase('error');
      });

    return () => { cancelled = true; };
  }, [ref]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        <Header />
        {phase === 'loading' && <LoadingBody />}
        {phase === 'no_ref' && <NoRefBody />}
        {phase === 'not_found' && <NotFoundBody />}
        {phase === 'error' && <ErrorBody />}
        {phase === 'loaded' && summary && <LoadedBody summary={summary} />}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="-mx-6 -mt-6 sm:-mx-10 sm:-mt-10 mb-6 px-6 sm:px-10 py-4 rounded-t-2xl bg-gradient-to-r from-[#a764e6] to-[#ec4899] flex items-center justify-between">
      <span className="text-white font-bold tracking-wide">Marketing iO</span>
      <span className="text-xs uppercase tracking-widest text-white/90 font-semibold">
        Cancelled
      </span>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="text-center py-6">
      <Loader2 className="w-10 h-10 text-purple-400 mx-auto mb-4 animate-spin" />
      <p className="text-slate-300">Loading…</p>
    </div>
  );
}

function NoRefBody() {
  return (
    <div className="text-center py-2">
      <XCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Payment cancelled</h1>
      <p className="text-slate-300 mb-6">
        No charge was made. You can pick a package and try again any time.
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

function NotFoundBody() {
  return (
    <div className="text-center py-2">
      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">We couldn't find that payment</h1>
      <p className="text-slate-300 mb-6">
        The reference in this link doesn't match anything in our records. If
        you think that's a mistake, drop us an email and we'll take a look.
      </p>
      <a
        href={mailtoLink({ subject: 'Cancelled checkout — payment not found' })}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#a764e6] to-[#ec4899] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
      >
        Email support <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

function ErrorBody() {
  return (
    <div className="text-center py-2">
      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-slate-300 mb-6">
        We couldn't load the details right now. You haven't been charged. Try
        refreshing in a moment.
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

function LoadedBody({ summary }) {
  const since = timeSince(summary.created_at);
  const tryAgainHref =
    summary.package_id
      ? `/checkout/${summary.package_id}${summary.email ? `?email=${encodeURIComponent(summary.email)}` : ''}`
      : '/';

  const emailSubject = `Cancelled checkout — ${summary.package_name}`;
  const emailBody    = [
    `Hi Marketing iO,`,
    ``,
    `I was trying to buy ${summary.package_name} for ${fmtZAR(summary.amount)}, but the payment was cancelled.`,
    `Reference: ${summary.ref}`,
    ``,
    `Can you help?`,
  ].join('\n');

  const waMessage = `Hi Marketing iO support, I started buying ${summary.package_name} for ${fmtZAR(summary.amount)} but the payment was cancelled. Reference: ${summary.ref}. Can you help?`;

  return (
    <div className="text-center">
      <XCircle className="w-14 h-14 text-amber-400 mx-auto mb-4" />
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
        Payment cancelled
      </h1>
      <p className="text-slate-300 mb-6">
        Things go wrong, we get it. You haven't been charged
        {since ? ` — you started this checkout ${since}.` : '.'}
      </p>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 mb-6 text-left">
        <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
          Cancelled checkout
        </div>
        <div className="text-xl font-semibold text-white mb-1">{summary.package_name}</div>
        <div className="text-2xl font-bold bg-gradient-to-r from-[#a764e6] to-[#ec4899] bg-clip-text text-transparent mb-3">
          {fmtZAR(summary.amount)}
        </div>
        <div className="text-xs text-slate-500 font-mono break-all">{summary.ref}</div>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          to={tryAgainHref}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#a764e6] to-[#ec4899] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
        >
          Try again <ArrowRight className="w-4 h-4" />
        </Link>
        <a
          href={mailtoLink({ subject: emailSubject, body: emailBody })}
          className="inline-flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold border border-slate-700 hover:bg-slate-700 transition"
        >
          <Mail className="w-4 h-4" /> Email me about this
        </a>
        <a
          href={whatsappLink(waMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-emerald-600/90 text-white px-6 py-3 rounded-xl font-semibold border border-emerald-500/40 hover:bg-emerald-600 transition"
        >
          <MessageCircle className="w-4 h-4" /> Talk to Thapelo on WhatsApp
        </a>
      </div>
    </div>
  );
}
