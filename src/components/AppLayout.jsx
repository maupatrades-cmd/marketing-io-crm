import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, TrendingUp, Zap, DollarSign, FileText, BarChart2, Menu, X, MessageSquare, Receipt, Calendar, ClipboardList, Mail, UserCircle, Package, UserCog, PlusCircle, ListChecks, CheckSquare, Eye, File, FormInput, LineChart, Mail as MailIcon, BookOpen, Clock, Send, Briefcase, CheckCircle2, LogOut, Settings, Timer, Star, Target, Megaphone, UserPlus, Search, ArrowLeft, XCircle, ShoppingBag, CreditCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import ClientSidebar from "@/components/ClientSidebar";
import PortalFooter from "@/components/PortalFooter";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import DeletionPendingBanner from "@/components/banner/DeletionPendingBanner";

const STAFF_NAV = {
  field_agent: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/staff/pipeline", label: "My Pipeline", icon: TrendingUp },
    { path: "/cancelled-contracts", label: "Cancelled Invoices", icon: XCircle },
    { path: "/staff/clients", label: "My Clients", icon: Users },
    { path: "/leads", label: "Add Lead", icon: PlusCircle },
    { path: "/lead-scoring", label: "Lead Scoring", icon: Target },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/staff/communications", label: "Communications", icon: Send },
    { path: "/commissions", label: "My Commissions", icon: DollarSign },
    { path: "/staff/earnings", label: "My Earnings", icon: TrendingUp },
    { path: "/staff/add-ons", label: "Add-on Catalog", icon: ShoppingBag },
    { path: "/my-kpis", label: "My KPIs", icon: BarChart2 },
    { path: "/playbooks", label: "Playbooks", icon: BookOpen },
    { path: "/profile", label: "Profile", icon: UserCircle },
  ],
  cpc: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/staff/pipeline", label: "My Pipeline", icon: TrendingUp },
    { path: "/cancelled-contracts", label: "Cancelled Invoices", icon: XCircle },
    { path: "/leads", label: "My Leads", icon: Zap },
    { path: "/lead-scoring", label: "Lead Scoring", icon: Target },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/staff/communications", label: "Communications", icon: Send },
    { path: "/commissions", label: "My Commissions", icon: DollarSign },
    { path: "/staff/earnings", label: "My Earnings", icon: TrendingUp },
    { path: "/staff/add-ons", label: "Add-on Catalog", icon: ShoppingBag },
    { path: "/my-kpis", label: "My KPIs", icon: BarChart2 },
    { path: "/playbooks", label: "Playbooks", icon: BookOpen },
    { path: "/profile", label: "Profile", icon: UserCircle },
  ],
  admin: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/admin/invoices", label: "Invoice Chase", icon: FileText },
    { path: "/cancelled-contracts", label: "Cancelled Invoices", icon: XCircle },
    { path: "/onboarding-submissions", label: "Onboarding Queue", icon: ListChecks },
    { path: "/staff/verify-leads", label: "Verify Leads", icon: CheckCircle2 },
    { path: "/owner/staff-activity", label: "Verified Leads", icon: Star },
    { path: "/contracts", label: "Contracts", icon: File },
    { path: "/receipts", label: "Receipts", icon: Receipt },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/clients", label: "All Clients", icon: Users },
    { path: "/staff/communications", label: "Communications", icon: Send },
    { path: "/my-kpis", label: "My KPIs", icon: BarChart2 },
    { path: "/playbooks", label: "Playbooks", icon: BookOpen },
    { path: "/profile", label: "Profile", icon: UserCircle },
  ],
  head_of_tech: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/staff/clients", label: "My Clients", icon: Briefcase },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/deliverables", label: "Deliverables", icon: CheckSquare },
    { path: "/staff/communications", label: "Communications", icon: Send },
    { path: "/my-kpis", label: "My KPIs", icon: BarChart2 },
    { path: "/playbooks", label: "Playbooks", icon: BookOpen },
    { path: "/profile", label: "Profile", icon: UserCircle },
  ],
  driver: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/profile", label: "Profile", icon: UserCircle },
  ],
};

