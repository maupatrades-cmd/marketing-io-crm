import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Sparkles,
  PartyPopper,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  MessageSquare,
  CreditCard,
  Package,
  Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentUser } from '@/lib/customAuth';

// Lucide icon name → component lookup. Anything unknown falls back to Bell.
const ICON_MAP = {
  Bell,
  Sparkles,
  PartyPopper,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  MessageSquare,
  CreditCard,
  Package
};

const CATEGORY_STYLE = {
  info:    { bg: 'bg-slate-700/40',   border: 'border-slate-600/40', icon: 'text-slate-300' },
  success: { bg: 'bg-emerald-700/30', border: 'border-emerald-500/30', icon: 'text-emerald-300' },
  warning: { bg: 'bg-amber-700/30',   border: 'border-amber-500/30',  icon: 'text-amber-300' },
  error:   { bg: 'bg-rose-900/30',    border: 'border-rose-500/30',   icon: 'text-rose-300' }
};

function relativeTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  // Try Intl.RelativeTimeFormat first, fall back to a tiny custom formatter.
  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    const rtf = new Intl.RelativeTimeFormat('en-ZA', { numeric: 'auto' });
    if (absSec < 60) return rtf.format(diffSec, 'second');
    if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (absSec < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (absSec < 604800) return rtf.format(Math.round(diffSec / 86400), 'day');
    if (absSec < 2592000) return rtf.format(Math.round(diffSec / 604800), 'week');
    if (absSec < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
    return rtf.format(Math.round(diffSec / 31536000), 'year');
  }
  return date.toLocaleDateString('en-ZA');
}

function ActivityItem({ entry }) {
  const Icon = ICON_MAP[entry.icon] || Bell;
  const style = CATEGORY_STYLE[entry.category] || CATEGORY_STYLE.info;
  const time = relativeTime(entry.created_date);

  const Wrapper = entry.link
    ? ({ children }) => (
        <Link
          to={entry.link}
          className="block hover:bg-slate-800/40 rounded-xl transition"
        >
          {children}
        </Link>
      )
    : ({ children }) => <div>{children}</div>;

  return (
    <Wrapper>
      <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-700/40 bg-slate-900/40">
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${style.bg} border ${style.border}`}>
          <Icon className={`w-5 h-5 ${style.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold text-white truncate">{entry.title}</p>
            {time && <span className="text-[11px] text-slate-500 shrink-0">{time}</span>}
          </div>
          {entry.body && (
            <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{entry.body}</p>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

export default function ClientActivity() {
  const { user: authUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = authUser || await getCurrentUser();
      if (!me) return;
      try {
        const clients = await base44.entities.Client.filter({ email: me.email });
        const c = Array.isArray(clients) ? clients[0] : clients;
        if (!c) {
          if (!cancelled) setLoading(false);
          return;
        }
        const rows = await base44.entities.ClientActivityLog
          .filter({ client_id: c.id }, '-created_date', 100)
          .catch(() => []);
        const list = Array.isArray(rows) ? rows : [];
        if (cancelled) return;
        setEntries(list);

        // Mark unread entries as read in parallel — failures don't block render.
        const nowIso = new Date().toISOString();
        const updates = list
          .filter(e => !e.read_at)
          .map(e => base44.entities.ClientActivityLog.update(e.id, { read_at: nowIso }));
        if (updates.length > 0) {
          Promise.allSettled(updates).then(results => {
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) console.error(`[ClientActivity] ${failed}/${updates.length} read_at updates failed`);
          });
        }
      } catch (err) {
        console.error('[ClientActivity] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  const sorted = useMemo(() => entries, [entries]);

  return (
    <div className="min-h-full p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-white">Activity</h1>
          <p className="text-sm text-slate-400">What's happened on your account.</p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-12 text-center">
            <Bell className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-300 font-semibold">No activity yet</p>
            <p className="text-sm text-slate-500 mt-1">Your account history will appear here.</p>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="space-y-2">
            {sorted.map(e => <ActivityItem key={e.id} entry={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
