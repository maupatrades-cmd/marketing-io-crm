import { useMemo, useState } from 'react';
import {
  Bell, Lock, User, CreditCard, FileText, FolderOpen,
  MessageSquare, LifeBuoy, UserCog, Loader2, RefreshCw,
  Download, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivityFeedPolling } from '@/lib/useActivityFeedPolling';

// =============================================================================
// ActivityFeed — Client Portal PR A.
//
// Reused by both the client-side /client/activity page (viewerRole='client')
// and the admin/owner /clients/:id Activity section
// (viewerRole='admin' | 'owner'). Differences:
//   - Admin/Owner view shows actor info ("Client did X" vs "Admin Y did Z")
//     and surfaces ip_address / user_agent on auth events.
//   - Client view hides those fields.
//
// Filters: date range (7/30/90 days / all / custom), event_category
// dropdown. Real-time polling every 30s while tab is visible (handled by
// the shared useActivityFeedPolling hook — same hook will be reused by
// PR G for the per-role tabs).
//
// Pagination: 30 per page, "Load more" button (avoids the complexity of
// IntersectionObserver-based infinite scroll for v1).
//
// PDF download: invokes the generate-activity-pdf server function with
// the same date range and downloads the returned binary.
// =============================================================================

const CATEGORY_META = {
  auth:          { label: 'Auth',          icon: Lock,         color: 'text-rose-300' },
  profile:       { label: 'Profile',       icon: UserCog,      color: 'text-indigo-300' },
  payment:       { label: 'Payment',       icon: CreditCard,   color: 'text-emerald-300' },
  invoice:       { label: 'Invoice',       icon: FileText,     color: 'text-amber-300' },
  document:      { label: 'Documents',     icon: FolderOpen,   color: 'text-purple-300' },
  communication: { label: 'Messages',      icon: MessageSquare,color: 'text-cyan-300' },
  support:       { label: 'Support',       icon: LifeBuoy,     color: 'text-blue-300' },
  account:       { label: 'Account',       icon: User,         color: 'text-slate-300' },
};

const SEC_RELEVANT_EVENTS = new Set([
  'login_success', 'login_failed', 'password_changed',
  'password_reset_requested', 'password_reset_completed',
]);

