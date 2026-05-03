import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';

export default function NotificationBadge({ clientId }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);

  useEffect(() => {
    fetchNotificationStatus();
    const interval = setInterval(fetchNotificationStatus, 30000);
    return () => clearInterval(interval);
  }, [clientId]);

  const fetchNotificationStatus = async () => {
    try {
      const res = await base44.entities.ClientNotification.filter(
        { client_id: clientId, is_read: false },
        '-created_date',
        10
      );
      const unread = res || [];
      setUnreadCount(unread.length);
      if (unread.length > 0) {
        setLatestNotification(unread[0]);
      }
    } catch (err) {
      console.error('Failed to fetch notification status:', err);
    }
  };

  if (unreadCount === 0) return null;

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Mail className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground text-sm">
            {unreadCount} New {unreadCount === 1 ? 'Notification' : 'Notifications'}
          </h4>
          {latestNotification && (
            <p className="text-xs text-slate-400 mt-1">
              {latestNotification.title} — {latestNotification.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}