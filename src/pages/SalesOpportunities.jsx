import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, FileX, StickyNote, Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';

const STAGE_META = {
  lead:       { label: 'Lead',       cls: 'bg-blue-100 text-blue-700' },
  no_package: { label: 'No Package', cls: 'bg-amber-100 text-amber-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-rose-100 text-rose-700' },
  churned:    { label: 'Churned',    cls: 'bg-slate-200 text-slate-600' },
};

const FILTERS = [
  ['all', 'All'],
  ['lead', 'Leads'],
  ['no_package', 'No Package'],
  ['cancelled', 'Cancelled'],
  ['churned', 'Churned'],
];

function fmtDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SalesOpportunities() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opps, setOpps] = useState([]);
  const [filter, setFilter] = useState('all');

  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await base44.functions.invoke('list-sales-opportunities', {
          token: localStorage.getItem('mio_session_token'),
        });
        const data = res?.data ?? res;
        if (cancelled) return;
        setOpps(Array.isArray(data?.opportunities) ? data.opportunities : []);
      } catch (err) {
        console.error('[SalesOpportunities] load failed:', err);
        if (!cancelled) setError('Could not load sales opportunities. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = {
    all: opps.length,
    lead: opps.filter(o => o.lifecycle_stage === 'lead').length,
    no_package: opps.filter(o => o.lifecycle_stage === 'no_package').length,
    cancelled: opps.filter(o => o.lifecycle_stage === 'cancelled').length,
    churned: opps.filter(o => o.lifecycle_stage === 'churned').length,
  };
  const filtered = filter === 'all' ? opps : opps.filter(o => o.lifecycle_stage === filter);

  const loadNotes = async (clientId) => {
    setNotesLoading(true);
    try {
      const rows = await base44.entities.InteractionNote.filter({ client_id: clientId }, '-created_date');
      setNotes(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[SalesOpportunities] notes load failed:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const selectOpp = (opp) => {
    setSelected(opp);
    setNoteText('');
    loadNotes(opp.id);
  };

  const addNote = async () => {
    if (!selected || !noteText.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await base44.entities.InteractionNote.create({
        client_id: selected.id,
        content: noteText.trim(),
        category: 'general_note',
        author_name: user?.full_name || user?.email || 'Staff',
        author_email: user?.email || '',
      });
      setNoteText('');
      await loadNotes(selected.id);
      toast.success('Note added');
    } catch (err) {
      console.error('[SalesOpportunities] add note failed:', err);
      toast.error('Could not add note. Please try again.');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <AppLayout title="Sales Opportunities" subtitle="Clients ready for outreach">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-rose-600">Sales Opportunities</h1>
        <p className="text-sm text-gray-500 mb-5">Clients ready for outreach</p>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition border ${
                filter === key
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
              }`}
            >
              {label} <span className="opacity-70">({counts[key] ?? 0})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Table */}
          <div className="lg:col-span-2">
            {loading && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">{error}</div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center">
                <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No opportunities right now — that's a good thing.</p>
              </div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
                {filtered.map(opp => {
                  const meta = STAGE_META[opp.lifecycle_stage] || { label: opp.lifecycle_stage || '—', cls: 'bg-gray-100 text-gray-600' };
                  const lastContact = fmtDate(opp.last_contact_at);
                  const isSelected = selected?.id === opp.id;
                  return (
                    <div
                      key={opp.id}
                      onClick={() => selectOpp(opp)}
                      className={`px-4 py-3 cursor-pointer transition flex items-center gap-3 ${
                        isSelected ? 'bg-rose-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{opp.business_name || '(no business name)'}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {opp.contact_person || '—'}{opp.phone ? ` · ${opp.phone}` : ''}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                          {opp.cancelled_invoice_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                              <FileX className="w-3 h-3" />
                              {opp.cancelled_invoice_count} cancelled invoice{opp.cancelled_invoice_count === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <div className="text-xs">
                          {lastContact
                            ? <span className="text-gray-500">Last contact: {lastContact}</span>
                            : <span className="text-orange-600 font-medium">Never contacted</span>}
                        </div>
                        <div className="text-xs text-gray-400">Created {fmtDate(opp.created_date) || '—'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/clients/${opp.id}`); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#0A1F44] text-white hover:brightness-110 transition"
                      >
                        Open
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes panel */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-4 h-4 text-rose-600" />
                <h2 className="font-semibold text-gray-900">Notes</h2>
              </div>

              {!selected && (
                <p className="text-sm text-gray-400 py-6 text-center">Select an opportunity to see its notes.</p>
              )}

              {selected && (
                <>
                  <p className="text-xs text-gray-500 mb-3">
                    {selected.business_name || '(no business name)'}
                  </p>

                  {notesLoading && (
                    <div className="space-y-2 mb-3">
                      {[0, 1].map(i => <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />)}
                    </div>
                  )}

                  {!notesLoading && notes.length === 0 && (
                    <p className="text-sm text-gray-400 mb-3">No notes yet.</p>
                  )}

                  {!notesLoading && notes.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-80 overflow-y-auto">
                      {notes.map(n => (
                        <div key={n.id} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {n.author_name || 'Staff'}{(fmtDate(n.created_date) ? ` · ${fmtDate(n.created_date)}` : '')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note about this opportunity…"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
                  />
                  <button
                    type="button"
                    onClick={addNote}
                    disabled={savingNote || !noteText.trim()}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:brightness-110 transition disabled:opacity-50"
                  >
                    {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add note
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