const OWNER_NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/owner/leads", label: "Lead Inbox", icon: UserPlus, badgeKey: "leadInbox" },
  { path: "/inbox", label: "Inbox", icon: MessageSquare },
  { path: "/my-kpis", label: "My KPIs", icon: BarChart2 },
  { path: "/playbooks", label: "Playbooks", icon: BookOpen },
  { path: "/log-sale", label: "Log a Sale", icon: PlusCircle },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/onboarding", label: "Onboarding", icon: ListChecks },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/deals", label: "Deals", icon: TrendingUp },
  { path: "/leads", label: "Leads", icon: Zap },
  { path: "/lead-scoring", label: "Lead Scoring", icon: Target },
  { path: "/commissions", label: "Commissions", icon: DollarSign },
  { path: "/owner/commissions", label: "Commission Engine", icon: DollarSign },
  { path: "/cancelled-contracts", label: "Cancelled Invoices", icon: XCircle },
  { path: "/invoices", label: "Invoices", icon: FileText },
  { path: "/receipts", label: "Receipts", icon: Receipt },
  { path: "/contracts", label: "Contracts", icon: File },
  { path: "/activity", label: "Activity Log", icon: MessageSquare },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/payroll", label: "Payroll Report", icon: ClipboardList },
  { path: "/owner/staff-hr", label: "Staff & HR", icon: UserCog },
  { path: "/owner/users", label: "Users", icon: UserPlus },
  { path: "/products", label: "Products", icon: Package },
  { path: "/mail", label: "Internal Mail", icon: Mail },
  { path: "/profile", label: "My Profile", icon: UserCircle },
  { path: "/deliverables", label: "Deliverables", icon: CheckSquare },
];

