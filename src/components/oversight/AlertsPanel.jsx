import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";

export default function AlertsPanel({ data }) {
  const { tasks, onboardings, invoices, leads, users } = data;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const alerts = [];

  // Overdue tasks > 3 days
  const seriouslyOverdue = tasks.filter(t =>
    (t.status === "open" || t.status === "in_progress") &&
    t.due_date &&
    differenceInDays(now, parseISO(t.due_date)) > 3
  );
  if (seriouslyOverdue.length > 0) {
    alerts.push({
      id: "overdue_tasks",
      severity: "high",
      message: `${seriouslyOverdue.length} task${seriouslyOverdue.length > 1 ? "s are" : " is"} more than 3 days overdue and need${seriouslyOverdue.length === 1 ? "s" : ""} attention`,
      link: "/tasks",
      linkLabel: "View tasks",
    });
  }

  // Onboardings stuck in same phase > 7 days
  const stuckOnboardings = onboardings.filter(o => {
    if (o.overall_status === "completed") return false;
    const ref = o.p5_completed_at || o.p4_completed_at || o.p3_completed_at || o.p2_completed_at || o.deal_won_date;
    if (!ref) return false;
    return differenceInDays(now, parseISO(ref)) > 7;
  });
  if (stuckOnboardings.length > 0) {
    alerts.push({
      id: "stuck_onboardings",
      severity: "medium",
      message: `${stuckOnboardings.length} client onboarding${stuckOnboardings.length > 1 ? "s have" : " has"} been in the same phase for over 7 days`,
      link: "/onboarding",
      linkLabel: "View onboardings",
    });
  }

  // Failed debit orders not followed up (invoices with status "failed" older than 24h)
  const unfollowedDebits = invoices.filter(inv => {
    if (inv.status !== "failed") return false;
    if (!inv.last_failed_date) return false;
    return differenceInDays(now, parseISO(inv.last_failed_date)) >= 1;
  });
  if (unfollowedDebits.length > 0) {
    alerts.push({
      id: "failed_debits",
      severity: "high",
      message: `${unfollowedDebits.length} failed debit order${unfollowedDebits.length > 1 ? "s" : ""} ${unfollowedDebits.length > 1 ? "haven't" : "hasn't"} been followed up within 24 hours`,
      link: "/invoices",
      linkLabel: "View invoices",
    });
  }

  // Staff with no activity for 3+ days
  const inactiveStaff = users.filter(u => {
    if (u.role === "owner" || u.role === "client") return false;
    if (!u.last_login) return true;
    return differenceInDays(now, parseISO(u.last_login)) >= 3;
  });
  if (inactiveStaff.length > 0) {
    alerts.push({
      id: "inactive_staff",
      severity: "low",
      message: `${inactiveStaff.map(u => u.full_name || u.email).join(", ")} ${inactiveStaff.length === 1 ? "hasn't" : "haven't"} logged in for 3+ days`,
      link: "/staff",
      linkLabel: "View staff",
    });
  }

  // Unverified CPC leads > 24h old
  const staleLeads = leads.filter(l => {
    if (l.status !== "pending_verification") return false;
    if (!l.created_date) return false;
    return differenceInDays(now, parseISO(l.created_date)) >= 1;
  });
  if (staleLeads.length > 0) {
    alerts.push({
      id: "stale_leads",
      severity: "medium",
      message: `${staleLeads.length} CPC lead${staleLeads.length > 1 ? "s are" : " is"} waiting for verification for over 24 hours`,
      link: "/leads",
      linkLabel: "Verify leads",
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="glass rounded-xl p-4 flex items-center gap-3 mb-6 border border-success/20">
        <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
          <span className="text-success text-lg">✓</span>
        </div>
        <p className="text-sm text-success font-medium">All clear — no issues need your attention right now</p>
      </div>
    );
  }

  const SEVERITY_STYLE = {
    high: "border-destructive/30 bg-destructive/5",
    medium: "border-warning/30 bg-warning/5",
    low: "border-border/40 bg-muted/10",
  };
  const ICON_COLOR = {
    high: "text-destructive",
    medium: "text-warning",
    low: "text-muted-foreground",
  };

  return (
    <div className="glass rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-semibold text-foreground">Needs Your Attention</h3>
        <span className="ml-auto text-xs text-muted-foreground">{alerts.length} item{alerts.length > 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2">
        {alerts.map(alert => (
          <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-lg border ${SEVERITY_STYLE[alert.severity]}`}>
            <Clock className={`w-4 h-4 shrink-0 ${ICON_COLOR[alert.severity]}`} />
            <p className="text-sm text-foreground flex-1">{alert.message}</p>
            <Link to={alert.link} className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
              {alert.linkLabel} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}