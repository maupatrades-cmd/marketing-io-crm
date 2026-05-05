import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const location = useLocation();

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

        const [invs, threads] = await Promise.all([
          base44.entities.Invoice.filter({ client_id: c.id }, '-created_date', 100).catch(() => []),
          base44.entities.ClientThread.filter({ client_id: c.id }).catch(() => [])
        ]);
        if (cancelled) return;

        const open = (Array.isArray(invs) ? invs : []).filter(
          inv => inv.status === 'issued' || inv.status === 'pending_payment'
        );
        setUnpaidInvoices(open.length);

        const totalUnread = (Array.isArray(threads) ? threads : [])
          .reduce((sum, t) => sum + (t.unread_count_client || 0), 0);
        setUnreadMessages(totalUnread);
      } catch (err) {
        console.error('[ClientLayout] load failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  const unreadCounts = useMemo(
    () => ({ invoices: unpaidInvoices, messages: unreadMessages }),
    [unpaidInvoices, unreadMessages]
  );

  return (
    <div className="min-h-screen flex font-inter" style={{ background: '#0b0b14' }}>
      <ClientSidebar
        client={client}
        user={user}
        unreadCounts={unreadCounts}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onContact={() => setContactOpen(true)}
      />
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
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
