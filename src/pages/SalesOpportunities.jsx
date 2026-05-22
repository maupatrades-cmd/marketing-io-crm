import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, FileX, StickyNote, Plus, Loader2, CheckCircle2, XCircle, CalendarClock, UserCheck } from 'lucide-react';
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

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [opps, setOpps]         = useState([]);
  const [filter, setFilter]     = useState('all');

  const [selected, setSelected]         = useState(null);
  const [notes, setNotes]               = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText]         = useState('');
  const [savingNote, setSavingNote]     = useState(false);

  // Action panel state
  const [actionMode, setActionMode]     = useState(null); // 'sold' | 'not_interested' | 'join_later'
  const [actionNotes, setActionNotes]   = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // ── Load opportunities ──────────────────────────────────────────────────
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
    all:        opps.length,
    lead:       opps.filter(o => o.lifecycle_stage === 'lead').length,
    no_package: opps.filter(o => o.lifecycle_stage === 'no_package').length,
    cancelled:  opps.filter(o => o.lifecycle_stage === 'cancelled').length,
    churned:    opps.filter(o => o.lifecycle_stage === 'churned').length,
  };
  const filtered = filter === 'all' ? opps : opps.filter(o => o.lifecycle_stage === filter);

  // ── Notes ───────────────────────────────────────────────────────────────
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
    setActionMode(null);
    setActionNotes('');
    setFollowUpDate('');
    loadNotes(opp.id);
  };

  const addNote = async () => {
    if (!selected || !noteText.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await base44.entities.InteractionNote.create({
        client_id:   selected.id,
        content:     noteText.trim(),
        category:    'general_note',
        author_name:  user?.full_name || user?.email || 'Staff',
        author_email: user?.email || '',
      });
      setNoteText('');
      await loadNotes(selected.id);
      toast.success('Note added');
    } catch (err) {
      console.error('[SalesOpportunities] add note failed:', err);
      toast.error('Could not add note.');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Action submit ────────────────────────────────────────────────────────
  const submitAction = async () => {
    if (!selected || !actionMode || submitting) return;
    if (actionMode === 'join_later' && !followUpDate) {
      toast.error('Please pick a follow-up date.');
      return;
    }

    setSubmitting(true);
    try {
      const actorName = user?.full_name || user?.email || 'Staff';
      const actorRole = user?.role || 'staff';

      // 1. Log to ClientActivityLog (visible in activity feeds)
      const summaryMap = {
        sold:           `Marked as SOLD by ${actorName}`,
        not_interested: `Marked as NOT INTERESTED by ${actorName}`,
        join_later:     `Follow-up scheduled for ${followUpDate} by ${actorName}`,
      };
      await base44.entities.ClientActivityLog.create({
        client_id:      selected.id,
        client_name:    selected.business_name,
        actor_id:       user?.id || '',
        actor_role:     actorRole,
        event_type:     `sales_${actionMode}`,
        event_category: 'lead',
        event_summary:  summaryMap[actionMode],
        event_label:    summaryMap[actionMode],
        event_metadata: {
          action:          actionMode,
          notes:           actionNotes.trim(),
          follow_up_date:  followUpDate || null,
          actor_name:      actorName,
        },
        logged_by:      user?.id || '',
        logged_by_name: actorName,
      });

      // 2. If there are notes, also create an InteractionNote (visible to all staff)
      if (actionNotes.trim()) {
        await base44.entities.InteractionNote.create({
          client_id:    selected.id,
          content:      `[${actionMode.replace(/_/g, ' ').toUpperCase()}] ${actionNotes.trim()}`,
          category:     'general_note',
          author_name:  actorName,
          author_email: user?.email || '',
        });
      }

      // 3. Action-specific logic
      if (actionMode === 'sold') {
        // Assign this staff member to the client
        const patch = { signed_up_by_id: user?.id };
        if (['field_agent', 'cpc'].includes(actorRole)) {
          patch.assigned_field_agent = user?.id;
        }
        await base44.entities.Client.update(selected.id, patch);
        // Remove from opportunities list
        setOpps(prev => prev.filter(o => o.id !== selected.id));
        setSelected(null);
        toast.success(`${selected.business_name} marked as SOLD and assigned to you!`);
      } else if (actionMode === 'join_later') {
        // Create a follow-up task
        await base44.entities.Task.create({
          title:             `Follow up with ${selected.business_name}`,
          client_id:         selected.id,
          client_name:       selected.business_name,
          assigned_to:       user?.id || '',
          assigned_to_name:  actorName,
          due_date:          followUpDate,
          status:            'open',
          priority:          'medium',
          notes:             actionNotes.trim() || `Join Later follow-up scheduled by ${actorName}`,
        });
        toast.success(`Follow-up task created for ${fmtDate(followUpDate)}`);
      } else if (actionMode === 'not_interested') {
        toast.success(`Logged: ${selected.business_name} is not interested.`);
      }

      // Reload notes to show the new note
      await loadNotes(selected.id);
      setActionMode(null);
      setActionNotes('');
      setFollowUpDate('');
    } catch (err) {
      console.error('[SalesOpportunities] action failed:', err);
      toast.error('Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Sales Opportunities" subtitle="Clients ready for outreach">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-rose-600">Sales Opportunities</h1>
        <p className="text-sm text-gray-500 mb-5">Clients not yet active — leads, no-package, cancelled &amp; churned</p>

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
          {/* ── Client list ────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            {loading && (
              <div className="space-y-2">
                {[0,1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
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
                        isSelected ? 'bg-rose-50 border-l-4 border-l-rose-500' : 'hover:bg-gray-50'
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

          {/* ── Right panel ─────────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Actions panel */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>

              {!selected && (
                <p className="text-sm text-gray-400 py-4 text-center">Select a client to log an action.</p>
              )}

              {selected && !actionMode && (
                <>
                  <p className="text-xs font-medium text-gray-500 mb-3 truncate">{selected.business_name}</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setActionMode('sold')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:brightness-110 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Sold 🎉
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionMode('join_later')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:brightness-110 transition"
                    >
                      <CalendarClock className="w-4 h-4" />
                      Join Later
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionMode('not_interested')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                    >
                      <XCircle className="w-4 h-4" />
                      Not Interested
                    </button>
                  </div>
                </>
              )}

              {selected && actionMode && (
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                      actionMode === 'sold'           ? 'bg-green-100 text-green-700' :
                      actionMode === 'join_later'     ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                    }`}>
                      {actionMode === 'sold' ? '🎉 Sold' : actionMode === 'join_later' ? '📅 Join Later' : '✗ Not Interested'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setActionMode(null); setActionNotes(''); setFollowUpDate(''); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      ← Back
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mb-3 truncate font-medium">{selected.business_name}</p>

                  {/* Join Later date picker */}
                  {actionMode === 'join_later' && (
                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 mb-1 font-medium">Follow-up date <span className="text-rose-500">*</span></label>
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={e => setFollowUpDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  )}

                  {/* Sold — staff assignment notice */}
                  {actionMode === 'sold' && (
                    <div className="mb-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <UserCheck className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-xs text-green-700">
                        <strong>{user?.full_name || user?.email}</strong> will be assigned to this client.
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Notes (visible to all staff)</label>
                  <textarea
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    placeholder={
                      actionMode === 'sold'           ? 'Add details about the sale…' :
                      actionMode === 'join_later'     ? 'Reason for follow-up, what was discussed…' :
                                                        'Reason they\'re not interested…'
                    }
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none mb-3"
                  />

                  <button
                    type="button"
                    onClick={submitAction}
                    disabled={submitting}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${
                      actionMode === 'sold'       ? 'bg-green-600 hover:brightness-110' :
                      actionMode === 'join_later' ? 'bg-blue-600 hover:brightness-110' :
                                                    'bg-gray-500 hover:bg-gray-600'
                    }`}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {actionMode === 'sold'       ? 'Confirm Sale' :
                     actionMode === 'join_later' ? 'Schedule Follow-up' :
                                                   'Log Not Interested'}
                  </button>
                </div>
              )}
            </div>

            {/* Notes panel */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-4 h-4 text-rose-600" />
                <h2 className="font-semibold text-gray-900">Notes</h2>
                {selected && <span className="text-xs text-gray-400 ml-auto truncate max-w-[120px]">{selected.business_name}</span>}
              </div>

              {!selected && (
                <p className="text-sm text-gray-400 py-6 text-center">Select an opportunity to see notes.</p>
              )}

              {selected && (
                <>
                  {notesLoading && (
                    <div className="space-y-2 mb-3">
                      {[0,1].map(i => <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />)}
                    </div>
                  )}

                  {!notesLoading && notes.length === 0 && (
                    <p className="text-sm text-gray-400 mb-3">No notes yet.</p>
                  )}

                  {!notesLoading && notes.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                      {notes.map(n => {
                        const authorDisplay = n.author_name || n.created_by || 'Staff';
                        const noteDate = n.created_date || n.created_at;
                        const dateStr = noteDate ? new Date(noteDate).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
                        return (
                          <div key={n.id} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</p>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className="text-xs font-medium text-gray-600">{authorDisplay}</span>
                              {dateStr && <span className="text-xs text-gray-400">· {dateStr}</span>}
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