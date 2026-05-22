import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, StickyNote, Plus, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { PRODUCT_CATALOG } from '@/data/ProductCatalog';

// The 12 add-on ids that map exactly to the ClientAddOn.add_on enum.
const UPSELL_ADDON_IDS = [
  'ai_chatbot', 'whatsapp_automation', 'reputation_management', 'google_business_profile',
  'email_newsletter', 'short_form_video', 'sms_marketing', 'marketing_audit',
  'competitor_analysis', 'ai_content_writing', 'website_maintenance', 'paid_ads_management',
];
const UPSELL_PRODUCTS = UPSELL_ADDON_IDS
  .map(id => PRODUCT_CATALOG.find(p => p.id === id))
  .filter(Boolean);

function fmtZAR(n) {
  return `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// Price the workspace shows + the amount that gets invoiced.
function invoiceAmountFor(p) {
  return p.setup_price > 0 ? p.setup_price : p.monthly_price;
}
function priceLabel(p) {
  if (p.setup_price > 0 && p.monthly_price > 0) return `${fmtZAR(p.setup_price)} setup + ${fmtZAR(p.monthly_price)}/mo`;
  if (p.setup_price > 0) return `${fmtZAR(p.setup_price)} once-off`;
  if (p.monthly_price > 0) return `${fmtZAR(p.monthly_price)}/mo`;
  return 'Priced per ad spend';
}

export default function UpsellWorkspace() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [client, setClient] = useState(null);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [confirmProduct, setConfirmProduct] = useState(null);
  const [saleNote, setSaleNote] = useState('');
  const [adding, setAdding] = useState(false);

  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadClient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('list-upsell-clients', {
        token: localStorage.getItem('mio_session_token'),
      });
      const data = res?.data ?? res;
      const found = (Array.isArray(data?.clients) ? data.clients : []).find(c => c.id === clientId);
      if (!found) {
        setError('Client not found, or not an active client.');
        setClient(null);
      } else {
        setClient(found);
      }
    } catch (err) {
      console.error('[UpsellWorkspace] load failed:', err);
      setError('Could not load this client. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const rows = await base44.entities.InteractionNote.filter({ client_id: clientId }, '-created_date');
      setNotes(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[UpsellWorkspace] notes load failed:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [clientId]);

  useEffect(() => { loadClient(); loadNotes(); }, [loadClient, loadNotes]);

  const ownedSet = new Set(client?.addons_owned || []);

  const confirmAdd = async () => {
    if (!confirmProduct || adding) return;
    setAdding(true);
    try {
      const res = await base44.functions.invoke('add-product-to-client', {
        token: localStorage.getItem('mio_session_token'),
        client_id: clientId,
        product_id: confirmProduct.id,
        note_text: saleNote.trim(),
      });
      const data = res?.data ?? res;
      if (data?.error) {
        toast.error(data.detail || data.error);
        return;
      }
      toast.success('Added! Invoice created. Refresh to see.');
      setConfirmProduct(null);
      setSaleNote('');
      await loadClient();
      await loadNotes();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error;
      console.error('[UpsellWorkspace] add product failed:', err);
      toast.error(detail || 'Could not add the product. Nothing was changed.');
    } finally {
      setAdding(false);
    }
  };

  const saveStandaloneNote = async () => {
    if (!noteText.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await base44.entities.InteractionNote.create({
        client_id: clientId,
        content: noteText.trim(),
        category: 'general_note',
        author_name: user?.full_name || user?.email || 'Staff',
        author_email: user?.email || '',
      });
      setNoteText('');
      setNoteFormOpen(false);
      await loadNotes();
      toast.success('Note saved');
    } catch (err) {
      console.error('[UpsellWorkspace] save note failed:', err);
      toast.error('Could not save note.');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <AppLayout title="Upsell Workspace">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-32 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
            {error}{' '}
            <button type="button" onClick={() => navigate('/upsell')} className="underline font-medium">Back to Upsell</button>
          </div>
        )}

        {!loading && !error && client && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* LEFT — client summary */}
            <div className="lg:col-span-1">
              <div className="rounded-lg border border-gray-200 bg-white p-5">
                <button
                  type="button"
                  onClick={() => navigate('/upsell')}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Upsell
                </button>
                <h1 className="text-xl font-bold text-gray-900">{client.business_name || '(no business name)'}</h1>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div><span className="text-gray-400">Contact:</span> <span className="text-gray-800">{client.contact_person || '—'}</span></div>
                  <div><span className="text-gray-400">Phone:</span> <span className="text-gray-800">{client.phone || '—'}</span></div>
                  <div><span className="text-gray-400">Email:</span> <span className="text-gray-800">{client.email || '—'}</span></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {client.current_package === 'none' ? 'No Package' : client.current_package}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
                  <div><span className="text-gray-400">Monthly retainer:</span> <span className="font-medium text-gray-900">{fmtZAR(client.monthly_retainer)}/mo</span></div>
                  <div><span className="text-gray-400">Customer since:</span> <span className="text-gray-800">{fmtDate(client.customer_since)}</span></div>
                </div>
              </div>
            </div>

            {/* CENTER — product catalogue */}
            <div className="lg:col-span-1">
              <h2 className="font-semibold text-gray-900 mb-3">Add a product</h2>
              <div className="space-y-2">
                {UPSELL_PRODUCTS.map(p => {
                  const owned = ownedSet.has(p.id);
                  const amount = invoiceAmountFor(p);
                  const addable = !owned && amount > 0;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-3 ${owned ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{p.emoji ? `${p.emoji} ` : ''}{p.name}</div>
                          <div className="text-xs text-gray-500">{priceLabel(p)}</div>
                          {p.benefit && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{p.benefit}</div>}
                        </div>
                        <div className="shrink-0">
                          {owned ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                              <Check className="w-3 h-3" /> Already owned
                            </span>
                          ) : addable ? (
                            <button
                              type="button"
                              onClick={() => { setConfirmProduct(p); setSaleNote(''); }}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-600 text-white hover:brightness-110 transition"
                            >
                              Add to client
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">Add manually</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT — notes history */}
            <div className="lg:col-span-1">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <StickyNote className="w-4 h-4 text-rose-600" />
                  <h2 className="font-semibold text-gray-900">Notes</h2>
                </div>

                {notesLoading && (
                  <div className="space-y-2 mb-3">
                    {[0, 1].map(i => <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />)}
                  </div>
                )}

                {!notesLoading && notes.length === 0 && (
                  <p className="text-sm text-gray-400 mb-3">No notes yet.</p>
                )}

                {!notesLoading && notes.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-96 overflow-y-auto">
                    {notes.map(n => (
                      <div key={n.id} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {n.author_name || 'Staff'}{fmtDateTime(n.created_date) ? ` · ${fmtDateTime(n.created_date)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {!noteFormOpen && (
                  <button
                    type="button"
                    onClick={() => setNoteFormOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-rose-300 transition"
                  >
                    <Plus className="w-4 h-4" /> Add note (without sale)
                  </button>
                )}

                {noteFormOpen && (
                  <div>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Objection, callback, or anything worth recording…"
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={saveStandaloneNote}
                        disabled={savingNote || !noteText.trim()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:brightness-110 transition disabled:opacity-50"
                      >
                        {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save note
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNoteFormOpen(false); setNoteText(''); }}
                        className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Add {confirmProduct.name}?</h3>
            <p className="text-sm text-gray-600 mt-2">
              Add <strong>{confirmProduct.name}</strong> to <strong>{client?.business_name}</strong>?
              This will create a <strong>{fmtZAR(invoiceAmountFor(confirmProduct))}</strong> invoice and
              attribute the commission to you.
            </p>
            <label className="block text-xs font-medium text-gray-600 mt-4 mb-1">Note about this sale (optional)</label>
            <textarea
              value={saleNote}
              onChange={(e) => setSaleNote(e.target.value)}
              rows={3}
              placeholder="What was discussed, why they bought…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={confirmAdd}
                disabled={adding}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:brightness-110 transition disabled:opacity-50"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm and add
              </button>
              <button
                type="button"
                onClick={() => { setConfirmProduct(null); setSaleNote(''); }}
                disabled={adding}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