// Date-range presets in days. 'all' means no lower bound; 'custom' uses
// the user-supplied dates.
const RANGE_PRESETS = [
  { value: '7',   label: 'Last 7 days' },
  { value: '30',  label: 'Last 30 days' },
  { value: '90',  label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay)     return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  const date = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${date} at ${time}`;
}

// PR #54 Part B — metadata visibility per viewer role.
//
// Clients should NEVER see event_metadata. The raw JSON exposes internal
// terminology (m_payment_id, pf_payment_id, user_entity, etc.) and looks
// unfinished in a paid-SaaS portal. Admin/owner viewers keep access to the
// expanded view for debugging/support — but rendered as a labelled table
// rather than raw JSON.stringify, with internal-only keys hidden.
//
// PDF export (generate-activity-pdf) renders metadata server-side and is
// untouched by this change — admin/owner exports still include the full
// payload, which is the correct behaviour for an audit-grade artefact.

// Internal-only metadata keys we hide from BOTH the on-screen admin view
// and (implicitly) the client view. These are noise, not signal.
const INTERNAL_METADATA_KEYS = new Set(['user_entity', 'flow', 'source']);

// Pretty labels for known metadata keys. Anything unknown falls back to
// a humanised version of the key.
const METADATA_LABELS = {
  m_payment_id:    'Reference',
  pf_payment_id:   'PayFast ID',
  package_id:      'Package',
  amount:          'Amount',
  currency:        'Currency',
  payment_status:  'Status',
  failed_reason:   'Reason',
  invoice_id:      'Invoice',
  upload_id:       'Upload',
  file_name:       'File',
  file_type:       'File type',
  file_size:       'File size (bytes)',
  mime_type:       'MIME type',
  thread_id:       'Thread',
  message_id:      'Message',
  sender_role:     'Sender role',
  preview:         'Preview',
  consultant_id:   'Consultant',
  owner_id:        'Owner',
  changed_fields:  'Fields changed',
  failed_login_count: 'Failed attempts',
  locked:          'Locked',
  token_expires_at:'Token expires',
  ref:             'Reference',
};

function humaniseKey(k) {
  return String(k)
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function formatMetadataValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number')  return Number.isInteger(v) ? String(v) : v.toString();
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v))       return v.join(', ');
  if (typeof v === 'object')  return JSON.stringify(v);
  return String(v);
}

function ActivityCard({ entry, viewerRole }) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_META[entry.event_category] || CATEGORY_META.account;
  const Icon = cat.icon;

  // Prefer new fields; fall back to legacy field names so old rows render too.
  const summary = entry.event_summary || entry.title || entry.event_label || '(no summary)';
  const eventType = entry.event_type || 'note';
  const rawMetadata = entry.event_metadata && typeof entry.event_metadata === 'object'
    ? entry.event_metadata
    : null;

  const isStaff = viewerRole === 'admin' || viewerRole === 'owner';

  // Filter metadata to drop internal-only keys before deciding whether to
  // show the expansion at all (staff view) or whether the metadata block
  // exists (it's always hidden from clients).
  const cleanedMetadata = rawMetadata
    ? Object.fromEntries(
        Object.entries(rawMetadata).filter(([k, v]) =>
          !INTERNAL_METADATA_KEYS.has(k) && v !== '' && v !== null && v !== undefined
        )
      )
    : null;

  const showSecurityFields =
    isStaff && SEC_RELEVANT_EVENTS.has(eventType) && (entry.ip_address || entry.user_agent);

  // Clients NEVER see metadata or security fields. Staff see both.
  const showMetadata = isStaff && cleanedMetadata && Object.keys(cleanedMetadata).length > 0;
  const hasDetails = showMetadata || showSecurityFields;

  const actorLabel = (() => {
    const role = String(entry.actor_role || '').trim();
    const name = String(entry.logged_by_name || '').trim();
    if (!role) return null;
    if (role === 'system') return 'System';
    if (role === 'client') return name ? `Client (${name})` : 'Client';
    if (name) return `${role.charAt(0).toUpperCase()}${role.slice(1)} ${name}`;
    return role.charAt(0).toUpperCase() + role.slice(1);
  })();

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className={`w-full flex items-start gap-3 p-4 text-left ${hasDetails ? 'hover:bg-slate-800/40' : ''} transition`}
        disabled={!hasDetails}
        aria-expanded={expanded}
      >
        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-slate-800/60 border border-slate-700/50">
          <Icon className={`w-5 h-5 ${cat.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold text-white">{summary}</p>
            <span className="text-[11px] text-slate-500 shrink-0">{formatTimestamp(entry.created_date)}</span>
          </div>
          {(isStaff && actorLabel) && (
            <p className="text-xs text-slate-400 mt-0.5">{actorLabel}</p>
          )}
        </div>
        {hasDetails && (
          expanded
            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1.5" />
            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1.5" />
        )}
      </button>
      {expanded && hasDetails && (
        <div className="border-t border-slate-700/40 bg-slate-950/60 px-4 py-3 space-y-3">
          {showSecurityFields && (
            <div className="text-xs text-slate-300 space-y-1">
              {entry.ip_address && (
                <div><span className="text-slate-500">IP:</span> <span className="font-mono">{entry.ip_address}</span></div>
              )}
              {entry.user_agent && (
                <div className="break-words"><span className="text-slate-500">User agent:</span> <span className="font-mono text-slate-400">{entry.user_agent}</span></div>
              )}
            </div>
          )}
          {showMetadata && (
            <dl className="text-xs grid grid-cols-[max-content,1fr] gap-x-3 gap-y-1">
              {Object.entries(cleanedMetadata).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{METADATA_LABELS[k] || humaniseKey(k)}</dt>
                  <dd className="text-slate-200 font-mono break-words">{formatMetadataValue(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActivityFeed({
  clientId,
  clientName = '',
  viewerRole = 'client',  // 'client' | 'admin' | 'owner'
}) {
  const [rangePreset, setRangePreset] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [category,    setCategory]    = useState('all');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  // Convert preset → ISO bounds for the polling hook.
  const { dateRangeStart, dateRangeEnd } = useMemo(() => {
    if (rangePreset === 'all')    return { dateRangeStart: null, dateRangeEnd: null };
    if (rangePreset === 'custom') {
      return {
        dateRangeStart: customStart ? new Date(customStart).toISOString() : null,
        dateRangeEnd:   customEnd   ? new Date(`${customEnd}T23:59:59`).toISOString() : null,
      };
    }
    const days = Number(rangePreset);
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    return { dateRangeStart: from.toISOString(), dateRangeEnd: null };
  }, [rangePreset, customStart, customEnd]);

  const {
    entries, loading, error, lastUpdated, refresh, fetchMore, hasMore,
  } = useActivityFeedPolling({
    clientId,
    viewerRole,
    dateRangeStart,
    dateRangeEnd,
    eventCategory: category === 'all' ? null : category,
  });

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';

  const downloadPdf = async () => {
    if (!clientId) return;
    setPdfDownloading(true);
    try {
      // Lazy import to keep base44 client off the critical render path.
      const { base44 } = await import('@/api/base44Client');
      // The PDF function requires the session token to enforce role-based
      // access. Read from the same localStorage key as the rest of the app.
      const token = (() => {
        try { return localStorage.getItem('mio_session_token') || ''; } catch { return ''; }
      })();
      const res = await base44.functions.invoke('generate-activity-pdf', {
        client_id:         clientId,
        date_range_start:  dateRangeStart,
        date_range_end:    dateRangeEnd,
        viewer_role:       viewerRole,
        token,
      });
      // The function returns { pdf_base64, file_name }. We turn it into a
      // Blob and trigger the browser's download — easier than streaming
      // binaries through Base44's invoke layer.
      const data = res?.data ?? res;
      if (data?.pdf_base64) {
        const bin = atob(data.pdf_base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.file_name || `activity-${clientId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        console.error('[ActivityFeed] PDF response missing pdf_base64:', data);
      }
    } catch (err) {
      console.error('[ActivityFeed] PDF download failed:', err);
    }
    setPdfDownloading(false);
  };

  return (
    <div className="space-y-5">
      {/* Header row: filters + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200"
          >
            {RANGE_PRESETS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
            <option value="custom">Custom…</option>
          </select>

          {rangePreset === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200"
                aria-label="Start date"
              />
              <span className="text-slate-500 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200"
                aria-label="End date"
              />
            </>
          )}

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200"
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Last updated {lastUpdatedLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            className="h-8 px-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={downloadPdf}
            disabled={pdfDownloading || !clientId}
            className="h-8 gap-2"
          >
            {pdfDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-900/20 p-3 text-sm text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Couldn't load activity.{' '}
            <button onClick={refresh} className="underline">Try again</button>
          </div>
        </div>
      )}

      {/* Loading skeleton (only on first load) */}
      {loading && entries.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/30 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && !error && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-12 text-center">
          <Bell className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-200 font-semibold">No activity yet</p>
          <p className="text-sm text-slate-500 mt-1">
            {viewerRole === 'client'
              ? 'Once you start using your account, your activity will appear here.'
              : `No activity recorded for ${clientName || 'this client'} in this range.`}
          </p>
        </div>
      )}

      {/* Timeline */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e) => (
            <ActivityCard key={e.id} entry={e} viewerRole={viewerRole} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchMore}
            disabled={loading}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
