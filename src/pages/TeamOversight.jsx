import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle, Users, TrendingUp, CheckSquare, Zap, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TeamSnapshotBar from "@/components/oversight/TeamSnapshotBar";
import StaffCard from "@/components/oversight/StaffCard";
import TeamActivityFeed from "@/components/oversight/TeamActivityFeed";
import AlertsPanel from "@/components/oversight/AlertsPanel";

export default function TeamOversight() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [authorized, setAuthorized] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [feedFilter, setFeedFilter] = useState("all");
  const [feedTypeFilter, setFeedTypeFilter] = useState("all");

  const load = useCallback(async () => {
    const [users, tasks, deals, leads, commissions, activityLog, onboardings, invoices] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Task.list("-created_date", 500),
      base44.entities.Deal.list("-created_date", 500),
      base44.entities.Lead.list("-created_date", 500),
      base44.entities.Commission.list("-created_date", 500),
      base44.entities.ClientActivityLog.list("-created_date", 100),
      base44.entities.ClientOnboarding.list("-created_date", 200),
      base44.entities.Invoice.list("-created_date", 200),
    ]);
    setData({ users, tasks, deals, leads, commissions, activityLog, onboardings, invoices });
    setLastUpdated(new Date());
    setSecondsAgo(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      if (user?.role !== "admin" && user?.role !== "owner") {
        navigate("/");
        return;
      }
      // Only owner sees this
      if (user?.role !== "owner") {
        navigate("/");
        return;
      }
      setAuthorized(true);
      load();
    }).catch(() => navigate("/"));
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(() => load(), 60000);
    return () => clearInterval(interval);
  }, [authorized, load]);

  // Seconds-ago ticker
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  if (authorized === false) return null;

  if (loading || !data) {
    return (
      <AppLayout title="Team Performance" subtitle="Loading team data…">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 glass rounded-xl animate-pulse" />)}
        </div>
      </AppLayout>
    );
  }

  const staffMembers = data.users.filter(u => u.role !== "owner" && u.role !== "client");

  return (
    <AppLayout title="Team Performance" subtitle="Live overview of what your team is working on">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Team at a Glance</h2>
            <p className="text-xs text-muted-foreground">
              {staffMembers.length} staff members · Last updated: {secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2 border-border/50">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Team Snapshot Bar */}
      <TeamSnapshotBar staff={staffMembers} />

      {/* Alerts Panel */}
      <AlertsPanel data={data} />

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {staffMembers.map(member => (
          <StaffCard key={member.id} member={member} data={data} />
        ))}
      </div>

      {/* Team Activity Feed */}
      <TeamActivityFeed
        activityLog={data.activityLog}
        staff={staffMembers}
        filterStaff={feedFilter}
        setFilterStaff={setFeedFilter}
        filterType={feedTypeFilter}
        setFilterType={setFeedTypeFilter}
      />
    </AppLayout>
  );
}