import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';

const SUBTITLE_BY_ROLE = {
  owner:       'All invoices across the team',
  admin:       'All staff invoices (oversight)',
  cpc:         'Invoices from your sales',
  field_agent: 'Invoices from your sales',
};

// Tab metadata. Default tab is "unpaid". Ordering here drives the tab pill
// order on screen (Unpaid → Overdue → Paid → Cancelled).
const TABS = [
  {
    id: 'unpaid',
    label: 'Unpaid',
    cardCls: 'text-amber-600',
    badgeCls: 'bg-amber-100 text-amber-700',
    badgeLabel: 'Unpaid',
    emptyText: "No unpaid invoices — you're all caught up.",
    icon: Clock,
  },
  {
    id: 'overdue',
    label: 'Overdue',
    cardCls: 'text-red-600',
    badgeCls: 'bg-red-100 text-red-700',
    badgeLabel: 'Action needed',
    emptyText: 'Nothing overdue — well done.',
    icon: AlertTriangle,
  },
  {
    id: 'paid',
    label: 'Paid',
    cardCls: 'text-emerald-600',
    badgeCls: 'bg-emerald-100 text-emerald-700',
    badgeLabel: 'Paid',
    emptyText: 'No paid invoices yet.',
    icon: CheckCircle2,
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    cardCls: 'text-slate-500',
    badgeCls: 'bg-slate-200 text-slate-600',
    badgeLabel: 'Cancelled',
    emptyText: 'No cancelled invoices.',
    icon: XCircle,
  },
];

const PACKAGE_TIER_COLORS = {
  ignite:         'bg-blue-100 text-blue-700',
  accelerate:     'bg-violet-100 text-violet-700',
  dominate:       'bg-amber-100 text-amber-700',
  street_pulse:   'bg-emerald-100 text-emerald-700',
  township_pulse: 'bg-teal-100 text-teal-700',
};

