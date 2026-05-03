import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, CheckSquare, Receipt, BarChart2, FileText, Upload, Mail, User, Bell, LogOut, Menu, X, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ClientSidebar({ mobileOpen, setMobileOpen, user }) {
  const location = useLocation();
  const [client, setClient] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingDeliverables, setPendingDeliverables] = useState(0);
  const [unpaidInvoices, setUnpaidInvoices] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Find client by email
        const clients = await base44.entities.Client.filter({ email: user?.email });
        const currentClient = Array.isArray(clients) ? clients[0] : clients;
        if (currentClient) {
          setClient(currentClient);
          
          // Load notifications
          const notifs = await base44.entities.ClientNotification.filter({ client_id: currentClient.id, is_read: false });
          setUnreadCount(Array.isArray(notifs) ? notifs.length : (notifs ? 1 : 0));
          
          // Load deliverables count
          const delivs = await base44.entities.Deliverable.filter({ client_id: currentClient.id, status: "pending_client_review" });
          setPendingDeliverables(Array.isArray(delivs) ? delivs.length : (delivs ? 1 : 0));
          
          // Load unpaid invoices
          const invoices = await base44.entities.Invoice.filter({ client_id: currentClient.id, status: "issued" });
          setUnpaidInvoices(Array.isArray(invoices) ? invoices.length : (invoices ? 1 : 0));
          
          // Check onboarding status
          const submissions = await base44.entities.ClientOnboardingSubmission.filter({ client_id: currentClient.id });
          const sub = Array.isArray(submissions) ? submissions[0] : submissions;
          setOnboardingIncomplete(!sub || sub.submission_status !== "submitted");
        }
      } catch (err) {
        console.error("ClientSidebar load error:", err);
      }
    };
    if (user?.email) load();
  }, [user?.email]);

  const items = [
    { path: "/client-portal", label: "Home", icon: Home },
    ...(onboardingIncomplete ? [{ path: "/client/onboarding-form", label: "Onboarding", icon: ClipboardList, badge: null }] : []),
    { path: "/client/deliverables", label: "Deliverables", icon: CheckSquare, badge: pendingDeliverables > 0 ? pendingDeliverables : null },
    { path: "/client/invoices", label: "Invoices", icon: Receipt, badge: unpaidInvoices > 0 ? unpaidInvoices : null },
    { path: "/client/reports", label: "Reports", icon: BarChart2 },
    { path: "/client/contracts", label: "Contracts", icon: FileText },
    { path: "/client/uploads", label: "Files", icon: Upload },
    { path: "/client/messages", label: "Messages", icon: Mail, badge: unreadMessages > 0 ? unreadMessages : null },
    { path: "/client/profile", label: "Profile", icon: User },
  ];

  const logout = () => {
    import('@/lib/customAuth').then(({ destroySession }) => {
      destroySession(user?.id).then(() => {
        window.location.href = '/login';
      });
    });
  };

  return (
    <>
      {/* Mobile toggle */}
      <button className="lg:hidden fixed top-4 left-4 z-50" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-58 flex flex-col
        transition-transform duration-300 lg:pt-0 pt-16
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:flex
      `} style={{ width: 224, background: "rgba(10,10,20,0.95)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Logo + Client Name */}
        <div className="px-4 py-4 border-b space-y-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="w-full max-w-[168px] object-contain"
            style={{ filter: "invert(1) brightness(2)", mixBlendMode: "screen" }}
          />
          {client && (
            <div className="text-xs">
              <p className="text-muted-foreground">Client</p>
              <p className="text-sm font-semibold text-foreground truncate">{client.business_name}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {items.map(({ path, label, icon: Icon, badge }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                  active
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={active ? {} : { color: "#a8a8c0" }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {badge && (
                  <span className="ml-auto text-xs bg-accent text-accent-foreground rounded-full px-2 py-0.5 font-semibold">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <Link to="/client-portal" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-xs transition-all relative" style={{ color: "#6b6b85" }}>
            <Bell className="w-4 h-4 shrink-0" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-auto bg-accent text-accent-foreground text-xs rounded-full px-2 py-0.5 font-semibold">
                {unreadCount}
              </span>
            )}
          </Link>
          <div className="text-xs px-3 py-2 text-muted-foreground">
            <p className="font-semibold mb-1">Need help?</p>
            <p>support@marketingio.co.za</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive text-xs font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}