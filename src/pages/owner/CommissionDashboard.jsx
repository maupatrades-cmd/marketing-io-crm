import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import RouteGuard from '@/components/RouteGuard';
import { DollarSign, Users, ListChecks, AlertTriangle, Clock } from 'lucide-react';

const TABS = [
  { id: 'overview',   label: 'Overview',       icon: DollarSign },
  { id: 'by_person',  label: 'By Person',      icon: Users },
  { id: 'log',        label: 'Commission Log', icon: ListChecks },
  { id: 'payroll',    label: 'Payroll Batch',  icon: Clock },
  { id: 'clawbacks',  label: 'Clawbacks',      icon: AlertTriangle }
];

const PAID_STATUSES = new Set(['paid']);
const PENDING_STATUSES = new Set(['pending', 'pending_milestone', 'pending_payment', 'approved']);
const CLAWED_STATUSES = new Set(['clawed_back', 'clawback']);

function fmtZAR(n) {
  return `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function userIdOf(c) { return c.user_id || c.staff_id || ''; }
function userNameOf(c) { return c.user_name || c.staff_name || '—'; }
function typeOf(c) { return c.type || c.commission_type || ''; }
function amountOf(c) { return Number(c.amount ?? c.commission_amount ?? 0); }

function StatCard({ label, value, hint, accent = 'primary' }) {
  const accentBorder = {
    primary: 'border-primary/30',
    success: 'border-emerald-500/30',
    warning: 'border-amber-500/30',
    danger: 'border-rose-500/30'
  }[accent];
  return (
    <div className={`rounded-2xl border ${accentBorder} bg-slate-900/60 p-5`}>
      <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:           ['bg-slate-700/50',  'text-slate-300'],
    pending_milestone: ['bg-amber-900/40',  'text-amber-300'],
    pending_payment:   ['bg-emerald-900/30','text-emerald-300'],
    approved:          ['bg-emerald-900/40','text-emerald-200'],
    paid:              ['bg-emerald-700/40','text-emerald-100'],
    withheld:          ['bg-slate-800',     'text-slate-400'],
    clawed_back:       ['bg-rose-900/40',   'text-rose-300'],
    clawback:          ['bg-rose-900/40',   'text-rose-300'],
    cancelled:         ['bg-slate-800',     'text-slate-500']
  };
  const [bg, fg] = map[status] || ['bg-slate-800', 'text-slate-400'];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${bg} ${fg}`}>{status || '—'}</span>;
}

