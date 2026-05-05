import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import RouteGuard from '@/components/RouteGuard';
import AllocateModal from '@/components/owner/AllocateModal';
import { UserPlus } from 'lucide-react';

function daysSince(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return '—';
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso;
  }
}

export default function LeadInbox() {
  const [leads, setLeads] = useState([]);
  const [paidByClient, setPaidByClient] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Client.filter({ lifecycle_stage: 'lead' }, '-created_date', 200).catch(() => []);
      const list = Array.isArray(all) ? all : [];
      setLeads(list);

      // Per-client successful payment lookup. Sequential to keep load light;
      // if this gets slow, batch in parallel with Promise.all.
      const paid = new Map();
      for (const c of list) {
        try {
          const payments = await base44.entities.Payment.filter({ client_id: c.id });
          const arr = Array.isArray(payments) ? payments : [];
          const ok = arr.filter(p => p.status === 'successful');
          if (ok.length > 0) {
            paid.set(c.id, ok.reduce((s, p) => s + Number(p.amount || 0), 0));
          }
        } catch (err) {
          console.error('[LeadInbox] payment lookup failed for', c.id, err);
        }
      }
      setPaidByClient(paid);
    } catch (err) {
      console.error('[LeadInbox] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <RouteGuard allowedRoles={['owner']} fallbackPath="/">
      <AppLayout title="Lead Inbox" subtitle="Allocate self-signups to Field Agents">
        <div className="space-y-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className="w-6 h-6 text-primary" />
              <div>
                <p className="text-sm text-slate-400">Triage queue</p>
                <p className="text-2xl font-bold text-white">{leads.length} lead{leads.length === 1 ? '' : 's'} waiting</p>
              </div>
            </div>
          </header>

          {loading && <p className="text-slate-400">Loading leads…</p>}

          {!loading && leads.length === 0 && (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-12 text-center">
              <p className="text-2xl">🎉</p>
              <p className="text-lg font-semibold text-white mt-2">All leads allocated</p>
              <p className="text-sm text-slate-400 mt-1">Nothing waiting in the inbox.</p>
            </div>
          )}

          {!loading && leads.length > 0 && (
            <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Business</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Signed up</th>
                    <th className="px-4 py-3 text-right">Days waiting</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {leads.map(lead => {
                    const paidTotal = paidByClient.get(lead.id) || 0;
                    return (
                      <tr key={lead.id} className="bg-slate-900/40">
                        <td className="px-4 py-3 text-white font-medium">{lead.business_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{lead.contact_person || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{lead.email || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{fmtDate(lead.created_date)}</td>
                        <td className="px-4 py-3 text-right text-slate-200">{daysSince(lead.created_date)}</td>
                        <td className="px-4 py-3">
                          {paidTotal > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-700/40 text-emerald-100 border border-emerald-500/30">
                              Paid Lead — R{paidTotal.toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-700/50 text-slate-300 border border-slate-600/40">
                              Lead
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setAllocating(lead)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-br from-purple-600 to-pink-500 hover:scale-105 transition"
                          >
                            Allocate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AllocateModal
          lead={allocating}
          isOpen={!!allocating}
          onClose={() => setAllocating(null)}
          onAllocated={load}
        />
      </AppLayout>
    </RouteGuard>
  );
}
