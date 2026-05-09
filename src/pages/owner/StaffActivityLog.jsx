import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { format } from "date-fns";
import { Loader2, Filter, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STAFF_TYPES = {
  cpc: ["CPC 1", "CPC 2", "CPC 3"],
  field_agent: ["Field Agent 1", "Field Agent 2", "Field Agent 3"],
};

export default function StaffActivityLog() {
  const [allActivities, setAllActivities] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("cpc");

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const [activities, users] = await Promise.all([
          base44.entities.ClientActivityLog.list("-created_date", 300),
          base44.entities.AppUser.filter({ role: { $in: ["cpc", "field_agent"] } }, "-created_date", 100),
        ]);
        
        if (!cancelled) {
          setAllActivities(Array.isArray(activities) ? activities : []);
          setStaffUsers(Array.isArray(users) ? users : []);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const getEventIcon = (category) => {
    const icons = {
      auth: "🔐",
      profile: "👤",
      payment: "💳",
      invoice: "📄",
      lead: "📍",
      communication: "💬",
      support: "🆘",
      deal: "🎯",
    };
    return icons[category] || "•";
  };

  const ActivityCard = ({ activity }) => (
    <div className="glass rounded-lg p-4 border-l-4 border-accent/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{getEventIcon(activity.event_category)}</span>
            <h3 className="font-semibold text-foreground">{activity.event_summary}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{activity.logged_by_name}</p>
          {activity.client_name && (
            <p className="text-sm text-foreground/70">Client: {activity.client_name}</p>
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
  );

  const CPCActivities = () => {
    const cpcUsers = staffUsers.filter(u => u.role === "cpc");
    return (
      <div className="space-y-6">
        {cpcUsers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No CPC users found</p>
        ) : (
          cpcUsers.map((user) => {
            const userActivities = allActivities.filter(a => a.logged_by === user.id);
            return (
              <div key={user.id} className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {user.full_name}
                </h3>
                <div className="space-y-2 ml-4">
                  {userActivities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No activities</p>
                  ) : (
                    userActivities.map(activity => (
                      <ActivityCard key={activity.id} activity={activity} />
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const FieldAgentActivities = () => {
    const fieldUsers = staffUsers.filter(u => u.role === "field_agent");
    return (
      <div className="space-y-6">
        {fieldUsers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No field agents found</p>
        ) : (
          fieldUsers.map((user) => {
            const userActivities = allActivities.filter(a => a.logged_by === user.id);
            return (
              <div key={user.id} className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {user.full_name}
                </h3>
                <div className="space-y-2 ml-4">
                  {userActivities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No activities</p>
                  ) : (
                    userActivities.map(activity => (
                      <ActivityCard key={activity.id} activity={activity} />
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <AppLayout title="Staff Activity Log" subtitle="Track CPC and Field Agent actions in real-time">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="cpc">CPC Activity</TabsTrigger>
            <TabsTrigger value="field_agent">Field Agents Activity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cpc" className="mt-6 space-y-4">
            <CPCActivities />
          </TabsContent>
          
          <TabsContent value="field_agent" className="mt-6 space-y-4">
            <FieldAgentActivities />
          </TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
}