export default function AppLayout({ children, title, subtitle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const [switchedRole, setSwitchedRole] = useState(null);
  const [leadCount, setLeadCount] = useState(0);
  const [navSearch, setNavSearch] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("__owner_switched_role");
    setSwitchedRole(stored);
  }, []);

  useEffect(() => {
    if (user?.role !== "owner") return;
    let cancelled = false;
    base44.entities.Client
      .filter({ lifecycle_stage: "lead" }, "-created_date", 500)
      .then(rows => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : (rows ? [rows] : []);
        setLeadCount(list.length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.role]);

  const navBadges = { leadInbox: leadCount };

  const displayRole = switchedRole || user?.role;

  const toggleSwitchView = (role) => {
    if (switchedRole === role) {
      localStorage.removeItem("__owner_switched_role");
      setSwitchedRole(null);
    } else {
      localStorage.setItem("__owner_switched_role", role);
      setSwitchedRole(role);
    }
  };

  // Client sidebar for client role
  if (user?.role === "client") {
    return (
      <div className="min-h-screen flex font-inter bg-white">
        <ClientSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="px-4 lg:px-6 py-4 flex items-center gap-4"
            style={{ borderBottom: "1px solid #E3E3E3", background: "#FFFFFF" }}>
            <button onClick={() => navigate(-1)} className="shrink-0 hover:text-foreground transition-colors" style={{ color: "#525252" }} title="Go back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-foreground">{title}</h1>
              {subtitle && <p className="text-xs" style={{ color: "#525252" }}>{subtitle}</p>}
            </div>
          </header>
          <DeletionPendingBanner />
          <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
            {children}
            <PortalFooter />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-inter bg-white">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-58 flex flex-col
        transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:flex
      `} style={{ width: 224, background: "#FAFAFA", borderRight: "1px solid #E3E3E3" }}>

        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "#E3E3E3" }}>
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="w-full max-w-[168px] object-contain"
            style={{ height: 32 }}
          />
          {/* Search bar */}
          <div className="mt-3 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
            <input
              type="text"
              placeholder="Search menu..."
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "#FFFFFF", border: "1px solid #E3E3E3", color: "#0A0A0F" }}
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {user?.role === "owner" && !navSearch && (
            <>
              <Link
                to="/team-kpis"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/team-kpis"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/team-kpis" ? {} : { color: "#525252" }}
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                Team KPIs
              </Link>
              <Link
                to="/onboarding-submissions"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/onboarding-submissions"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/onboarding-submissions" ? {} : { color: "#525252" }}
              >
                <FormInput className="w-4 h-4 shrink-0" />
                Onboarding Forms
              </Link>
              <Link
                to="/monthly-reports"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/monthly-reports"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/monthly-reports" ? {} : { color: "#525252" }}
              >
                <LineChart className="w-4 h-4 shrink-0" />
                Monthly Reports
              </Link>
              <Link
                to="/team-oversight"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/team-oversight"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/team-oversight" ? {} : { color: "#525252" }}
              >
                <Eye className="w-4 h-4 shrink-0" />
                Team Performance
              </Link>
              <Link
                to="/email-templates"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/email-templates"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/email-templates" ? {} : { color: "#525252" }}
              >
                <MailIcon className="w-4 h-4 shrink-0" />
                Email Templates
              </Link>
              <Link
                to="/owner/financials"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/financials"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/financials" ? {} : { color: "#525252" }}
              >
                <DollarSign className="w-4 h-4 shrink-0" />
                Financials
              </Link>
              <Link
                to="/owner/reports"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/reports"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/reports" ? {} : { color: "#525252" }}
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                Reports
              </Link>
              <Link
                to="/owner/settings"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/settings"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/settings" ? {} : { color: "#525252" }}
              >
                <Settings className="w-4 h-4 shrink-0" />
                Settings
              </Link>
              <Link
                to="/debit-orders"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/debit-orders"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/debit-orders" ? {} : { color: "#525252" }}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                Debit Orders
              </Link>
              <Link
                to="/staff-productivity"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/staff-productivity"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/staff-productivity" ? {} : { color: "#525252" }}
              >
                <Timer className="w-4 h-4 shrink-0" />
                Staff Productivity
              </Link>
              <Link
                to="/owner/admin-activity"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/admin-activity"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/admin-activity" ? {} : { color: "#525252" }}
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                Admin Activity
              </Link>
              <Link
                to="/owner/staff-activity"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/staff-activity"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/staff-activity" ? {} : { color: "#525252" }}
              >
                <Users className="w-4 h-4 shrink-0" />
                Staff Activity
              </Link>
              <Link
                to="/owner/client-activity"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/client-activity"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/client-activity" ? {} : { color: "#525252" }}
              >
                <Users className="w-4 h-4 shrink-0" />
                Client Activity
              </Link>
              <Link
                to="/owner/admin-activity-log"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/admin-activity-log"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/admin-activity-log" ? {} : { color: "#525252" }}
              >
                <Users className="w-4 h-4 shrink-0" />
                Admin Activity
              </Link>
              <Link
                to="/owner/cpc-activity"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/cpc-activity"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/cpc-activity" ? {} : { color: "#525252" }}
              >
                <Users className="w-4 h-4 shrink-0" />
                CPC Activity
              </Link>
              <Link
                to="/owner/field-activity"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/field-activity"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/field-activity" ? {} : { color: "#525252" }}
              >
                <Users className="w-4 h-4 shrink-0" />
                Field Agent Activity
              </Link>
              <Link
                to="/owner/campaigns"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/campaigns"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/owner/campaigns" ? {} : { color: "#525252" }}
              >
                <Megaphone className="w-4 h-4 shrink-0" />
                Campaign Manager
              </Link>
              <Link
                to="/deliverable-quality"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/deliverable-quality"
                    ? "bg-[#0A1F44] text-white"
                    : "hover:bg-gray-100"
                }`}
                style={location.pathname === "/deliverable-quality" ? {} : { color: "#525252" }}
              >
                <Star className="w-4 h-4 shrink-0" />
                Deliverable Quality
              </Link>
              </>
              )}
          {(() => {
            const allNav = navSearch
              ? [
                  ...(user?.role === "owner" ? [
                    { path: "/team-kpis", label: "Team KPIs" },
                    { path: "/onboarding-submissions", label: "Onboarding Forms" },
                    { path: "/monthly-reports", label: "Monthly Reports" },
                    { path: "/team-oversight", label: "Team Performance" },
                    { path: "/email-templates", label: "Email Templates" },
                    { path: "/owner/financials", label: "Financials" },
                    { path: "/owner/reports", label: "Reports" },
                    { path: "/owner/settings", label: "Settings" },
                    { path: "/staff-productivity", label: "Staff Productivity" },
                    { path: "/owner/campaigns", label: "Campaign Manager" },
                    { path: "/deliverable-quality", label: "Deliverable Quality" },
                  ] : []),
                  ...(STAFF_NAV[displayRole] || OWNER_NAV),
                ].filter((item, idx, arr) => arr.findIndex(x => x.path === item.path) === idx)
              : (STAFF_NAV[displayRole] || OWNER_NAV);

            const filtered = navSearch
              ? allNav.filter(item => item.label?.toLowerCase().includes(navSearch.toLowerCase()))
              : allNav;

            return filtered.map(({ path, label, icon: Icon, badgeKey }) => {
              const active = location.pathname === path;
              const badge = badgeKey ? (navBadges[badgeKey] || 0) : 0;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => { setMobileOpen(false); setNavSearch(""); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-[#0A1F44] text-white"
                      : "hover:bg-gray-100"
                  }`}
                  style={active ? {} : { color: "#525252" }}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  {badge > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-[#E63946] text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              );
            });
          })()}
        </nav>

        {/* Owner Switch View + Client Portal */}
        <div className="p-3 border-t space-y-2" style={{ borderColor: "#E3E3E3" }}>
          {user?.role === "owner" && (
            <div className="bg-primary/10 rounded-lg p-2">
              <p className="text-xs text-muted-foreground mb-2 font-semibold">View as:</p>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    localStorage.removeItem("__owner_switched_role");
                    setSwitchedRole(null);
                  }}
                  className={`text-xs py-1.5 px-2 rounded-md transition-all text-left capitalize ${
                    !switchedRole
                      ? "bg-primary text-white"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Owner (Full Access)
                </button>
                {["field_agent", "cpc", "admin", "head_of_tech", "driver", "client"].map(role => (
                  <button
                    key={role}
                    onClick={() => toggleSwitchView(role)}
                    className={`text-xs py-1.5 px-2 rounded-md transition-all text-left capitalize ${
                      switchedRole === role
                        ? "bg-primary text-white"
                        : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {role.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}
          {switchedRole && user?.role === "owner" && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-2 text-xs text-accent">
              Viewing as <strong>{switchedRole.replace(/_/g, " ")}</strong> — Click "Owner (Full Access)" above to return
            </div>
          )}
          <Link to="/client-portal"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs hover:bg-gray-100 transition-all"
            style={{ color: "#525252" }}>
            <BarChart2 className="w-4 h-4 shrink-0" />
            Client Portal
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs hover:bg-destructive/10 hover:text-destructive transition-all w-full"
            style={{ color: "#525252" }}>
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 lg:px-6 py-4 flex items-center gap-4"
          style={{ borderBottom: "1px solid #E3E3E3", background: "#FFFFFF" }}>
          <button className="lg:hidden hover:text-foreground transition-colors" style={{ color: "#525252" }} onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <button onClick={() => navigate(-1)} className="shrink-0 hover:text-foreground transition-colors" style={{ color: "#525252" }} title="Go back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs" style={{ color: "#525252" }}>{subtitle}</p>}
          </div>
          <AdminNotificationBell />
        </header>
        <DeletionPendingBanner />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
          <PortalFooter />
        </main>
      </div>
    </div>
  );
}