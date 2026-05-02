import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckSquare, Zap, Wrench, DollarSign, AlertCircle } from "lucide-react";
import { startOfWeek, startOfMonth, isAfter, parseISO } from "date-fns";

function initials(user) {
  return (user.full_name || user.email || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function StaffCard({ member, data }) {
  const { tasks, deals, leads, commissions, activityLog, onboardings } = data;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const myTasks = useMemo(() => tasks.filter(t => t.assigned_to === member.id), [tasks, member.id]);
  const myDeals = useMemo(() => deals.filter(d => d.closer_id === member.id), [deals, member.id]);
  const myLeads = useMemo(() => leads.filter(l => l.submitted_by === member.id), [leads, member.id]);
  const myComms = useMemo(() => commissions.filter(c => c.staff_id === member.id), [commissions, member.id]);
  const myActivity = useMemo(() => activityLog.filter(a => a.logged_by === member.id || a.logged_by_name === (member.full_name || member.email)), [activityLog, member]);

  const openTasks = myTasks.filter(t => t.status === "open" || t.status === "in_progress");
  const overdueTasks = myTasks.filter(t => (t.status === "open" || t.status === "in_progress") && t.due_date && t.due_date < todayStr);
  const completedToday = myTasks.filter(t => t.status === "done" && t.completed_at?.startsWith(todayStr));

  const thisMonthCommission = myComms
    .filter(c => c.status !== "withheld" && c.qualifying_event_date >= todayStr.slice(0, 7) + "-01")
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const role = member.role;

  return (
    <div className="glass rounded-xl p-5 flex flex-col gap-4 hover:shadow-card-hover transition-all">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full gradient-bg-subtle border border-border/40 flex items-center justify-center text-sm font-bold text-foreground shrink-0">
          {initials(member)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{member.full_name || member.email}</p>
          <span className="text-xs text-muted-foreground capitalize">{(role || "staff").replace(/_/g, " ")}</span>
        </div>
        {overdueTasks.length > 0 && (
          <div className="flex items-center gap-1 text-warning text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {overdueTasks.length} overdue
          </div>
        )}
      </div>

      {/* Tasks strip — all roles */}
      <div className="flex gap-2">
        <Stat label="Open" value={openTasks.length} color="text-foreground" />
        <Stat label="Overdue" value={overdueTasks.length} color={overdueTasks.length > 0 ? "text-warning" : "text-muted-foreground"} />
        <Stat label="Done today" value={completedToday.length} color="text-success" />
      </div>

      {/* Role-specific metrics */}
      {(role === "field_agent" || role === "admin") && (
        <FieldAgentMetrics
          myDeals={myDeals}
          thisMonthCommission={thisMonthCommission}
          weekStart={weekStart}
        />
      )}

      {role === "cpc" && (
        <CPCMetrics
          myLeads={myLeads}
          weekStart={weekStart}
          monthStart={monthStart}
          thisMonthCommission={thisMonthCommission}
        />
      )}

      {role === "head_of_tech" && (
        <TechMetrics myTasks={myTasks} deals={deals} />
      )}

      {/* Recent activity */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Recent Activity</p>
        {myActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">No recent activity logged</p>
        ) : (
          <ul className="space-y-1">
            {myActivity.slice(0, 5).map(a => (
              <li key={a.id} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{a.event_label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="flex-1 glass rounded-lg px-2 py-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function FieldAgentMetrics({ myDeals, thisMonthCommission, weekStart }) {
  const openDeals = myDeals.filter(d => !["closed_won", "closed_lost"].includes(d.stage));
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.monthly_retainer || 0), 0);
  const discoveryThisWeek = myDeals.filter(d => d.stage === "discovery_visit" && d.created_date && isAfter(parseISO(d.created_date), weekStart)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs text-muted-foreground">Pipeline</span>
      </div>
      <div className="flex gap-2">
        <Stat label="Open deals" value={openDeals.length} color="text-foreground" />
        <Stat label="Pipeline" value={`R${(pipelineValue / 1000).toFixed(0)}k`} color="text-primary" />
        <Stat label="Visits/wk" value={discoveryThisWeek} color="text-[#00CCFF]" />
      </div>
      <div className="glass rounded-lg px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-success" />
          <span className="text-xs text-muted-foreground">This month's commission</span>
        </div>
        <span className="text-sm font-bold text-success">R{thisMonthCommission.toLocaleString()}</span>
      </div>
    </div>
  );
}

function CPCMetrics({ myLeads, weekStart, monthStart, thisMonthCommission }) {
  const thisWeekLeads = myLeads.filter(l => l.created_date && isAfter(parseISO(l.created_date), weekStart)).length;
  const pendingVerification = myLeads.filter(l => l.status === "pending_verification").length;
  const qualifiedThisMonth = myLeads.filter(l => l.status === "verified" && l.verified_date >= monthStart.toISOString().split("T")[0]).length;
  const converted = myLeads.filter(l => l.status === "converted").length;
  const convRate = myLeads.length > 0 ? Math.round((converted / myLeads.length) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-warning" />
        <span className="text-xs text-muted-foreground">Lead Performance</span>
      </div>
      <div className="flex gap-2">
        <Stat label="This week" value={thisWeekLeads} color="text-foreground" />
        <Stat label="Pending" value={pendingVerification} color={pendingVerification > 0 ? "text-warning" : "text-muted-foreground"} />
        <Stat label="Conv. rate" value={`${convRate}%`} color="text-success" />
      </div>
      <div className="glass rounded-lg px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-success" />
          <span className="text-xs text-muted-foreground">This month's commission</span>
        </div>
        <span className="text-sm font-bold text-success">R{thisMonthCommission.toLocaleString()}</span>
      </div>
    </div>
  );
}

function TechMetrics({ myTasks, deals }) {
  const activeBuilds = myTasks.filter(t => t.status === "in_progress").length;
  const openTickets = myTasks.filter(t => t.status === "open").length;
  const completedSetups = myTasks.filter(t => t.status === "done").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs text-muted-foreground">Technical Work</span>
      </div>
      <div className="flex gap-2">
        <Stat label="Active builds" value={activeBuilds} color="text-accent" />
        <Stat label="Open tickets" value={openTickets} color="text-foreground" />
        <Stat label="Completed" value={completedSetups} color="text-success" />
      </div>
    </div>
  );
}