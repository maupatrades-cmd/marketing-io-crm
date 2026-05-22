import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PACKAGE_COMMISSIONS, CPC_RATES, ADMIN_RATES } from '@/lib/commissionConfig';

const PACKAGES = [
  { value: 'ignite',         label: 'Ignite',         setup: 2500,  monthly: 1500 },
  { value: 'accelerate',     label: 'Accelerate',     setup: 5000,  monthly: 3000 },
  { value: 'dominate',       label: 'Dominate',       setup: 8000,  monthly: 5000 },
  { value: 'street_pulse',   label: 'Street Pulse',   setup: 1500,  monthly: 800  },
  { value: 'township_pulse', label: 'Township Pulse', setup: 1000,  monthly: 600  },
  { value: 'add_on',         label: 'Add-On',         setup: 0,     monthly: 0    },
];

/** Calculate what the assigned role earns on this deal */
function calcCommission(pkg, setupFee, monthly, role) {
  const pkgConfig = PACKAGE_COMMISSIONS[pkg];

  if (role === 'cpc') {
    // CPC earns flat lead fee + closure bonus
    return {
      lines: [
        { label: 'Qualified lead fee', amount: CPC_RATES.qualified_lead_fee },
        { label: 'Closure bonus',      amount: CPC_RATES.closure_bonus },
      ],
      total: CPC_RATES.qualified_lead_fee + CPC_RATES.closure_bonus,
      note: 'Paid when lead qualifies + deal closes.',
    };
  }

  if (role === 'admin') {
    return {
      lines: [{ label: 'Contract loaded fee', amount: ADMIN_RATES.per_contract_loaded }],
      total: ADMIN_RATES.per_contract_loaded,
      note: 'Flat R25 per contract loaded.',
    };
  }

  if (role === 'field_agent' || role === 'owner') {
    if (!pkgConfig) {
      return { lines: [{ label: 'Commission', amount: 0 }], total: 0, note: 'No commission config for this package.' };
    }

    // Flat packages (Street Pulse, Township Pulse)
    if (pkgConfig.flat_amount !== null && pkgConfig.flat_amount > 0) {
      const trigger = pkg === 'street_pulse' ? 'when first retainer clears' : 'when setup clears';
      return {
        lines: [{ label: 'Flat commission', amount: pkgConfig.flat_amount }],
        total: pkgConfig.flat_amount,
        note: `R${pkgConfig.flat_amount} flat — paid ${trigger}.`,
      };
    }

    // Percentage packages (Ignite, Accelerate, Dominate)
    const commSetup   = +(setupFee * pkgConfig.setup_rate).toFixed(2);
    const commMonthly = +(monthly  * pkgConfig.retainer_rate).toFixed(2);
    const lines = [];
    if (commSetup > 0)   lines.push({ label: `Setup (${(pkgConfig.setup_rate*100).toFixed(0)}%)`,   amount: commSetup });
    if (commMonthly > 0) lines.push({ label: `Monthly (${(pkgConfig.retainer_rate*100).toFixed(1)}%) × 12 mo`, amount: commMonthly * 12 });
    const total = commSetup + (commMonthly * 12);
    return {
      lines,
      total: +total.toFixed(2),
      note: pkgConfig.retainer_milestone_required
        ? 'Retainer commission unlocks after 5-deal milestone.'
        : 'Paid on first retainer clearance.',
    };
  }

  return { lines: [], total: 0, note: 'No commission for this role.' };
}

