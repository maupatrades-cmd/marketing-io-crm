import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentUser } from '@/lib/customAuth';
import ClientSidebar from '@/components/ClientSidebar';
import ContactCenterModal from '@/components/clientportal/ContactCenterModal';

export default function ClientLayout() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadActivity, setUnreadActivity] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = authUser || await getCurrentUser();
      if (!me) return;
      if (!cancelled) setUser(me);

      try {
        const clients = await base44.entities.Client.filter({ email: me.email });
        const c = Array.isArray(clients) ? clients[0] : clients;
        if (cancelled) return;
        if (!c) return;
        setClient(c);

        const [invs, threads, activities] = await Promise.all([
          base44.entities.Invoice.filter({ client_id: c.id }, '-created_date', 100).catch(() => []),
          base44.entities.ClientThread.filter({ client_id: c.id }).catch(() => []),
          base44.entities.ClientActivityLog.filter({ client_id: c.id, read_at: null }, '-created_date', 100).catch(() => [])
        ]);
        if (cancelled) return;

        const open = (Array.isArray(invs) ? invs : []).filter(
          inv => inv.status === 'issued' || inv.status === 'pending_payment'
        );
        setUnpaidInvoices(open.length);

        const totalUnread = (Array.isArray(threads) ? threads : [])
          .reduce((sum, t) => sum + (t.unread_count_client || 0), 0);
        setUnreadMessages(totalUnread);

        const activityCount = (Array.isArray(activities) ? activities : []).length;
        setUnreadActivity(activityCount);
      } catch (err) {
        console.error('[ClientLayout] load failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  const unreadCounts = useMemo(
    () => ({ invoices: unpaidInvoices, messages: unreadMessages, activity: unreadActivity }),
    [unpaidInvoices, unreadMessages, unreadActivity]
  );

  return (
    <div className="min-h-screen flex font-inter" style={{ background: '#FFFFFF' }}>
      <ClientSidebar
        client={client}
        user={user}
        unreadCounts={unreadCounts}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onContact={() => setContactOpen(true)}
      />
      <main className="flex-1 min-w-0 overflow-auto flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 md:hidden" style={{ borderBottom: '1px solid #E3E3E3', background: '#FFFFFF' }}>
          <button onClick={() => setMobileOpen(o => !o)} style={{ color: '#525252' }}>
            <Menu className="w-5 h-5" />
          </button>
          <button onClick={() => navigate(-1)} style={{ color: '#525252' }} title="Go back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid #E3E3E3' }}>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors" style={{ color: '#525252' }} title="Go back">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>


      {contactOpen && (
        <ContactCenterModal
          client={client}
          user={user}
          isOpen={contactOpen}
          onClose={() => setContactOpen(false)}
        />
      )}
    </div>
  );
}