function fmtZAR(n) {
  if (n === null || n === undefined) return null;
  return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtZARShort(n) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function productTierClass(label) {
  if (!label) return 'bg-slate-100 text-slate-700';
  const lower = label.toLowerCase();
  for (const key of Object.keys(PACKAGE_TIER_COLORS)) {
    if (lower.includes(key) || lower.includes(key.replace(/_/g, ' '))) {
      return PACKAGE_TIER_COLORS[key];
    }
  }
  return 'bg-slate-100 text-slate-700';
}

export default function MyInvoices() {
  const [loading, setLoading]         = useState(true);
  const [errored, setErrored]         = useState(false);
  const [invoices, setInvoices]       = useState([]);
  const [counts, setCounts]           = useState({ unpaid: 0, overdue: 0, paid: 0, cancelled: 0, total: 0 });
  const [sums, setSums]               = useState({ unpaid: 0, overdue: 0, paid: 0, cancelled: 0 });
  const [viewerRole, setViewerRole]   = useState(null);
  const [tab, setTab]                 = useState('unpaid');

  const load = useCallback(() => {
    setLoading(true);
    setErrored(false);
    return base44.functions
      .invoke('list-my-invoices', { token: localStorage.getItem('mio_session_token') })
      .then((res) => {
        const data = res?.data ?? res;
        if (!data || !Array.isArray(data.invoices)) {
          setInvoices([]);
          setErrored(true);
          return;
        }
        setInvoices(data.invoices);
        setCounts(data.counts || { unpaid: 0, overdue: 0, paid: 0, cancelled: 0, total: 0 });
        setSums(data.sums || { unpaid: 0, overdue: 0, paid: 0, cancelled: 0 });
        setViewerRole(data.viewer_role || null);
      })
      .catch((err) => {
        console.error('[MyInvoices]', err);
        setErrored(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial load + auto-refresh when window regains focus (so closing a deal
  // in another tab/flow and tabbing back here picks up the new invoice
  // without a hard refresh). Also refreshes when the document becomes
  // visible again on mobile.
  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const showCloserColumn = viewerRole === 'owner' || viewerRole === 'admin';
  const subtitle = SUBTITLE_BY_ROLE[viewerRole] || 'Your invoices';
  const visibleRows = invoices.filter((row) => row.status_bucket === tab);
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  // Days-outstanding column is only relevant for unpaid / overdue tabs.
  const showDaysCol = tab === 'unpaid' || tab === 'overdue';

  return (
    <AppLayout title="My Invoices" subtitle={subtitle}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-rose-600">My Invoices</h1>
            <p className="text-sm text-gray-500 mb-5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:border-rose-300 transition disabled:opacity-50"
            title="Refresh invoice list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {TABS.map((t) => (
            <StatCard
              key={t.id}
              label={t.label}
              countOnly={t.id === 'cancelled'}
              count={counts[t.id] ?? 0}
              sum={sums[t.id] ?? 0}
              colourCls={t.cardCls}
              loading={loading}
            />
          ))}
        </div>

        {/* Error banner */}
        {errored && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm mb-4">
            Could not load invoices. Please refresh.
          </div>
        )}

        {/* Tab pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition border ${
                tab === t.id
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
              }`}
            >
              {t.label} <span className="opacity-70">({counts[t.id] ?? 0})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <activeTab.icon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{activeTab.emptyText}</p>
          </div>
        ) : (
          <InvoiceTable
            rows={visibleRows}
            activeTab={activeTab}
            showCloserColumn={showCloserColumn}
            showDaysCol={showDaysCol}
          />
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ label, count, sum, countOnly, colourCls, loading }) {
  if (loading) {
    return <div className="h-20 rounded-xl bg-gray-100 animate-pulse" />;
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      {countOnly ? (
        <>
          <p className={`text-2xl font-bold mt-1 ${colourCls}`}>{count}</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmtZARShort(sum)} value</p>
        </>
      ) : (
        <>
          <p className={`text-xl font-bold mt-1 tabular-nums ${colourCls}`}>{fmtZARShort(sum)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{count} invoice{count === 1 ? '' : 's'}</p>
        </>
      )}
    </div>
  );
}

function InvoiceTable({ rows, activeTab, showCloserColumn, showDaysCol }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Desktop table */}
      <table className="w-full hidden md:table">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2">Invoice #</th>
            <th className="px-4 py-2">Client</th>
            <th className="px-4 py-2">Product</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2">Issued</th>
            {showDaysCol && <th className="px-4 py-2 text-right">Days out</th>}
            <th className="px-4 py-2">Status</th>
            {showCloserColumn && <th className="px-4 py-2">Closer</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <DesktopRow
              key={row.invoice_id}
              row={row}
              activeTab={activeTab}
              showCloserColumn={showCloserColumn}
              showDaysCol={showDaysCol}
            />
          ))}
        </tbody>
      </table>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {rows.map((row) => (
          <MobileCard
            key={row.invoice_id}
            row={row}
            activeTab={activeTab}
            showCloserColumn={showCloserColumn}
            showDaysCol={showDaysCol}
          />
        ))}
      </div>
    </div>
  );
}

function DesktopRow({ row, activeTab, showCloserColumn, showDaysCol }) {
  const amount = fmtZAR(row.sale_amount);
  const days = row.days_outstanding;
  const daysCell =
    !showDaysCol || days === null || days === undefined || days < 0
      ? <span className="text-gray-400">—</span>
      : <span className={days >= 7 && row.status_bucket === 'overdue' ? 'text-red-700 font-semibold' : 'text-gray-700'}>{days}</span>;

  return (
    <tr className="text-sm">
      <td className="px-4 py-3 font-mono text-xs text-gray-600">
        {row.invoice_number || '—'}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 truncate max-w-[200px]">
          {row.client_name || '(no business name)'}
        </div>
        <div className="text-xs text-gray-500 truncate max-w-[200px]">
          {row.contact_person || '—'}{row.phone ? ` · ${row.phone}` : ''}
        </div>
      </td>
      <td className="px-4 py-3">
        {row.product_label ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${productTierClass(row.product_label)} max-w-[180px] truncate inline-block align-middle`}>
            {row.product_label}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
        {amount || '—'}
      </td>
      <td className="px-4 py-3 text-gray-600">
        {fmtDate(row.issued_date)}
      </td>
      {showDaysCol && (
        <td className="px-4 py-3 text-right tabular-nums">{daysCell}</td>
      )}
      <td className="px-4 py-3">
        <span
          title={row.status || ''}
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${activeTab.badgeCls}`}
        >
          {activeTab.badgeLabel}
        </span>
      </td>
      {showCloserColumn && (
        <td className="px-4 py-3 text-gray-700 truncate max-w-[160px]">
          {row.closer_name || <span className="text-gray-400">—</span>}
        </td>
      )}
    </tr>
  );
}

function MobileCard({ row, activeTab, showCloserColumn, showDaysCol }) {
  const amount = fmtZAR(row.sale_amount);
  const days = row.days_outstanding;
  const showDays = showDaysCol && days !== null && days !== undefined && days >= 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">
            {row.client_name || '(no business name)'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {row.invoice_number || '—'}{row.contact_person ? ` · ${row.contact_person}` : ''}
          </p>
        </div>
        <span
          title={row.status || ''}
          className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${activeTab.badgeCls}`}
        >
          {activeTab.badgeLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {row.product_label ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${productTierClass(row.product_label)} max-w-[180px] truncate`}>
            {row.product_label}
          </span>
        ) : null}
        {amount && <span className="text-xs font-semibold text-gray-900 tabular-nums">{amount}</span>}
        <span className="text-xs text-gray-400">Issued {fmtDate(row.issued_date)}</span>
        {showDays && (
          <span className={`text-xs ${days >= 7 && row.status_bucket === 'overdue' ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>
            {days} day{days === 1 ? '' : 's'} out
          </span>
        )}
      </div>

      {showCloserColumn && (
        <p className="text-xs text-gray-500 mt-1 truncate">
          Closer: {row.closer_name || '—'}
        </p>
      )}
    </div>
  );
}
