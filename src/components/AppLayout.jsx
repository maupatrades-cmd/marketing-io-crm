import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, TrendingUp, Zap, DollarSign, FileText, BarChart2, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/deals", label: "Deals", icon: TrendingUp },
  { path: "/leads", label: "Leads", icon: Zap },
  { path: "/commissions", label: "Commissions", icon: DollarSign },
  { path: "/invoices", label: "Invoices", icon: FileText },
];

export default function AppLayout({ children, title, subtitle }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex font-inter">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-sidebar border-r border-sidebar-border flex flex-col
        transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:flex
      `}>
        <div className="p-5 border-b border-sidebar-border">
          <p className="text-base font-black gradient-text">Marketing iO</p>
          <p className="text-xs text-muted-foreground">CRM Platform</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "gradient-bg text-white shadow-glow-purple"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Link to="/client-portal" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-muted-foreground hover:bg-sidebar-accent transition-all">
            <BarChart2 className="w-4 h-4 shrink-0" />
            Client Portal
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border/40 px-4 lg:px-6 py-4 flex items-center gap-4">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}