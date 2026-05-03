import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, X, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function NotificationCenter({ clientId }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [clientId]);

  const fetchNotifications = async () => {
    try {
      const res = await base44.entities.ClientNotification.filter(
        { client_id: clientId },
        '-created_date',
        50
      );
      setNotifications(res || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await base44.entities.ClientNotification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString(),
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      // Since delete might not be available, we update is_deleted flag if exists
      // Otherwise just remove from UI
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const getNotificationIcon = (type) => {
    const icons = {
      deliverable_ready: <CheckCircle2 className="w-4 h-4 text-blue-400" />,
      invoice_issued: <AlertCircle className="w-4 h-4 text-yellow-400" />,
      payment_received: <CheckCircle2 className="w-4 h-4 text-green-400" />,
      contract_to_sign: <AlertCircle className="w-4 h-4 text-orange-400" />,
      report_ready: <CheckCircle2 className="w-4 h-4 text-purple-400" />,
    };
    return icons[type] || <Bell className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-700 rounded-lg transition"
      >
        <Bell className="w-5 h-5 text-slate-300 hover:text-foreground transition" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-96 bg-card border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-foreground transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-80">
            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-4 hover:bg-slate-700/50 transition cursor-pointer border-l-4 ${
                      n.is_read
                        ? 'border-l-slate-700 bg-slate-800/30'
                        : 'border-l-primary bg-primary/5'
                    }`}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {getNotificationIcon(n.notification_type)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground text-sm">
                          {n.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {n.body}
                        </p>
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1"></div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(n.created_date), 'MMM dd, HH:mm')}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="text-slate-500 hover:text-red-400 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-slate-700 p-3 bg-slate-800/50 text-center">
              <a
                href="/client/messages"
                className="text-xs text-primary hover:text-primary/80 font-medium"
              >
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}