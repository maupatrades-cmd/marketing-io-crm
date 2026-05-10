import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { format } from "date-fns";
import { Loader2, Users, UserCircle, ChevronRight } from "lucide-react";

const ROLE_COLORS = {
  cpc: { bg: "rgba(167,100,230,0.12)", border: "rgba(167,100,230,0.35)", text: "#a764e6", label: "CPC" },
  field_agent: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", text: "#3b82f6", label: "Field Agent" },
  admin: { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.35)", text: "#ec4899", label: "Admin" },
  head_of_tech: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", text: "#10b981", label: "Head of Tech" },
  driver: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "#f59e0b", label: "Driver" },
};

const ROLE_ORDER = ["cpc", "field_agent", "admin", "head_of_tech", "driver"];

const EVENT_ICONS = {
  auth: "🔐", profile: "👤", payment: "💳", invoice: "📄",
  lead: "📍", communication: "💬", support: "🆘", deal: "🎯", account: "🏢", document: "📋",
};

export default function StaffActivityLog() {
  const [allActivities, setAllActivities] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      const [activities, users] = await Promise.all([
        base44.entities.ClientActivityLog.list("-created_date", 500),
        base44.entities.AppUser.filter({ role: { $in: ["cpc", "field_agent", "admin", "head_of_tech", "driver"] } }, "-created_date", 200),
      ]);
      if (!cancelled) {
        setAllActivities(Array.isArray(activities) ? activities : []);
        const userList = Array.isArray(users) ? users : [];
        setStaffUsers(userList);
        if (!selectedUserId && userList.length > 0) {
          // Pre-select first CPC, or first user
          const firstCpc = userList.find(u => u.role === "cpc");
          setSelectedUserId((firstCpc || userList[0]).id);
        }
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Group users by role in display order
  const groupedUsers = ROLE_ORDER.reduce((acc, role) => {
    const inRole = staffUsers.filter(u => u.role === role);
    if (inRole.length > 0) acc.push({ role, users: inRole });
    return acc;
  }, []);

  const selectedUser = staffUsers.find(u => u.id === selectedUserId);
  const userActivities = selectedUserId
    ? allActivities.filter(a => a.logged_by === selectedUserId || a.actor_id === selectedUserId)
    : [];

  const roleStyle = selectedUser ? (ROLE_COLORS[selectedUser.role] || ROLE_COLORS.cpc) : ROLE_COLORS.cpc;

  return (
    <AppLayout title="Staff Activity Log" subtitle="Individual activity feeds per staff member">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex gap-4 h-full">
          {/* Left sidebar — staff folders */}
          <div className="w-56 shrink-0 space-y-4">
            {groupedUsers.map(({ role, users }) => {
              const col = ROLE_COLORS[role] || ROLE_COLORS.cpc;
              return (
                <div key={role}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1"
                    style={{ color: col.text }}>{col.label}s</p>
                  <div className="space-y-1">
                    {users.map(u => {
                      const isActive = selectedUserId === u.id;
                      const count = allActivities.filter(a => a.logged_by === u.id || a.actor_id === u.id).length;
                      return (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUserId(u.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                          style={{
                            background: isActive ? col.bg : "transparent",
                            border: isActive ? `1px solid ${col.border}` : "1px solid transparent",
                            color: isActive ? col.text : "#a8a8c0",
                          }}
                        >
                          <UserCircle className="w-4 h-4 shrink-0" />
                          <span className="flex-1 truncate">{u.full_name || u.email}</span>
                          {count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: isActive ? col.border : "rgba(255,255,255,0.08)", color: isActive ? "#fff" : "#6b6b85" }}>
                              {count > 99 ? "99+" : count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {staffUsers.length === 0 && (
              <p className="text-xs text-muted-foreground px-2">No staff users found</p>
            )}
          </div>

          {/* Right — activity feed for selected user */}
          <div className="flex-1 min-w-0">
            {!selectedUser ? (
              <div className="glass rounded-xl p-12 text-center">
                <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#6b6b85" }} />
                <p style={{ color: "#a8a8c0" }}>Select a staff member to view their activity</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="glass rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, color: roleStyle.text }}>
                    {(selectedUser.full_name || selectedUser.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: "#f4f4fa" }}>{selectedUser.full_name || selectedUser.email}</p>
                    <p className="text-xs" style={{ color: "#6b6b85" }}>{roleStyle.label} · {userActivities.length} events</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, color: roleStyle.text }}>
                    {roleStyle.label}
                  </span>
                </div>

                {/* Feed */}
                {userActivities.length === 0 ? (
                  <div className="glass rounded-xl p-12 text-center">
                    <p style={{ color: "#a8a8c0" }}>No activity recorded for {selectedUser.full_name || "this user"}</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <div className="space-y-1.5 pl-12">
                      {userActivities.map((a, i) => {
                        const icon = EVENT_ICONS[a.event_category] || "•";
                        return (
                          <div key={a.id + i} className="relative">
                            <div className="absolute -left-7 top-4 w-2.5 h-2.5 rounded-full"
                              style={{ background: roleStyle.bg, border: `2px solid ${roleStyle.text}` }} />
                            <div className="glass rounded-xl p-3.5 flex items-start gap-3 hover:border-white/15 transition-all">
                              <span className="text-base mt-0.5 shrink-0">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-snug" style={{ color: "#f4f4fa" }}>
                                  {a.event_summary || a.title || a.event_type}
                                </p>
                                {a.client_name && (
                                  <p className="text-xs mt-0.5" style={{ color: "#a8a8c0" }}>Client: {a.client_name}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-xs" style={{ color: "#a8a8c0" }}>
                                  {format(new Date(a.created_date), "dd MMM yyyy")}
                                </p>
                                <p className="text-[11px]" style={{ color: "#6b6b85" }}>
                                  {format(new Date(a.created_date), "HH:mm")}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}