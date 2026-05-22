import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { getProductById } from '@/data/ProductCatalog';

const PACKAGE_META = {
  ignite:         { label: 'Ignite',         cls: 'bg-blue-100 text-blue-700' },
  accelerate:     { label: 'Accelerate',     cls: 'bg-violet-100 text-violet-700' },
  dominate:       { label: 'Dominate',       cls: 'bg-amber-100 text-amber-700' },
  street_pulse:   { label: 'Street Pulse',   cls: 'bg-emerald-100 text-emerald-700' },
  township_pulse: { label: 'Township Pulse', cls: 'bg-teal-100 text-teal-700' },
  none:           { label: 'No Package',     cls: 'bg-slate-200 text-slate-600' },
};

const FILTERS = [
  ['all', 'All'],
  ['ignite', 'Ignite'],
  ['accelerate', 'Accelerate'],
  ['dominate', 'Dominate'],
  ['street_pulse', 'Street Pulse'],
  ['township_pulse', 'Township Pulse'],
];

function fmtZAR(n) {
  return `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function addonLabel(slug) {
  return getProductById(slug)?.name || slug.replace(/_/g, ' ');
}

export default function Upsell() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await base44.functions.invoke('list-upsell-clients', {
          token: localStorage.getItem('mio_session_token'),
        });
        const data = res?.data ?? res;
        if (cancelled) return;
        setClients(Array.isArray(data?.clients) ? data.clients : []);
      } catch (err) {
        console.error('[Upsell] load failed:', err);
        if (!cancelled) setError('Could not load upsell clients. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = { all: clients.length };
  for (const [key] of FILTERS) {
    if (key !== 'all') counts[key] = clients.filter(c => c.current_package === key).length;
  }
  const filtered = filter === 'all' ? clients : clients.filter(c => c.current_package === filter);

  return (
    <AppLayout title="Upsell" subtitle="Active clients ready to grow">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-rose-600">Upsell</h1>
        <p className="text-sm text-gray-500 mb-5">Active clients ready to grow</p>

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

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center">
            <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No active clients to upsell yet.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {filtered.map(c => {
              const pkg = PACKAGE_META[c.current_package] || PACKAGE_META.none;
              const lastContact = fmtDate(c.last_contact_at);
              return (
                <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{c.business_name || '(no business name)'}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {c.contact_person || '—'}{c.phone ? ` · ${c.phone}` : ''}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pkg.cls}`}>{pkg.label}</span>
                      {(c.addons_owned || []).map(slug => (
                        <span key={slug} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                          {addonLabel(slug)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="text-sm font-medium text-gray-900">{fmtZAR(c.monthly_retainer)}/mo</div>
                    <div className="text-xs text-gray-400">Since {fmtDate(c.customer_since) || '—'}</div>
                    <div className="text-xs">
                      {lastContact
                        ? <span className="text-gray-500">Last contact: {lastContact}</span>
                        : <span className="text-orange-600 font-medium">Never contacted</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/upsell/${c.id}`)}
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
    </AppLayout>
  );
}
