import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, CheckCircle2, Clock, Zap, Building2,
  ChevronDown, ChevronUp, StickyNote, Loader2, Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  pending_verification: 'bg-amber-100 text-amber-700',
  verified:             'bg-blue-100 text-blue-700',
  needs_clarification:  'bg-orange-100 text-orange-700',
};

// Package-tier colours for the new Product column. Falls back to neutral grey
// for add-ons / freeform descriptions.
const PACKAGE_TIER_COLORS = {
  ignite:         'bg-blue-100 text-blue-700',
  accelerate:     'bg-violet-100 text-violet-700',
  dominate:       'bg-amber-100 text-amber-700',
  street_pulse:   'bg-emerald-100 text-emerald-700',
  township_pulse: 'bg-teal-100 text-teal-700',
};

// Invoice status buckets — paid=emerald, overdue+failed=red, cancelled=grey,
// draft+sent+partial=amber, none=muted. Bucket label is the visible chip text;
// the raw Invoice.status enum is exposed via the chip's title attribute so
// hovering reveals the exact status.
const INVOICE_BUCKETS = {
  paid:          { label: 'Paid',          cls: 'bg-emerald-100 text-emerald-700' },
  action_needed: { label: 'Action needed', cls: 'bg-red-100 text-red-700' },
  unpaid:        { label: 'Unpaid',        cls: 'bg-amber-100 text-amber-700' },
  cancelled:     { label: 'Cancelled',     cls: 'bg-slate-200 text-slate-600' },
  none:          { label: 'No invoice',    cls: 'bg-slate-100 text-slate-400' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function fmtZAR(n) {
  if (n === null || n === undefined) return null;
  return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export default function MySales() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [closedSales, setClosedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesError, setSalesError] = useState(false);

  // Row-expansion + notes state. expandedId tracks one row at a time (clicking
  // a different row collapses the previous). notesByClient is a cache keyed by
  // client_id so re-expanding the same row doesn't re-fetch.
  const [expandedId, setExpandedId]       = useState(null);
  const [notesByClient, setNotesByClient] = useState({});
  const [notesLoading, setNotesLoading]   = useState({});
  const [noteText, setNoteText]           = useState('');
  const [savingNote, setSavingNote]       = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setSalesError(false);

    const IN_PROGRESS_STATUSES = ['pending_verification', 'verified', 'needs_clarification'];

    Promise.all([
      // Leads tab — unchanged.
      base44.entities.Lead.filter({ submitted_by: user.id }, '-created_date', 200),
      // Closed Sales tab — backend-enriched via list-my-sales (LB-097-aware).
      base44.functions.invoke('list-my-sales', {
        token: localStorage.getItem('mio_session_token'),
      }),
    ])
      .then(([leadRows, salesRes]) => {
        const allLeads = Array.isArray(leadRows) ? leadRows : [];
        setLeads(allLeads.filter(l => IN_PROGRESS_STATUSES.includes(l.status)));

        const salesData = salesRes?.data ?? salesRes;
        const rows = salesData?.closed_sales;
        if (Array.isArray(rows)) {
          setClosedSales(rows);
        } else {
          setClosedSales([]);
          setSalesError(true);
        }
      })
      .catch(err => {
        console.error('[MySales]', err);
        setSalesError(true);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const loadNotes = async (clientId) => {
    if (!clientId || notesByClient[clientId]) return;
    setNotesLoading(s => ({ ...s, [clientId]: true }));
    try {
      const rows = await base44.entities.InteractionNote.filter(
        { client_id: clientId },
        '-created_date',
      );
      setNotesByClient(s => ({ ...s, [clientId]: Array.isArray(rows) ? rows : [] }));
    } catch (err) {
      console.error('[MySales] notes load failed:', err);
      setNotesByClient(s => ({ ...s, [clientId]: [] }));
    } finally {
      setNotesLoading(s => ({ ...s, [clientId]: false }));
    }
  };

  const toggleExpand = (row) => {
    if (expandedId === row.invoice_id) {
      setExpandedId(null);
      setNoteText('');
      return;
    }
    setExpandedId(row.invoice_id);
    setNoteText('');
    if (row.client_id) loadNotes(row.client_id);
  };

  const addNote = async (clientId) => {
    if (!clientId || !noteText.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await base44.entities.InteractionNote.create({
        client_id:    clientId,
        content:      noteText.trim(),
        category:     'general_note',
        author_name:  user?.full_name || user?.email || 'Staff',
        author_email: user?.email || '',
      });
      setNoteText('');
      // Force reload (bypass the cache hit in loadNotes).
      const rows = await base44.entities.InteractionNote.filter(
        { client_id: clientId },
        '-created_date',
      );
      setNotesByClient(s => ({ ...s, [clientId]: Array.isArray(rows) ? rows : [] }));
    } catch (err) {
      console.error('[MySales] add note failed:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const tabs = [
    { key: 'leads',  label: 'Leads in Progress', icon: Clock,        count: leads.length },
    { key: 'closed', label: 'Closed Sales',      icon: CheckCircle2, count: closedSales.length },
  ];

  return (
    <AppLayout title="My Sales" subtitle="Your pipeline and closed deals">
      <div className="max-w-4xl mx-auto">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
              <p className="text-xs text-gray-500">Leads in Progress</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{closedSales.length}</p>
              <p className="text-xs text-gray-500">Closed Sales</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                tab === t.key ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-500'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[0,1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : tab === 'leads' ? (
          leads.length === 0 ? (
            <Empty icon={Zap} message="No leads in progress. Add a lead to get started." />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {leads.map(lead => (
                <div key={lead.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{lead.business_name}</p>
                    <p className="text-xs text-gray-500 truncate">{lead.contact_person} · {lead.phone}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Badge className={`text-xs border-0 ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                      {lead.status?.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-gray-400">{fmtDate(lead.created_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <ClosedSalesList
            rows={closedSales}
            salesError={salesError}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            notesByClient={notesByClient}
            notesLoading={notesLoading}
            noteText={noteText}
            setNoteText={setNoteText}
            savingNote={savingNote}
            onAddNote={addNote}
            onOpenClient={(clientId) => navigate(`/clients/${clientId}`)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function ClosedSalesList({
  rows, salesError, expandedId, onToggleExpand,
  notesByClient, notesLoading, noteText, setNoteText,
  savingNote, onAddNote, onOpenClient,
}) {
  if (salesError && rows.length === 0) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
        Could not load closed sales. Please refresh.
      </div>
    );
  }
  if (rows.length === 0) {
    return <Empty icon={TrendingUp} message="No closed sales yet. Go close something!" />;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
      {rows.map(row => {
        const isExpanded = expandedId === row.invoice_id;
        const bucket = INVOICE_BUCKETS[row.invoice_status_bucket] || INVOICE_BUCKETS.none;
        const amount = fmtZAR(row.sale_amount);

        return (
          <div key={row.invoice_id}>
            <div
              onClick={() => onToggleExpand(row)}
              className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-green-600" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {row.business_name || '(no business name)'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {row.contact_person || '—'}{row.phone ? ` · ${row.phone}` : ''}
                </p>

                {/* Mobile chip cluster — wraps the new columns under the contact line. */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 sm:hidden">
                  {row.product_label ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${productTierClass(row.product_label)} max-w-[160px] truncate`}>
                      {row.product_label}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                  {amount && <span className="text-xs font-semibold text-gray-900 tabular-nums">{amount}</span>}
                  <span
                    title={row.invoice_status || ''}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${bucket.cls}`}
                  >
                    {bucket.label}
                  </span>
                </div>
              </div>

              {/* Desktop columns */}
              <div className="hidden sm:flex items-center gap-3 shrink-0">
                {row.product_label ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${productTierClass(row.product_label)} max-w-[160px] truncate`}>
                    {row.product_label}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
                <span className={`text-sm font-semibold tabular-nums ${amount ? 'text-gray-900' : 'text-gray-400'}`}>
                  {amount || '—'}
                </span>
                <span
                  title={row.invoice_status || ''}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${bucket.cls}`}
                >
                  {bucket.label}
                </span>
              </div>

              <span className="text-xs text-gray-400 shrink-0 hidden md:inline">
                {fmtDate(row.sale_date)}
              </span>

              {isExpanded
                ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
            </div>

            {isExpanded && (
              <ExpandedNotes
                row={row}
                notes={notesByClient[row.client_id]}
                loading={!!notesLoading[row.client_id]}
                noteText={noteText}
                setNoteText={setNoteText}
                savingNote={savingNote}
                onAddNote={() => onAddNote(row.client_id)}
                onOpenClient={() => onOpenClient(row.client_id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExpandedNotes({
  row, notes, loading, noteText, setNoteText, savingNote, onAddNote, onOpenClient,
}) {
  return (
    <div
      className="px-5 py-4 border-t border-gray-100 bg-gray-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4 text-rose-600" />
        <h3 className="font-semibold text-gray-900 text-sm truncate">
          Notes for {row.business_name || 'this client'}
        </h3>
        <button
          type="button"
          onClick={onOpenClient}
          className="ml-auto text-xs text-blue-600 hover:underline shrink-0"
        >
          Open client →
        </button>
      </div>

      {loading && (
        <div className="space-y-2 mb-3">
          {[0,1].map(i => <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {!loading && (!notes || notes.length === 0) && (
        <p className="text-sm text-gray-400 mb-3">No notes yet.</p>
      )}

      {!loading && notes && notes.length > 0 && (
        <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
          {notes.map(n => {
            const author = n.author_name || n.created_by || 'Staff';
            const when = n.created_date || n.created_at;
            return (
              <div key={n.id} className="rounded border border-gray-200 bg-white px-3 py-2">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span className="text-xs font-medium text-gray-600">{author}</span>
                  {when && <span className="text-xs text-gray-400">· {fmtDateTime(when)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <textarea
        value={noteText}
        onChange={e => setNoteText(e.target.value)}
        placeholder="Add a note visible to all staff…"
        rows={3}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none bg-white"
      />
      <button
        type="button"
        onClick={onAddNote}
        disabled={savingNote || !noteText.trim()}
        className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:brightness-110 transition disabled:opacity-50"
      >
        {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add note
      </button>
    </div>
  );
}

function Empty({ icon: Icon, message }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
      <Icon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}