export default function SoldActionForm({ selected, user, onSuccess, onCancel }) {
  const [staffList, setStaffList]       = useState([]);
  const [assignedId, setAssignedId]     = useState(user?.id || '');
  const [assignedName, setAssignedName] = useState(user?.full_name || user?.email || '');
  const [assignedRole, setAssignedRole] = useState(user?.role || 'field_agent');
  const [pkg, setPkg]                   = useState('ignite');
  const [setupFee, setSetupFee]         = useState(2500);
  const [monthly, setMonthly]           = useState(1500);
  const [debitDate, setDebitDate]       = useState('1st');
  const [notes, setNotes]               = useState('');
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    base44.entities.AppUser.filter({})
      .then(rows => {
        const list = Array.isArray(rows) ? rows : [];
        const staff = list.filter(u => ['field_agent','cpc','admin','owner'].includes(u.role));
        setStaffList(staff);
        const me = staff.find(u => u.id === user?.id);
        if (me) {
          setAssignedId(me.id);
          setAssignedName(me.full_name || me.email || '');
          setAssignedRole(me.role || 'field_agent');
        }
      })
      .catch(() => {});
  }, []);

  const handlePkgChange = (val) => {
    const found = PACKAGES.find(p => p.value === val);
    if (found) { setPkg(val); setSetupFee(found.setup); setMonthly(found.monthly); }
  };

  const handleStaffChange = (userId) => {
    const found = staffList.find(u => u.id === userId);
    if (found) {
      setAssignedId(found.id);
      setAssignedName(found.full_name || found.email || '');
      setAssignedRole(found.role || 'field_agent');
    }
  };

  const comm = calcCommission(pkg, setupFee, monthly, assignedRole);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const pkgLabel = PACKAGES.find(p => p.value === pkg)?.label || pkg;

      // 1. Update client to active
      await base44.entities.Client.update(selected.id, {
        lifecycle_stage: 'active',
        status:          'active',
        signed_up_by_id: assignedId,
        ...(assignedRole === 'field_agent' ? { assigned_field_agent: assignedId } : {}),
        ...(assignedRole === 'cpc'         ? { assigned_cpc: assignedId }         : {}),
      });

      // 2. Setup invoice (skip if no setup fee)
      if (setupFee > 0) {
        await base44.entities.Invoice.create({
          client_id:    selected.id,
          client_name:  selected.business_name,
          invoice_type: 'setup_fee',
          description:  `${pkgLabel} – Setup Fee`,
          amount:       setupFee,
          total_amount: setupFee,
          status:       'draft',
          issue_date:   today,
          debit_run_date: debitDate === '1st' ? `${today.slice(0,7)}-01` : `${today.slice(0,7)}-15`,
          ...(assignedRole === 'field_agent' ? { assigned_field_agent_id: assignedId, assigned_field_agent_name: assignedName } : {}),
          ...(assignedRole === 'cpc'         ? { assigned_cpc_id: assignedId, assigned_cpc_name: assignedName } : {}),
        });
      }

      // 3. Monthly retainer invoice (skip if no monthly)
      if (monthly > 0) {
        await base44.entities.Invoice.create({
          client_id:    selected.id,
          client_name:  selected.business_name,
          invoice_type: 'monthly_retainer',
          description:  `${pkgLabel} – Monthly Retainer`,
          amount:       monthly,
          total_amount: monthly,
          status:       'draft',
          issue_date:   today,
          ...(assignedRole === 'field_agent' ? { assigned_field_agent_id: assignedId, assigned_field_agent_name: assignedName } : {}),
          ...(assignedRole === 'cpc'         ? { assigned_cpc_id: assignedId, assigned_cpc_name: assignedName } : {}),
        });
      }

      // 4. Commission record (single pending entry with correct amount)
      if (comm.total > 0) {
        const commType = assignedRole === 'cpc'   ? 'cpc_closure_bonus' :
                         assignedRole === 'admin'  ? 'admin_contract_load' :
                                                     'setup_commission';
        await base44.entities.Commission.create({
          staff_id:         assignedId,
          staff_name:       assignedName,
          staff_role:       assignedRole,
          commission_type:  commType,
          client_id:        selected.id,
          client_name:      selected.business_name,
          package_or_addon: pkgLabel,
          base_amount:      setupFee || monthly,
          commission_amount: comm.total,
          qualifying_event: 'deal_closed_won',
          qualifying_event_date: today,
          status: 'pending',
        });
      }

      // 5. Activity log
      await base44.entities.ClientActivityLog.create({
        client_id:      selected.id,
        client_name:    selected.business_name,
        actor_id:       user?.id || '',
        actor_role:     user?.role || '',
        event_type:     'sales_sold',
        event_category: 'lead',
        event_summary:  `Deal closed — ${pkgLabel} by ${assignedName}`,
        logged_by:      user?.id || '',
        logged_by_name: user?.full_name || user?.email || 'Staff',
      });

      toast.success(`${selected.business_name} closed! Invoices & commissions created.`);
      onSuccess(selected.id);
    } catch (err) {
      console.error('[SoldActionForm]', err);
      toast.error('Failed to close deal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wide bg-green-100 text-green-700">
          🎉 Close Deal
        </span>
        <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">
          ← Back
        </button>
      </div>

      <p className="text-xs font-semibold text-gray-700 truncate">{selected.business_name}</p>

      {/* Assign staff */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">Assign to Staff</label>
        <select
          value={assignedId}
          onChange={e => handleStaffChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
        >
          {staffList.length === 0 ? (
            <option value={user?.id}>{user?.full_name || user?.email || 'Me'}</option>
          ) : (
            staffList.map(s => (
              <option key={s.id} value={s.id}>
                {s.full_name || s.email} ({(s.role || '').replace(/_/g,' ')})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Package */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">Package</label>
        <select
          value={pkg}
          onChange={e => handlePkgChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
        >
          {PACKAGES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Setup + Monthly */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 font-medium mb-1">Setup Fee (R)</label>
          <input
            type="number" min={0} value={setupFee}
            onChange={e => setSetupFee(Number(e.target.value))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 font-medium mb-1">Monthly (R)</label>
          <input
            type="number" min={0} value={monthly}
            onChange={e => setMonthly(Number(e.target.value))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
      </div>

      {/* Debit order date */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">Debit Order Date</label>
        <select
          value={debitDate}
          onChange={e => setDebitDate(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
        >
          <option value="1st">1st of month</option>
          <option value="15th">15th of month</option>
        </select>
      </div>

      {/* Commission preview */}
      <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
        <p className="text-xs font-semibold text-green-800 mb-1.5">Commission Preview</p>
        {comm.lines.map((l, i) => (
          <div key={i} className="flex justify-between text-xs text-green-700 mb-0.5">
            <span>{l.label}</span>
            <span className="font-medium">R {l.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
          </div>
        ))}
        <div className="flex justify-between text-xs font-bold text-green-800 border-t border-green-200 mt-1 pt-1">
          <span>Total pending</span>
          <span>R {comm.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
        </div>
        {comm.note && <p className="text-xs text-green-600 mt-1 italic">{comm.note}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-gray-600 font-medium mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any deal notes…"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
        />
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Confirm Sale
      </button>
    </div>
  );
}