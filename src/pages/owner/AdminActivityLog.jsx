import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { format } from "date-fns";
import { Loader2, Filter } from "lucide-react";

export default function AdminActivityLog() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchRole, setSearchRole] = useState("all");

  useEffect(() => {
    let cancelled = false;
    const loadActivities = async () => {
      try {
        const logs = await base44.entities.ClientActivityLog.list("-created_date", 200);
        if (!cancelled) {
          setActivities(Array.isArray(logs) ? logs : []);
        }
      } catch (error) {
        console.error("Error loading activities:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadActivities();
    const interval = setInterval(loadActivities, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = searchRole === "all" 
    ? activities 
    : activities.filter(a => a.actor_role === searchRole);

  const getEventIcon = (category) => {
    const icons = {
      auth: "🔐",
      profile: "👤",
      payment: "💳",
      invoice: "📄",
      lead: "📍",
      communication: "💬",
      support: "🆘",
      document: "📋",
    };
    return icons[category] || "•";
  };

  return (
    <AppLayout title="Admin Activity Log" subtitle="Real-time admin actions and timestamps">
      <div className="space-y-6">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={searchRole}
            onChange={(e) => setSearchRole(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-secondary/50 text-foreground text-sm"
          >
            <option value="all">All Admin Actions</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* Activity List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <p className="text-muted-foreground">No activities found</p>
            </div>
          ) : (
            filtered.map((activity) => (
              <div key={activity.id} className="glass rounded-lg p-4 border-l-4 border-primary/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getEventIcon(activity.event_category)}</span>
                      <h3 className="font-semibold text-foreground">{activity.event_summary}</h3>
                      <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                        {activity.actor_role}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{activity.logged_by_name || "System"}</p>
                    {activity.client_name && (
                      <p className="text-sm text-foreground/70 mb-2">Client: {activity.client_name}</p>
                    )}
                    {activity.event_metadata && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">Details</summary>
                        <pre className="mt-2 bg-secondary/50 p-2 rounded text-[10px] overflow-auto max-h-32">
                          {JSON.stringify(activity.event_metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(activity.created_date), "MMM dd, yyyy")}
                    </p>
                    <p className="text-xs font-medium text-foreground">
                      {format(new Date(activity.created_date), "HH:mm:ss")}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}