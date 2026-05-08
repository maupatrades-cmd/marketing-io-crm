/**
 * AdminNotificationBell
 * Polls for unread ClientNotification rows where recipient_user_id = current user.
 * Shows a badge count and a dropdown list of recent notifications.
 */
import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function AdminNotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unread = notifications.filter(n => !n.is_read).length;

  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      const rows = await base44.entities.ClientNotification.filter(
        { recipient_user_id: user.id },
        "-created_date",
        30
      );
      setNotifications(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("[AdminNotificationBell] load failed:", err);
    }
  };

  useEffect(() => {
    if (!user?.id || !["admin", "owner"].includes(user?.role)) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    const unreadRows = notifications.filter(n => !n.is_read);
    for (const n of unreadRows) {
      try {
        await base44.entities.ClientNotification.update(n.id, {
          is_read: true,
          read_at: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  if (!user || !["admin", "owner"].includes(user.role)) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) loadNotifications(); }}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
        style={{ color: "#a8a8c0" }}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-80 rounded-xl shadow-xl border z-50 overflow-hidden"
          style={{ background: "rgba(15,15,30,0.98)", borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className="px-4 py-3 border-b cursor-pointer hover:bg-white/5 transition-colors"
                  style={{
                    borderColor: "rgba(255,255,255,0.05)",
                    background: n.is_read ? "transparent" : "rgba(167,100,230,0.07)",
                  }}
                  onClick={() => {
                    if (!n.is_read) {
                      base44.entities.ClientNotification.update(n.id, { is_read: true, read_at: new Date().toISOString() }).catch(() => {});
                      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
                    }
                    if (n.action_url) window.location.href = n.action_url;
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {n.created_date ? new Date(n.created_date).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}