import { base44 } from '@/api/base44Client';

// Get the current period based on target_period
export function getPeriodDates(period, referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const week = Math.floor(date.getDate() / 7);

  switch (period) {
    case 'daily': {
      const start = new Date(year, month, date.getDate());
      const end = new Date(year, month, date.getDate(), 23, 59, 59);
      return { start, end };
    }
    case 'weekly': {
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek;
      const start = new Date(year, month, diff);
      const end = new Date(year, month, diff + 6, 23, 59, 59);
      return { start, end };
    }
    case 'monthly': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case 'quarterly': {
      const quarter = Math.floor(month / 3);
      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, (quarter + 1) * 3, 0, 23, 59, 59);
      return { start, end };
    }
    default:
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
  }
}

// Calculate actual value for a given metric
export async function calculateMetricValue(metric_code, user_id, target_period) {
  try {
    const { start, end } = getPeriodDates(target_period);

    switch (metric_code) {
      // FIELD AGENT METRICS
      case 'new_deals_closed': {
        const deals = await base44.entities.Deal.filter({
          closer_id: user_id,
          stage: 'closed_won'
        });
        return deals.filter(d => {
          const closeDate = new Date(d.client_onboarded_date || d.updated_date || d.created_date);
          return closeDate >= start && closeDate <= end;
        }).length;
      }

      case 'discovery_visits': {
        const tasks = await base44.entities.Task.filter({
          assigned_to: user_id,
          status: 'done'
        });
        return tasks.filter(t => {
          const completedDate = new Date(t.completed_at);
          return t.title.toLowerCase().includes('discovery') &&
                 completedDate >= start &&
                 completedDate <= end;
        }).length;
      }

      case 'pipeline_value_zar': {
        const deals = await base44.entities.Deal.filter({
          closer_id: user_id
        });
        return deals
          .filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
          .reduce((sum, d) => sum + (d.setup_fee || 0) + (d.monthly_retainer || 0) * 6, 0);
      }

      case 'crm_data_quality_pct': {
        // Estimate: 100% if user has logged activity, else 0%
        const activities = await base44.entities.Task.filter({
          assigned_to: user_id
        });
        return activities.length > 0 ? 100 : 0;
      }

      case 'addon_upsells_existing': {
        const deals = await base44.entities.Deal.filter({
          closer_id: user_id,
          deal_type: 'add_on',
          stage: 'closed_won'
        });
        return deals.filter(d => {
          const closeDate = new Date(d.client_onboarded_date || d.updated_date);
          return closeDate >= start && closeDate <= end;
        }).length;
      }

      case 'response_time_hours': {
        // Estimate based on task creation to completion
        const tasks = await base44.entities.Task.filter({
          assigned_to: user_id
        });
        if (tasks.length === 0) return 0;
        const avgHours = tasks.reduce((sum, t) => {
          if (t.completed_at && t.created_date) {
            const diff = new Date(t.completed_at) - new Date(t.created_date);
            return sum + (diff / (1000 * 60 * 60));
          }
          return sum;
        }, 0) / tasks.length;
        return Math.round(avgHours);
      }

      case 'daily_visits_or_touchpoints': {
        // Count tasks with "visit" or "touchpoint" in title
        const today = new Date();
        const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const tasks = await base44.entities.Task.filter({
          assigned_to: user_id
        });
        return tasks.filter(t => {
          const createdDate = new Date(t.created_date);
          const titleLower = t.title.toLowerCase();
          return (titleLower.includes('visit') || titleLower.includes('touchpoint')) &&
                 createdDate >= dayStart &&
                 createdDate < dayEnd;
        }).length;
      }

      case 'weekly_proposals_sent': {
        const deals = await base44.entities.Deal.filter({
          closer_id: user_id
        });
        return deals.filter(d => {
          const createDate = new Date(d.created_date);
          return d.stage === 'proposal_sent' &&
                 createDate >= start &&
                 createDate <= end;
        }).length;
      }

      // CPC METRICS
      case 'qualified_leads_per_month': {
        const leads = await base44.entities.Lead.filter({
          created_by: user_id
        });
        return leads.filter(l => {
          const createDate = new Date(l.created_date);
          return l.status === 'qualified' &&
                 createDate >= start &&
                 createDate <= end;
        }).length;
      }

      case 'closure_conversion_rate_pct': {
        const deals = await base44.entities.Deal.filter({
          closer_id: user_id
        });
        const closedWon = deals.filter(d => {
          const closeDate = new Date(d.client_onboarded_date || d.updated_date);
          return d.stage === 'closed_won' &&
                 closeDate >= start &&
                 closeDate <= end;
        }).length;
        const total = deals.filter(d => {
          const createDate = new Date(d.created_date);
          return createDate >= start && createDate <= end;
        }).length;
        return total > 0 ? Math.round((closedWon / total) * 100) : 0;
      }

      case 'daily_call_volume': {
        // Estimate based on task count with "call" in title
        const today = new Date();
        const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const tasks = await base44.entities.Task.filter({
          assigned_to: user_id
        });
        return tasks.filter(t => {
          const createdDate = new Date(t.created_date);
          return t.title.toLowerCase().includes('call') &&
                 createdDate >= dayStart &&
                 createdDate < dayEnd;
        }).length;
      }

      case 'existing_client_check_ins': {
        const tasks = await base44.entities.Task.filter({
          assigned_to: user_id,
          status: 'done'
        });
        return tasks.filter(t => {
          const completedDate = new Date(t.completed_at);
          return t.title.toLowerCase().includes('check-in') &&
                 completedDate >= start &&
                 completedDate <= end;
        }).length;
      }

      case 'upsells_to_existing': {
        const deals = await base44.entities.Deal.filter({
          closer_id: user_id,
          deal_type: 'add_on',
          stage: 'closed_won'
        });
        return deals.filter(d => {
          const closeDate = new Date(d.client_onboarded_date || d.updated_date);
          return closeDate >= start && closeDate <= end;
        }).length;
      }

      case 'cpc_response_time_hours':
        return 4; // Placeholder

      case 'cpc_crm_data_quality_pct':
        return 100; // Placeholder

      case 'criteria_qualification_pct':
        return 100; // Placeholder

      // ADMIN METRICS
      case 'contracts_loaded_per_week': {
        const contracts = await base44.entities.Contract.filter({
          loaded_by_admin: user_id
        });
        return contracts.filter(c => {
          const loadDate = new Date(c.loaded_date);
          return loadDate >= start && loadDate <= end;
        }).length;
      }

      case 'onboarding_form_followup_within_days': {
        // Average days to first followup
        const submissions = await base44.entities.ClientOnboardingSubmission.list();
        if (submissions.length === 0) return 0;
        return Math.round(submissions.reduce((sum, s) => {
          if (s.submitted_at) {
            const diff = (new Date() - new Date(s.submitted_at)) / (1000 * 60 * 60 * 24);
            return sum + Math.min(diff, 30);
          }
          return sum;
        }, 0) / submissions.length);
      }

      case 'onboarding_form_completion_rate_pct': {
        const submissions = await base44.entities.ClientOnboardingSubmission.list();
        const completed = submissions.filter(s => s.submission_status === 'submitted' || s.submission_status === 'reviewed').length;
        return submissions.length > 0 ? Math.round((completed / submissions.length) * 100) : 0;
      }

      case 'failed_debit_followup_within_hours':
        return 24; // Placeholder

      case 'monthly_invoice_dispatch_by':
        return 1; // Placeholder

      case 'monthly_report_dispatch_by':
        return 5; // Placeholder

      // OWNER METRICS
      case 'monthly_revenue_zar': {
        const invoices = await base44.entities.Invoice.filter({});
        return invoices
          .filter(inv => {
            const paidDate = new Date(inv.paid_date);
            return inv.status === 'paid' && paidDate >= start && paidDate <= end;
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);
      }

      case 'new_clients_signed_per_month': {
        const deals = await base44.entities.Deal.filter({
          stage: 'closed_won'
        });
        return deals.filter(d => {
          const closeDate = new Date(d.client_onboarded_date || d.updated_date);
          return closeDate >= start && closeDate <= end;
        }).length;
      }

      case 'overall_retention_rate_pct': {
        const clients = await base44.entities.Client.list();
        const active = clients.filter(c => c.status === 'active').length;
        return clients.length > 0 ? Math.round((active / clients.length) * 100) : 0;
      }

      case 'staff_satisfaction_score':
        return 8; // Placeholder

      case 'pipeline_health_zar': {
        const deals = await base44.entities.Deal.filter({});
        return deals
          .filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
          .reduce((sum, d) => sum + (d.setup_fee || 0) + (d.monthly_retainer || 0) * 6, 0);
      }

      // HEAD OF TECH METRICS
      case 'bucket_b_setup_within_sla_pct': {
        const deliverables = await base44.entities.Deliverable.filter({
          product: /bucket_b/i
        });
        const onTime = deliverables.filter(d => {
          if (d.approved_date && d.soft_sla_days) {
            const diffDays = (new Date(d.approved_date) - new Date(d.created_date)) / (1000 * 60 * 60 * 24);
            return diffDays <= d.soft_sla_days;
          }
          return false;
        }).length;
        return deliverables.length > 0 ? Math.round((onTime / deliverables.length) * 100) : 0;
      }

      case 'website_uptime_pct':
        return 99; // Placeholder - would come from monitoring service

      case 'avg_setup_time_days': {
        const deliverables = await base44.entities.Deliverable.filter({
          phase: 'setup'
        });
        const avgDays = deliverables.reduce((sum, d) => {
          if (d.approved_date && d.created_date) {
            const diff = (new Date(d.approved_date) - new Date(d.created_date)) / (1000 * 60 * 60 * 24);
            return sum + diff;
          }
          return sum;
        }, 0) / (deliverables.length || 1);
        return Math.round(avgDays);
      }

      case 'bug_tickets_resolved_within_days': {
        // Placeholder - would come from ticket system
        return 3;
      }

      case 'ai_chatbot_active_clients': {
        const addOns = await base44.entities.ClientAddOn.filter({
          add_on: 'ai_chatbot',
          status: 'active'
        });
        return addOns.length;
      }

      // DRIVER METRICS
      case 'photo_evidence_upload_rate_pct':
        return 100; // Placeholder

      case 'on_time_arrival_rate_pct':
        return 95; // Placeholder

      default:
        return 0;
    }
  } catch (error) {
    console.error(`Error calculating ${metric_code}:`, error);
    return 0;
  }
}

// Get KPI status badge
export function getKPIStatus(actual, target, direction) {
  if (direction === 'minimum') {
    if (actual >= target) return { status: 'on_track', color: 'text-success', bg: 'bg-success/10' };
    if (actual >= target * 0.5) return { status: 'at_risk', color: 'text-warning', bg: 'bg-warning/10' };
    return { status: 'below_target', color: 'text-destructive', bg: 'bg-destructive/10' };
  } else {
    if (actual <= target) return { status: 'on_track', color: 'text-success', bg: 'bg-success/10' };
    if (actual <= target * 1.5) return { status: 'at_risk', color: 'text-warning', bg: 'bg-warning/10' };
    return { status: 'above_target', color: 'text-destructive', bg: 'bg-destructive/10' };
  }
}

// Calculate progress percentage
export function getProgressPercentage(actual, target, direction) {
  if (direction === 'minimum') {
    return Math.min(100, Math.round((actual / target) * 100));
  } else {
    return Math.max(0, 100 - Math.round(((actual - target) / target) * 100));
  }
}