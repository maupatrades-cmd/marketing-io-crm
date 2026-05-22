import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import { CheckCircle2, Clock, Target, TrendingUp, Plus, AlertTriangle, FileText, ListChecks, MapPin, CalendarClock, Send, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import LogVisitModal from "@/components/staff/LogVisitModal";
import ScheduleFollowUpModal from "@/components/staff/ScheduleFollowUpModal";
import QuickUpdateModal from "@/components/staff/QuickUpdateModal";
import LogCommunicationModal from "@/components/admin/LogCommunicationModal";
import QuickLogCallModal from "@/components/cpc/QuickLogCallModal";

const KPI_CONFIG = {
  field_agent: [
    { label: "Deals Closed (Month)", metric: "deals_closed", target: 3 },
    { label: "Discovery Visits", metric: "discovery_visits", target: 15 },
    { label: "Pipeline Value", metric: "pipeline_value", target: 100000 },
  ],
  cpc: [
    { label: "Qualified Leads", metric: "qualified_leads", target: 20 },
    { label: "Closure Rate", metric: "closure_rate", target: 25 },
    { label: "Daily Calls", metric: "daily_calls", target: 40 },
  ],
  admin: [
    { label: "Contracts Loaded", metric: "contracts_loaded", target: 5 },
    { label: "Form Completion %", metric: "form_completion_rate", target: 80 },
    { label: "Failed Debit Follow-ups", metric: "failed_debit_followups", target: 0 },
  ],
  head_of_tech: [
    { label: "Bucket B Within SLA", metric: "bucket_b_on_time", target: 95 },
    { label: "Uptime %", metric: "website_uptime", target: 99.5 },
    { label: "Tickets Resolved", metric: "tickets_resolved", target: 10 },
  ],
  driver: [
    { label: "Deliveries", metric: "deliveries", target: 20 },
  ],
};

export default function StaffMyDay() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [deals, setDeals] = useState([]);
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showQuickMsgModal, setShowQuickMsgModal] = useState(false);
  const [showLogCommModal, setShowLogCommModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingTasks(true);
        setLoadingActivity(true);
        const today = new Date().toISOString().split("T")[0];

        if (user?.role === "admin") {
          // Admin overview: tasks (any assigned to admin), overdue invoices, pending submissions
          const [allTasks, invs, subs, acts] = await Promise.all([
            base44.entities.Task.list("-created_date", 200).catch(() => []),
            base44.entities.Invoice.list("-created_date", 200).catch(() => []),
            base44.entities.ClientOnboardingSubmission.list("-created_date", 50).catch(() => []),
            base44.entities.ClientActivityLog.list("-created_date", 50).catch(() => []),
          ]);
          const todayTasks = (Array.isArray(allTasks) ? allTasks : []).filter(
            (t) => t.assigned_to === user?.id && ["open", "in_progress"].includes(t.status)
          );
          setTasks(todayTasks);
          const overdue = (Array.isArray(invs) ? invs : []).filter(
            (i) => i.status === "overdue" || (i.status === "sent" && i.due_date && new Date(i.due_date) < new Date())
          ).slice(0, 10);
          setOverdueInvoices(overdue);
          const pending = (Array.isArray(subs) ? subs : []).filter((s) => s.status === "submitted").slice(0, 10);
          setPendingSubmissions(pending);
          setActivity((Array.isArray(acts) ? acts : []).slice(0, 5));
        } else {
          const allTasks = await base44.entities.Task.list("-created_date", 200).catch(() => []);
          const todayTasks = (Array.isArray(allTasks) ? allTasks : []).filter(
            (t) => t.assigned_to === user?.id && t.due_date === today && ["open", "in_progress"].includes(t.status)
          );
          setTasks(todayTasks);

          const allActivity = await base44.entities.ClientActivityLog.list("-created_date", 100).catch(() => []);
          setActivity((Array.isArray(allActivity) ? allActivity : []).filter((a) => a.created_by === user?.id).slice(0, 5));

          if (["field_agent", "cpc"].includes(user?.role)) {
            const allDeals = await base44.entities.Deal.list().catch(() => []);
            const thisWeekDeals = (Array.isArray(allDeals) ? allDeals : []).filter(
              (d) => (d.closer_id === user?.id || d.cpc_id === user?.id) && !["closed_won", "closed_lost"].includes(d.stage)
            );
            setDeals(thisWeekDeals.slice(0, 5));
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingTasks(false);
        setLoadingActivity(false);
      }
    };

    if (user?.id) fetchData();
  }, [user]);

  const kpis = KPI_CONFIG[user?.role] || [];
  const greeting = getGreeting();

  return (
    <AppLayout title="My Day" subtitle={new Date().toLocaleDateString()}>
      <div className="space-y-6">
        {/* Greeting */}
        <div className="text-xl font-semibold" style={{ color: '#E63946' }}>
          Good {greeting}, {user?.full_name || "there"}
        </div>

        {/* CPC Quick Actions */}
        {user?.role === "cpc" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button className="h-14 flex-col gap-1 text-xs bg-[#0A1F44] text-white hover:bg-[#0A1F44]/90" onClick={() => setShowLogCallModal(true)}>
              <Phone className="w-5 h-5" />
              Log a Call
            </Button>
            <Link to="/leads" className="contents">
              <Button variant="outline" className="h-14 flex-col gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10 w-full">
                <Plus className="w-5 h-5" />
                Add a Lead
              </Button>
            </Link>
            <Button variant="outline" className="h-14 flex-col gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10" onClick={() => setShowFollowUpModal(true)}>
              <CalendarClock className="w-5 h-5" />
              Schedule Follow-up
            </Button>
          </div>
        )}

        {/* Admin Quick Actions */}
        {user?.role === "admin" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button className="h-14 flex-col gap-1 text-xs bg-[#0A1F44] text-white hover:bg-[#0A1F44]/90" onClick={() => setShowLogCommModal(true)}>
              <Send className="w-5 h-5" />
              Log Communication
            </Button>
            <Link to="/admin/invoices" className="contents">
              <Button variant="outline" className="h-14 flex-col gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10 w-full">
                <FileText className="w-5 h-5" />
                Invoice Chase
              </Button>
            </Link>
            <Link to="/tasks" className="contents">
              <Button variant="outline" className="h-14 flex-col gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10 w-full">
                <CheckCircle2 className="w-5 h-5" />
                Open Tasks
              </Button>
            </Link>
          </div>
        )}

        {/* FA Quick Actions — field_agent only */}
        {user?.role === "field_agent" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              className="h-14 flex-col gap-1 text-xs bg-[#0A1F44] text-white hover:bg-[#0A1F44]/90"
              onClick={() => setShowVisitModal(true)}
            >
              <MapPin className="w-5 h-5" />
              Log a Visit
            </Button>
            <Link to="/leads" className="contents">
              <Button variant="outline" className="h-14 flex-col gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10 w-full">
                <Plus className="w-5 h-5" />
                Add a Lead
              </Button>
            </Link>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => setShowFollowUpModal(true)}
            >
              <CalendarClock className="w-5 h-5" />
              Schedule Follow-up
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => setShowQuickMsgModal(true)}
            >
              <Send className="w-5 h-5" />
              Send Quick Update
            </Button>
          </div>
        )}

        {/* Today's Tasks */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-primary" />
              Today's Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : tasks.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No tasks due today</p>
                  <Link to="/tasks">
                    <Button size="sm" className="mt-3 gap-2">
                      <Plus className="w-4 h-4" /> Add Task
                    </Button>
                  </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <input type="checkbox" className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {task.priority || "medium"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs Snapshot */}
        {kpis.length > 0 && (
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-primary" />
                My KPIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kpis.map((kpi) => (
                  <div key={kpi.metric} className="bg-secondary/30 p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">{kpi.label}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-foreground">—</p>
                        <p className="text-xs text-muted-foreground">/ {kpi.target}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">On Track</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Overview */}
        {user?.role === "admin" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{overdueInvoices.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Overdue Invoices</p>
                <Link to="/admin/invoices" className="text-xs text-primary hover:underline">View →</Link>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-warning">{pendingSubmissions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Onboarding Queue</p>
                <Link to="/onboarding-submissions" className="text-xs text-primary hover:underline">Review →</Link>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary">{tasks.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Open Tasks</p>
                <Link to="/tasks" className="text-xs text-primary hover:underline">View →</Link>
              </div>
            </div>

            {overdueInvoices.length > 0 && (
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-5 h-5 text-destructive" /> Overdue Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {overdueInvoices.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{inv.client_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{inv.invoice_number || inv.id.slice(0, 8)}</p>
                        </div>
                        <span className="text-sm font-semibold text-destructive">R{Number(inv.total_amount || inv.total || inv.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {pendingSubmissions.length > 0 && (
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ListChecks className="w-5 h-5 text-warning" /> Pending Onboarding Submissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingSubmissions.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{sub.business_name || sub.client_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(sub.created_date).toLocaleDateString("en-ZA")}</p>
                        </div>
                        <Badge className="bg-warning/15 text-warning">Awaiting review</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* This Week's Pipeline */}
        {["field_agent", "cpc"].includes(user?.role) && (
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                This Week's Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <p className="text-muted-foreground text-sm">No deals this week</p>
              ) : (
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-foreground">{deal.client_name}</p>
                        <p className="text-xs text-muted-foreground">{deal.package} · {deal.stage?.replace(/_/g, " ")}</p>
                      </div>
                      {deal.monthly_retainer && (
                        <span className="text-sm font-semibold text-primary">R{deal.monthly_retainer?.toLocaleString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : activity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start justify-between p-3 bg-secondary/30 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-foreground">{a.event_label}</p>
                      <p className="text-xs text-muted-foreground">{a.client_name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_date), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FA Modals */}
      {showVisitModal && <LogVisitModal user={user} onClose={() => setShowVisitModal(false)} />}
      {showFollowUpModal && <ScheduleFollowUpModal user={user} onClose={() => setShowFollowUpModal(false)} />}
      {showQuickMsgModal && <QuickUpdateModal user={user} onClose={() => setShowQuickMsgModal(false)} />}
      {showLogCommModal && <LogCommunicationModal open={showLogCommModal} onClose={() => setShowLogCommModal(false)} currentUser={user} />}
      {showLogCallModal && <QuickLogCallModal open={showLogCallModal} onClose={() => setShowLogCallModal(false)} user={user} />}
    </AppLayout>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}