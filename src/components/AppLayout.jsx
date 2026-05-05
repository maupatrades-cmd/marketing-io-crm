import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, TrendingUp, Zap, DollarSign, FileText, BarChart2, Menu, X, MessageSquare, Receipt, Calendar, ClipboardList, Mail, UserCircle, Package, UserCog, PlusCircle, ListChecks, CheckSquare, Eye, File, FormInput, LineChart, Mail as MailIcon, BookOpen, Clock, Send, Briefcase, CheckCircle2, LogOut, Settings, Timer, Star, Target, Megaphone } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import ClientSidebar from "@/components/ClientSidebar";

const STAFF_NAV = {
  field_agent: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/staff/pipeline", label: "My Pipeline", icon: TrendingUp },
    { path: "/staff/clients", label: "My Clients", icon: Users },
    { path: "/leads", label: "Add Lead", icon: PlusCircle },
    { path: "/lead-scoring", label: "Lead Scoring", icon: Target },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/staff/communications", label: "Communications", icon: Send },
    { path: "/commissions", label: "My Commissions", icon: DollarSign },
    { path: "/my-kpis", label: "My KPIs", icon: BarChart2 },
    { path: "/playbooks", label: "Playbooks", icon: BookOpen },
    { path: "/profile", label: "Profile", icon: UserCircle },
  ],
  cpc: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/staff/pipeline", label: "My Pipeline", icon: TrendingUp },
    { path: "/leads", label: "My Leads", icon: Zap },
    { path: "/lead-scoring", label: "Lead Scoring", icon: Target },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/staff/communications", label: "Communications", icon: Send },
    { path: "/commissions", label: "My Commissions", icon: DollarSign },
    { path: "/my-kpis", label: "My KPIs", icon: BarChart2 },
    { path: "/playbooks", label: "Playbooks", icon: BookOpen },
    { path: "/profile", label: "Profile", icon: UserCircle },
  ],
  admin: [
    { path: "/staff", label: "My Day", icon: Clock },
    { path: "/staff/verify-leads", label: "Verify Leads", icon: CheckCircle2 },
    { path: "/onboarding", label: "Onboarding Queue", icon: ListChecks },
    { path: "/contracts", label: "Contracts", icon: File },
    { path: "/invoices", label: "Invoices", icon: FileText },
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
  { path: "/invoices", label: "Invoices", icon: FileText },
  { path: "/receipts", label: "Receipts", icon: Receipt },
  { path: "/contracts", label: "Contracts", icon: File },
  { path: "/activity", label: "Activity Log", icon: MessageSquare },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/payroll", label: "Payroll Report", icon: ClipboardList },
  { path: "/staff", label: "Staff & HR", icon: UserCog },
  { path: "/products", label: "Products", icon: Package },
  { path: "/mail", label: "Internal Mail", icon: Mail },
  { path: "/profile", label: "My Profile", icon: UserCircle },
  { path: "/deliverables", label: "Deliverables", icon: CheckSquare },
];

export default function AppLayout({ children, title, subtitle }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const [switchedRole, setSwitchedRole] = useState(null);
  
  useEffect(() => {
    const stored = localStorage.getItem("__owner_switched_role");
    setSwitchedRole(stored);
  }, []);

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
      <div className="min-h-screen flex font-inter" style={{ background: "transparent" }}>
        <ClientSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="px-4 lg:px-6 py-4 flex items-center gap-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,20,0.6)", backdropFilter: "blur(10px)" }}>
            <div>
              <h1 className="text-base font-bold" style={{ color: "#f4f4fa" }}>{title}</h1>
              {subtitle && <p className="text-xs" style={{ color: "#6b6b85" }}>{subtitle}</p>}
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-inter" style={{ background: "transparent" }}>
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-58 flex flex-col
        transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:flex
      `} style={{ width: 224, background: "rgba(10,10,20,0.95)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="w-full max-w-[168px] object-contain"
            style={{ filter: "invert(1) brightness(2)", mixBlendMode: "screen" }}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {user?.role === "owner" && (
            <>
              <Link
                to="/team-kpis"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/team-kpis"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/team-kpis" ? {} : { color: "#a8a8c0" }}
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                Team KPIs
              </Link>
              <Link
                to="/onboarding-submissions"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/onboarding-submissions"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/onboarding-submissions" ? {} : { color: "#a8a8c0" }}
              >
                <FormInput className="w-4 h-4 shrink-0" />
                Onboarding Forms
              </Link>
              <Link
                to="/monthly-reports"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/monthly-reports"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/monthly-reports" ? {} : { color: "#a8a8c0" }}
              >
                <LineChart className="w-4 h-4 shrink-0" />
                Monthly Reports
              </Link>
              <Link
                to="/team-oversight"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/team-oversight"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/team-oversight" ? {} : { color: "#a8a8c0" }}
              >
                <Eye className="w-4 h-4 shrink-0" />
                Team Performance
              </Link>
              <Link
                to="/email-templates"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/email-templates"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/email-templates" ? {} : { color: "#a8a8c0" }}
              >
                <MailIcon className="w-4 h-4 shrink-0" />
                Email Templates
              </Link>
              <Link
                to="/owner/financials"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/financials"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/owner/financials" ? {} : { color: "#a8a8c0" }}
              >
                <DollarSign className="w-4 h-4 shrink-0" />
                Financials
              </Link>
              <Link
                to="/owner/reports"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/reports"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/owner/reports" ? {} : { color: "#a8a8c0" }}
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                Reports
              </Link>
              <Link
                to="/owner/settings"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/settings"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/owner/settings" ? {} : { color: "#a8a8c0" }}
              >
                <Settings className="w-4 h-4 shrink-0" />
                Settings
              </Link>
              <Link
                to="/staff-productivity"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/staff-productivity"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/staff-productivity" ? {} : { color: "#a8a8c0" }}
              >
                <Timer className="w-4 h-4 shrink-0" />
                Staff Productivity
              </Link>
              <Link
                to="/owner/campaigns"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/owner/campaigns"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/owner/campaigns" ? {} : { color: "#a8a8c0" }}
              >
                <Megaphone className="w-4 h-4 shrink-0" />
                Campaign Manager
              </Link>
              <Link
                to="/deliverable-quality"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === "/deliverable-quality"
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={location.pathname === "/deliverable-quality" ? {} : { color: "#a8a8c0" }}
              >
                <Star className="w-4 h-4 shrink-0" />
                Deliverable Quality
              </Link>
              </>
              )}
          {(STAFF_NAV[displayRole] || OWNER_NAV).map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "hover:bg-white/5"
                }`}
                style={active ? {} : { color: "#a8a8c0" }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Owner Switch View + Client Portal */}
        <div className="p-3 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs hover:bg-white/5 transition-all"
            style={{ color: "#6b6b85" }}>
            <BarChart2 className="w-4 h-4 shrink-0" />
            Client Portal
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs hover:bg-destructive/10 hover:text-destructive transition-all w-full"
            style={{ color: "#6b6b85" }}>
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 lg:px-6 py-4 flex items-center gap-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,20,0.6)", backdropFilter: "blur(10px)" }}>
          <button className="lg:hidden hover:text-white transition-colors" style={{ color: "#6b6b85" }} onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="text-base font-bold" style={{ color: "#f4f4fa" }}>{title}</h1>
            {subtitle && <p className="text-xs" style={{ color: "#6b6b85" }}>{subtitle}</p>}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}