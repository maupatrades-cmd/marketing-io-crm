import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, UserSearch } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const PACKAGES = [
  { value: 'ignite',         label: 'Ignite',         setup: 2500,  monthly: 1500 },
  { value: 'accelerate',     label: 'Accelerate',     setup: 5000,  monthly: 3000 },
  { value: 'dominate',       label: 'Dominate',       setup: 8000,  monthly: 5000 },
  { value: 'street_pulse',   label: 'Street Pulse',   setup: 1500,  monthly: 800  },
  { value: 'township_pulse', label: 'Township Pulse', setup: 1000,  monthly: 600  },
];

// Commission rates by role
const COMMISSION_RATES = {
  field_agent: { setup: 0.10, monthly: 0.10 },
  cpc:         { setup: 0.05, monthly: 0.05 },
  admin:       { setup: 0.03, monthly: 0.03 },
  owner:       { setup: 0.00, monthly: 0.00 },
};

function calcCommission(role, setup, monthly) {
  const rates = COMMISSION_RATES[role] || { setup: 0, monthly: 0 };
  return {
    onSetup:   +(setup * rates.setup).toFixed(2),
    onMonthly: +(monthly * rates.monthly).toFixed(2),
  };
}

export default function SoldActionForm({ selected, user, onSuccess, onCancel }) {
  const [staffList, setStaffList]     = useState([]);
  const [assignedId, setAssignedId]   = useState(user?.id || '');
  const [assignedName, setAssignedName] = useState(user?.full_name || user?.email || '');
  const [assignedRole, setAssignedRole] = useState(user?.role || 'field_agent');
  const [pkg, setPkg]                 = useState(PACKAGES[0].value);
  const [setupFee, setSetupFee]       = useState(PACKAGES[0].setup);
  const [monthly, setMonthly]         = useState(PACKAGES[0].monthly);
  const [debitDate, setDebitDate]     = useState('1st');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    base44.entities.AppUser
      .filter({})
      .then(rows => {
        const list = Array.isArray(rows) ? rows : [];
        setStaffList(list.filter(u => ['field_agent','cpc','admin','owner'].includes(u.role)));
      })
      .catch(() => {});
  }, []);

  const handlePkgChange = (val) => {
    const found = PACKAGES.find(p => p.value === val);
    if (found) {
      setPkg(val);
      setSetupFee(found.setup);
      setMonthly(found.monthly);
    }
  };

  const handleStaffChange = (userId) => {
    const found = staffList.find(u => u.id === userId);
    if (found) {
      setAssignedId(found.id);
      setAssignedName(found.full_name || found.email || '');
      setAssignedRole(found.role || 'field_agent');
    }
  };

  const commission = calcCommission(assignedRole, setupFee, monthly);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Update client to active
      const clientPatch = {
        lifecycle_stage:      'active',
        status:               'active',
        signed_up_by_id:      assignedId,
        assigned_field_agent: assignedRole === 'field_agent' ? assignedId : undefined,
        assigned_cpc:         assignedRole === 'cpc' ? assignedId : undefined,
      };
      await base44.entities.Client.update(selected.id, clientPatch);

      // 2. Create setup invoice
      await base44.entities.Invoice.create({
        client_id:                  selected.id,
        client_name:                selected.business_name,
        invoice_type:               'setup_fee',
        description:                `${PACKAGES.find(p => p.value === pkg)?.label} – Setup Fee`,
        amount:                     setupFee,
        total_amount:               setupFee,
        status:                     'draft',
        issue_date:                 today,
        assigned_field_agent_id:    assignedRole === 'field_agent' ? assignedId : undefined,
        assigned_field_agent_name:  assignedRole === 'field_agent' ? assignedName : undefined,
        assigned_cpc_id:            assignedRole === 'cpc' ? assignedId : undefined,
        assigned_cpc_name:          assignedRole === 'cpc' ? assignedName : undefined,
      });

      // 3. Create monthly retainer invoice
      await base44.entities.Invoice.create({
        client_id:                  selected.id,
        client_name:                selected.business_name,
        invoice_type:               'monthly_retainer',
        description:                `${PACKAGES.find(p => p.value === pkg)?.label} – Monthly Retainer`,
        amount:                     monthly,
        total_amount:               monthly,
        status:                     'draft',
        issue_date:                 today,
        assigned_field_agent_id:    assignedRole === 'field_agent' ? assignedId : undefined,
        assigned_field_agent_name:  assignedRole === 'field_agent' ? assignedName : undefined,
        assigned_cpc_id:            assignedRole === 'cpc' ? assignedId : undefined,
        assigned_cpc_name:          assignedRole === 'cpc' ? assignedName : undefined,
      });

      // 4. Create pending commissions (if applicable)
      if (commission.onSetup > 0) {
        await base44.entities.Commission.create({
          staff_id:           assignedId,
          staff_name:         assignedName,
          staff_role:         assignedRole,
          commission_type:    'setup_commission',
          client_id:          selected.id,
          client_name:        selected.business_name,
          package_or_addon:   pkg,
          base_amount:        setupFee,
          rate_percent:       (COMMISSION_RATES[assignedRole]?.setup || 0) * 100,
          commission_amount:  commission.onSetup,
          qualifying_event:   'deal_closed_won',
          qualifying_event_date: today,
          status:             'pending',
          notes:              notes.trim() || undefined,
        });
      }
      if (commission.onMonthly > 0) {
        await base44.entities.Commission.create({
          staff_id:           assignedId,
          staff_name:         assignedName,
          staff_role:         assignedRole,
          commission_type:    'retainer_commission',
          client_id:          selected.id,
          client_name:        selected.business_name,
          package_or_addon:   pkg,
          base_amount:        monthly,
          rate_percent:       (COMMISSION_RATES[assignedRole]?.monthly || 0) * 100,
          commission_amount:  commission.onMonthly,
          qualifying_event:   'deal_closed_won',
          qualifying_event_date: today,
          status:             'pending',
          notes:              notes.trim() || undefined,
        });
      }

      // 5. Log activity
      await base44.entities.ClientActivityLog.create({
        client_id:      selected.id,
        client_name:    selected.business_name,
        actor_id:       user?.id || '',
        actor_role:     user?.role || '',
        event_type:     'sales_sold',
        event_category: 'lead',
        event_summary:  `Deal closed — ${pkg} package by ${assignedName}`,
        logged_by:      user?.id || '',
        logged_by_name: user?.full_name || user?.email || 'Staff',
      });

      toast.success(`${selected.business_name} marked as SOLD! Invoices & commissions created.`);
      onSuccess(selected.id);
    } catch (err) {
      console.error('[SoldActionForm] confirm failed:', err);
      toast.error('Failed to close deal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wide bg-green-100 text-green-700">
          🎉 Close Deal
        </span>
        <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
      </div>

      <p className="text-xs font-semibold text-gray-700 truncate">{selected.business_name}</p>

      {/* Assign staff */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">
          <UserSearch className="inline w-3 h-3 mr-1" />Assign to Staff
        </label>
        <select value={assignedId} onChange={e => handleStaffChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
          {staffList.length === 0 && (
            <option value={user?.id}>{user?.full_name || user?.email || 'Me'} (me)</option>
          )}
          {staffList.map(s => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.email} ({s.role?.replace(/_/g,' ')})
            </option>
          ))}
        </select>
      </div>

      {/* Package */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">Package</label>
        <select value={pkg} onChange={e => handlePkgChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
          {PACKAGES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Fees */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 font-medium mb-1">Setup Fee (R)</label>
          <input type="number" value={setupFee} onChange={e => setSetupFee(+e.target.value)} min={0}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 font-medium mb-1">Monthly (R)</label>
          <input type="number" value={monthly} onChange={e => setMonthly(+e.target.value)} min={0}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300" />
        </div>
      </div>

      {/* Debit date */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">Debit Order Date</label>
        <select value={debitDate} onChange={e => setDebitDate(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
          <option value="1st">1st of month</option>
          <option value="15th">15th of month</option>
        </select>
      </div>

      {/* Commission preview */}
      {(commission.onSetup > 0 || commission.onMonthly > 0) && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <p className="text-xs font-semibold text-green-800 mb-1">Commission Preview</p>
          <div className="flex justify-between text-xs text-green-700">
            <span>On setup fee</span>
            <span className="font-medium">R {commission.onSetup.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-green-700">
            <span>On monthly retainer</span>
            <span className="font-medium">R {commission.onMonthly.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-green-800 border-t border-green-200 mt-1 pt-1">
            <span>Total pending</span>
            <span>R {(commission.onSetup + commission.onMonthly).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Any deal notes…" rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none" />
      </div>

      <button type="button" onClick={handleConfirm} disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-green-600 text-white hover:brightness-110 transition disabled:opacity-50">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Confirm Sale
      </button>
    </div>
  );
}