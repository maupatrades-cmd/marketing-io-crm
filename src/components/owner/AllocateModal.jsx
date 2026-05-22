import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { X, AlertCircle, Check, UserCheck, UserX } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useEscapeKey } from '@/lib/useEscapeKey';

const ALLOCATION_WINDOW_DAYS = 7;

function fmtZAR(n) {
  return `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AllocateModal({ lead, isOpen, onClose, onAllocated }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [paidAggregate, setPaidAggregate] = useState({ totalPaid: 0, recentInvoiceIds: [] });
  const [working, setWorking] = useState(false);

  // Close on Escape (only when open and not mid-action).
  useEscapeKey(isOpen && !working, onClose);

  useEffect(() => {
    if (!isOpen || !lead) return;
    let cancelled = false;
    (async () => {
      try {
        const users = await base44.entities.User.filter({});
        const list = Array.isArray(users) ? users : [];
        const eligible = list.filter(u => u.role === 'field_agent' || u.role === 'cpc');
        if (!cancelled) setAgents(eligible);
      } catch (err) {
        console.error('[AllocateModal] users load failed:', err);
      }

      try {
        const payments = await base44.entities.Payment.filter({ client_id: lead.id });
        const arr = Array.isArray(payments) ? payments : [];
        const successful = arr.filter(p => p.status === 'successful');
        const totalPaid = successful.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        const cutoffMs = Date.now() - ALLOCATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const recentInvoiceIds = successful
          .filter(p => {
            const t = p.completed_at ? new Date(p.completed_at).getTime() : NaN;
            return t && !isNaN(t) && t >= cutoffMs;
          })
          .map(p => p.invoice_id)
          .filter(Boolean);

        if (!cancelled) setPaidAggregate({ totalPaid, recentInvoiceIds });
      } catch (err) {
        console.error('[AllocateModal] payments load failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, lead]);

  const reassignmentEligible = useMemo(
    () => paidAggregate.recentInvoiceIds.length > 0,
    [paidAggregate]
  );

  if (!isOpen || !lead) return null;

  const finish = (label) => {
    toast.success(label);
    onAllocated?.();
    onClose();
  };

  const handleKeepWithOwner = async () => {
    setWorking(true);
    try {
      await base44.entities.Client.update(lead.id, {
        lifecycle_stage: 'qualified'
      });
      finish(`Kept ${lead.business_name} with Owner`);
    } catch (err) {
      console.error('[AllocateModal] keep-with-owner failed:', err);
      toast.error('Could not update lead. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleAllocateToAgent = async () => {
    if (!selectedAgentId) {
      toast.error('Pick a Field Agent first.');
      return;
    }
    setWorking(true);
    try {
      await base44.entities.Client.update(lead.id, {
        assigned_consultant_id: selectedAgentId,
        assigned_field_agent: selectedAgentId,
        lifecycle_stage: 'qualified'
      });

      if (reassignmentEligible) {
        try {
          const res = await base44.functions.invoke('update-commission-attribution', {
            client_id: lead.id,
            new_closer_id: selectedAgentId,
            token: localStorage.getItem('mio_session_token')
          });
          const count = res?.count_reassigned ?? res?.data?.count_reassigned ?? 0;
          if (count > 0) {
            toast.success(`Reassigned ${count} commission${count === 1 ? '' : 's'} to the Field Agent.`);
          }
        } catch (err) {
          console.error('[AllocateModal] commission reattribution failed:', err);
          toast.error('Allocated, but commission reassignment failed. Check the Commission log.');
        }
      }

      const agent = agents.find(a => a.id === selectedAgentId);
      finish(`Allocated to ${agent?.full_name || agent?.name || 'Field Agent'}`);
    } catch (err) {
      console.error('[AllocateModal] allocate-to-agent failed:', err);
      toast.error('Could not allocate. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleDisqualify = async () => {
    setWorking(true);
    try {
      await base44.entities.Client.update(lead.id, {
        lifecycle_stage: 'disqualified'
      });
      finish(`Marked ${lead.business_name} as not interested`);
    } catch (err) {
      console.error('[AllocateModal] disqualify failed:', err);
      toast.error('Could not update lead. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !working) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-white">Allocate {lead.business_name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {paidAggregate.totalPaid > 0 && (
            <div className="rounded-xl p-4 border border-amber-500/40 bg-amber-950/20 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-100">
                <p className="font-semibold">This lead has paid {fmtZAR(paidAggregate.totalPaid)}.</p>
                <p className="mt-1 text-amber-200/90">
                  Commission is currently attributed to Owner. {reassignmentEligible
                    ? `${paidAggregate.recentInvoiceIds.length} payment${paidAggregate.recentInvoiceIds.length === 1 ? ' is' : 's are'} within the 7-day window — allocating to a Field Agent will reassign their pending commissions.`
                    : 'No payments are within the 7-day window — past commissions stay with Owner.'}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleKeepWithOwner}
            disabled={working}
            className="w-full text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-primary rounded-xl p-4 transition disabled:opacity-60"
          >
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Keep with Owner (default)</p>
                <p className="text-xs text-slate-400 mt-1">
                  Marks the lead qualified. Commission stays with Owner.
                </p>
              </div>
            </div>
          </button>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Allocate to Field Agent</p>
                <p className="text-xs text-slate-400 mt-1">
                  Assigns the consultant. {reassignmentEligible && 'Commission for recent payments will be reassigned automatically.'}
                </p>
              </div>
            </div>
            <select
              value={selectedAgentId}
              onChange={e => setSelectedAgentId(e.target.value)}
              disabled={working}
              className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">— Pick a Field Agent / CPC —</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.name || a.email} ({a.role})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAllocateToAgent}
              disabled={working || !selectedAgentId}
              className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-emerald-600 to-emerald-500 disabled:opacity-50 transition"
            >
              {working ? 'Allocating…' : 'Allocate'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDisqualify}
            disabled={working}
            className="w-full text-left bg-slate-800/60 hover:bg-rose-950/30 border border-slate-700/50 hover:border-rose-500/50 rounded-xl p-4 transition disabled:opacity-60"
          >
            <div className="flex items-start gap-3">
              <UserX className="w-5 h-5 text-rose-400 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Mark as not interested</p>
                <p className="text-xs text-slate-400 mt-1">
                  Sets lifecycle to disqualified. Lead disappears from the queue.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
