import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, TrendingUp, Zap, DollarSign, FileText, BarChart2, Menu, X, MessageSquare, Receipt, Calendar, ClipboardList, Mail, UserCircle, Package, UserCog, PlusCircle, ListChecks, CheckSquare, Eye, File } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/log-sale", label: "Log a Sale", icon: PlusCircle },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/onboarding", label: "Onboarding", icon: ListChecks },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/deals", label: "Deals", icon: TrendingUp },
  { path: "/leads", label: "Leads", icon: Zap },
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
];

export default function AppLayout({ children, title, subtitle }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

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
          )}
          {NAV.map(({ path, label, icon: Icon }) => {
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

        {/* Client portal link */}
        <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <Link to="/client-portal"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs hover:bg-white/5 transition-all"
            style={{ color: "#6b6b85" }}>
            <BarChart2 className="w-4 h-4 shrink-0" />
            Client Portal
          </Link>
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