export default function CommissionDashboard() {
  const [tab, setTab] = useState('overview');
  const [commissions, setCommissions] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for the Commission Log tab.
  const [logUserFilter, setLogUserFilter] = useState('all');
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [logStatusFilter, setLogStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [comms, tr, us] = await Promise.all([
          base44.entities.Commission.filter({}, '-created_date', 1000).catch(() => []),
          base44.entities.MilestoneTracker.filter({}).catch(() => []),
          base44.entities.User.filter({}).catch(() => [])
        ]);
        if (cancelled) return;
        setCommissions(Array.isArray(comms) ? comms : []);
        setTrackers(Array.isArray(tr) ? tr : []);
        setUsers(Array.isArray(us) ? us : []);
      } catch (err) {
        console.error('[CommissionDashboard] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // -------- Aggregations -------------------------------------------------

  const totals = useMemo(() => {
    let pending = 0, paid = 0, clawedBack = 0, ytdPaid = 0;
    const yr = new Date().getUTCFullYear();
    for (const c of commissions) {
      const amt = amountOf(c);
      if (PAID_STATUSES.has(c.status)) {
        paid += amt;
        const paidAt = c.paid_at || c.paid_date;
        if (paidAt && new Date(paidAt).getUTCFullYear() === yr) ytdPaid += amt;
      } else if (PENDING_STATUSES.has(c.status)) {
        pending += amt;
      } else if (CLAWED_STATUSES.has(c.status)) {
        clawedBack += amt;
      }
    }
    return { pending, paid, clawedBack, ytdPaid };
  }, [commissions]);

  const thisMonthPayable = useMemo(() => {
    const ym = new Date();
    ym.setUTCDate(1);
    const start = ym.toISOString().slice(0, 10);
    const next = new Date(ym); next.setUTCMonth(next.getUTCMonth() + 1);
    const end = next.toISOString().slice(0, 10);
    return commissions
      .filter(c => c.scheduled_payout_date && c.scheduled_payout_date >= start && c.scheduled_payout_date < end)
      .reduce((s, c) => s + amountOf(c), 0);
  }, [commissions]);

  const byPerson = useMemo(() => {
    const map = new Map();
    for (const c of commissions) {
      const id = userIdOf(c);
      if (!id) continue;
      const row = map.get(id) || {
        user_id: id,
        user_name: userNameOf(c),
        pending: 0,
        paid: 0,
        clawed: 0
      };
      const amt = amountOf(c);
      if (PAID_STATUSES.has(c.status)) row.paid += amt;
      else if (PENDING_STATUSES.has(c.status)) row.pending += amt;
      else if (CLAWED_STATUSES.has(c.status)) row.clawed += amt;
      map.set(id, row);
    }
    const trackerByUser = new Map(trackers.map(t => [t.user_id, t]));
    return Array.from(map.values()).map(row => {
      const t = trackerByUser.get(row.user_id);
      return {
        ...row,
        current_batch_count: t?.current_batch_count ?? 0,
        total_milestones_hit: t?.total_milestones_hit ?? 0
      };
    }).sort((a, b) => b.pending - a.pending);
  }, [commissions, trackers]);

  const filteredLog = useMemo(() => {
    return commissions.filter(c => {
      if (logUserFilter !== 'all' && userIdOf(c) !== logUserFilter) return false;
      if (logTypeFilter !== 'all' && typeOf(c) !== logTypeFilter) return false;
      if (logStatusFilter !== 'all' && c.status !== logStatusFilter) return false;
      return true;
    });
  }, [commissions, logUserFilter, logTypeFilter, logStatusFilter]);

  const upcomingPayout = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now); horizon.setUTCDate(horizon.getUTCDate() + 7);
    return commissions
      .filter(c =>
        c.scheduled_payout_date &&
        new Date(c.scheduled_payout_date) >= now &&
        new Date(c.scheduled_payout_date) <= horizon &&
        (c.status === 'pending_payment' || c.status === 'approved')
      )
      .sort((a, b) => (a.scheduled_payout_date || '').localeCompare(b.scheduled_payout_date || ''));
  }, [commissions]);

  const clawbacks = useMemo(
    () => commissions.filter(c => CLAWED_STATUSES.has(c.status)),
    [commissions]
  );

  const allTypes = useMemo(() => {
    const s = new Set();
    for (const c of commissions) {
      const t = typeOf(c);
      if (t) s.add(t);
    }
    return Array.from(s).sort();
  }, [commissions]);

  const allStatuses = useMemo(() => {
    const s = new Set();
    for (const c of commissions) if (c.status) s.add(c.status);
    return Array.from(s).sort();
  }, [commissions]);

  // -------- Render -------------------------------------------------------

  return (
    <RouteGuard allowedRoles={['owner']} fallbackPath="/">
      <AppLayout title="Commission Engine" subtitle="Working System v1.0">
        <div className="space-y-6">
          {/* Tab bar */}
          <div className="flex flex-wrap gap-2 border-b border-slate-700/60">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                    active
                      ? 'border-primary text-white'
                      : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {loading && <p className="text-slate-400">Loading commissions…</p>}

          {!loading && tab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Pending (all)" value={fmtZAR(totals.pending)} hint="pending_milestone + pending_payment + approved" accent="warning" />
              <StatCard label="This month payable" value={fmtZAR(thisMonthPayable)} hint="scheduled_payout_date in current month" accent="primary" />
              <StatCard label="YTD paid" value={fmtZAR(totals.ytdPaid)} hint="paid this calendar year" accent="success" />
              <StatCard label="Clawed back" value={fmtZAR(totals.clawedBack)} hint="lifetime" accent="danger" />
            </div>
          )}

          {!loading && tab === 'by_person' && (
            <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Staff</th>
                    <th className="px-4 py-3 text-right">Pending</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Clawed</th>
                    <th className="px-4 py-3 text-center">Milestone batch</th>
                    <th className="px-4 py-3 text-center">Total milestones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {byPerson.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No commissions yet.</td></tr>
                  )}
                  {byPerson.map(row => (
                    <tr key={row.user_id} className="bg-slate-900/40">
                      <td className="px-4 py-3 text-white">{row.user_name}</td>
                      <td className="px-4 py-3 text-right text-amber-200">{fmtZAR(row.pending)}</td>
                      <td className="px-4 py-3 text-right text-emerald-300">{fmtZAR(row.paid)}</td>
                      <td className="px-4 py-3 text-right text-rose-300">{fmtZAR(row.clawed)}</td>
                      <td className="px-4 py-3 text-center text-slate-200">{row.current_batch_count}/5</td>
                      <td className="px-4 py-3 text-center text-slate-400">{row.total_milestones_hit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && tab === 'log' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <select
                  value={logUserFilter}
                  onChange={e => setLogUserFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="all">All staff</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.name || u.email}</option>
                  ))}
                </select>
                <select
                  value={logTypeFilter}
                  onChange={e => setLogTypeFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="all">All types</option>
                  {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  value={logStatusFilter}
                  onChange={e => setLogStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="all">All statuses</option>
                  {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="ml-auto text-sm text-slate-500 self-center">{filteredLog.length} rows</span>
              </div>

              <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Staff</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Payout date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {filteredLog.slice(0, 200).map(c => (
                      <tr key={c.id} className="bg-slate-900/40">
                        <td className="px-3 py-2 text-slate-400">{(c.qualifying_event_at || c.created_date || '').slice(0, 10)}</td>
                        <td className="px-3 py-2 text-white">{userNameOf(c)}</td>
                        <td className="px-3 py-2 text-slate-300">{typeOf(c)}</td>
                        <td className="px-3 py-2 text-slate-400">{c.product_name || c.package_or_addon || '—'}</td>
                        <td className="px-3 py-2 text-right font-medium text-white">{fmtZAR(amountOf(c))}</td>
                        <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                        <td className="px-3 py-2 text-slate-400">{c.scheduled_payout_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredLog.length > 200 && (
                <p className="text-xs text-slate-500">Showing first 200 of {filteredLog.length}.</p>
              )}
            </div>
          )}

          {!loading && tab === 'payroll' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Commissions scheduled to pay in the next 7 days.</p>
              <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Payout date</th>
                      <th className="px-3 py-2 text-left">Staff</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {upcomingPayout.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No commissions scheduled in the next 7 days.</td></tr>
                    )}
                    {upcomingPayout.map(c => (
                      <tr key={c.id} className="bg-slate-900/40">
                        <td className="px-3 py-2 text-slate-200 font-medium">{c.scheduled_payout_date}</td>
                        <td className="px-3 py-2 text-white">{userNameOf(c)}</td>
                        <td className="px-3 py-2 text-slate-300">{typeOf(c)}</td>
                        <td className="px-3 py-2 text-right text-white">{fmtZAR(amountOf(c))}</td>
                        <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && tab === 'clawbacks' && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Staff</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-500/20">
                  {clawbacks.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No clawbacks recorded.</td></tr>
                  )}
                  {clawbacks.map(c => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-slate-400">{(c.qualifying_event_at || c.created_date || '').slice(0, 10)}</td>
                      <td className="px-3 py-2 text-white">{userNameOf(c)}</td>
                      <td className="px-3 py-2 text-slate-300">{typeOf(c)}</td>
                      <td className="px-3 py-2 text-right text-rose-300">{fmtZAR(amountOf(c))}</td>
                      <td className="px-3 py-2 text-slate-400">{c.clawback_reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AppLayout>
    </RouteGuard>
  );
}
