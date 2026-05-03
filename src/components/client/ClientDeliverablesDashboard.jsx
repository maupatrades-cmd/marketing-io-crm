import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Clock, AlertCircle, FileCheck, Loader2 } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';

export default function ClientDeliverablesDashboard({ clientId }) {
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOff, setSigningOff] = useState({});

  useEffect(() => {
    fetchDeliverables();
  }, [clientId]);

  const fetchDeliverables = async () => {
    try {
      setLoading(true);
      const res = await base44.entities.Deliverable.filter({ client_id: clientId });
      setDeliverables(res || []);
    } catch (err) {
      setError('Failed to load deliverables');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOff = async (deliverable) => {
    setSigningOff(prev => ({ ...prev, [deliverable.id]: true }));
    try {
      await base44.entities.Deliverable.update(deliverable.id, {
        status: 'approved',
        approved_date: new Date().toISOString().split('T')[0]
      });
      setDeliverables(prev =>
        prev.map(d =>
          d.id === deliverable.id
            ? { ...d, status: 'approved', approved_date: new Date().toISOString().split('T')[0] }
            : d
        )
      );
    } catch (err) {
      console.error('Sign-off failed:', err);
    } finally {
      setSigningOff(prev => ({ ...prev, [deliverable.id]: false }));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      approved: 'bg-green-500/10 border-green-500/30 text-green-400',
      completed: 'bg-green-500/10 border-green-500/30 text-green-400',
      client_reviewing: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      awaiting_client: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
      in_progress: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
      not_started: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
      blocked: 'bg-red-500/10 border-red-500/30 text-red-400',
      deemed_approved: 'bg-green-500/10 border-green-500/30 text-green-400',
    };
    return colors[status] || colors.not_started;
  };

  const getStatusIcon = (status) => {
    const icons = {
      approved: <CheckCircle2 className="w-4 h-4" />,
      completed: <CheckCircle2 className="w-4 h-4" />,
      client_reviewing: <Clock className="w-4 h-4" />,
      awaiting_client: <AlertCircle className="w-4 h-4" />,
      in_progress: <Loader2 className="w-4 h-4 animate-spin" />,
      deemed_approved: <CheckCircle2 className="w-4 h-4" />,
      blocked: <AlertCircle className="w-4 h-4" />,
    };
    return icons[status] || <Clock className="w-4 h-4" />;
  };

  const getProgressValue = (status) => {
    const progress = {
      not_started: 0,
      in_progress: 40,
      awaiting_client: 70,
      client_reviewing: 80,
      approved: 100,
      completed: 100,
      deemed_approved: 100,
      blocked: 50,
    };
    return progress[status] || 0;
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    return differenceInDays(new Date(dueDate), new Date());
  };

  const getSLAStatus = (dueDate) => {
    if (!dueDate) return null;
    const days = getDaysUntilDue(dueDate);
    if (days < 0) return { label: 'Overdue', color: 'text-red-400' };
    if (days <= 3) return { label: `${days} days left`, color: 'text-yellow-400' };
    return { label: `${days} days left`, color: 'text-green-400' };
  };

  const groupByPhase = () => {
    const phases = { setup: [], monthly_recurring: [], once_off: [] };
    deliverables.forEach(d => {
      if (phases[d.phase]) phases[d.phase].push(d);
    });
    return phases;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4">
        {error}
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <div className="text-center p-12">
        <FileCheck className="w-12 h-12 mx-auto text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Deliverables Yet</h3>
        <p className="text-slate-500">Once your project starts, deliverables will appear here.</p>
      </div>
    );
  }

  const phases = groupByPhase();

  return (
    <div className="space-y-8">
      {/* Setup Phase */}
      {phases.setup.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            Setup Deliverables
          </h3>
          <div className="grid gap-4">
            {phases.setup.map(d => (
              <DeliverableCard
                key={d.id}
                deliverable={d}
                onSignOff={handleSignOff}
                isSigningOff={signingOff[d.id]}
                getSLAStatus={getSLAStatus}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getProgressValue={getProgressValue}
              />
            ))}
          </div>
        </div>
      )}

      {/* Monthly Recurring Phase */}
      {phases.monthly_recurring.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
            Monthly Deliverables
          </h3>
          <div className="grid gap-4">
            {phases.monthly_recurring.map(d => (
              <DeliverableCard
                key={d.id}
                deliverable={d}
                onSignOff={handleSignOff}
                isSigningOff={signingOff[d.id]}
                getSLAStatus={getSLAStatus}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getProgressValue={getProgressValue}
              />
            ))}
          </div>
        </div>
      )}

      {/* Once-Off Phase */}
      {phases.once_off.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-chart-3"></span>
            One-Off Deliverables
          </h3>
          <div className="grid gap-4">
            {phases.once_off.map(d => (
              <DeliverableCard
                key={d.id}
                deliverable={d}
                onSignOff={handleSignOff}
                isSigningOff={signingOff[d.id]}
                getSLAStatus={getSLAStatus}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getProgressValue={getProgressValue}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeliverableCard({
  deliverable,
  onSignOff,
  isSigningOff,
  getSLAStatus,
  getStatusColor,
  getStatusIcon,
  getProgressValue,
}) {
  const slaStatus = getSLAStatus(deliverable.due_date);
  const progress = getProgressValue(deliverable.status);
  const isApproved = deliverable.status === 'approved' || deliverable.status === 'completed' || deliverable.status === 'deemed_approved';
  const canSignOff = deliverable.status === 'awaiting_client' || deliverable.status === 'client_reviewing';

  return (
    <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 hover:bg-slate-800/60 transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${getStatusColor(deliverable.status)}`}>
              {getStatusIcon(deliverable.status)}
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{deliverable.title}</h4>
              <p className="text-xs text-muted-foreground">{deliverable.product}</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-2">{deliverable.notes}</p>
        </div>
        {slaStatus && (
          <div className={`text-xs font-semibold whitespace-nowrap ml-4 ${slaStatus.color}`}>
            {slaStatus.label}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground capitalize">
            {deliverable.status.replace(/_/g, ' ')}
          </span>
          <span className="text-xs font-semibold text-primary">{progress}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary to-accent h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Details and Action */}
      <div className="flex items-end justify-between">
        <div className="text-xs text-muted-foreground space-y-1">
          {deliverable.due_date && (
            <div>Due: {format(new Date(deliverable.due_date), 'MMM dd, yyyy')}</div>
          )}
          {deliverable.submitted_date && (
            <div>Submitted: {format(new Date(deliverable.submitted_date), 'MMM dd, yyyy')}</div>
          )}
          {isApproved && deliverable.approved_date && (
            <div className="text-green-400">
              Approved: {format(new Date(deliverable.approved_date), 'MMM dd, yyyy')}
            </div>
          )}
        </div>

        {canSignOff && (
          <button
            onClick={() => onSignOff(deliverable)}
            disabled={isSigningOff}
            className="ml-4 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg font-medium text-sm transition flex items-center gap-2"
          >
            {isSigningOff ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </>
            )}
          </button>
        )}

        {isApproved && (
          <div className="ml-4 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Approved
          </div>
        )}
      </div>
    </div>
  );
}