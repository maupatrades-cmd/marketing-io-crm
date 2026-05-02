import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import { CheckCircle2, Clock, Target, TrendingUp, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch today's tasks
        setLoadingTasks(true);
        const allTasks = await base44.entities.Task.list("-created_date", 200);
        const today = new Date().toISOString().split("T")[0];
        const todayTasks = allTasks.filter(
          (t) =>
            t.assigned_to === user?.id &&
            t.due_date === today &&
            ["open", "in_progress"].includes(t.status)
        );
        setTasks(todayTasks);

        // Fetch recent activity
        setLoadingActivity(true);
        const allActivity = await base44.entities.ClientActivityLog.list("-created_date", 100);
        const myActivity = allActivity
          .filter((a) => a.created_by === user?.id)
          .slice(0, 5);
        setActivity(myActivity);

        // Fetch this week's pipeline (Field Agent + CPC only)
        if (["field_agent", "cpc"].includes(user?.role)) {
          const allDeals = await base44.entities.Deal.list();
          const thisWeekDeals = allDeals.filter(
            (d) =>
              (d.closer_id === user?.id || d.cpc_id === user?.id) &&
              !["closed_won", "closed_lost"].includes(d.stage)
          );
          setDeals(thisWeekDeals.slice(0, 5));
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
        <div className="text-xl font-semibold text-foreground">
          Good {greeting}, {user?.full_name || "there"}
        </div>

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
                <Button size="sm" className="mt-3 gap-2">
                  <Plus className="w-4 h-4" />
                  Add Task
                </Button>
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
    </AppLayout>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}