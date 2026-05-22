import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  ShoppingCart,
  FileText,
  FileSignature,
  MessageSquare,
  CheckCircle,
  Phone,
  Settings,
  LogOut,
  Lightbulb,
  Menu,
  X,
  Bell,
  Search,
} from 'lucide-react';
import { destroySession } from '@/lib/customAuth';
import { useState } from 'react';

const SIDEBAR_BG = '#FFFFFF';
const HOVER_BG = 'rgba(10,31,68,0.07)';
const ACTIVE_BG = '#0A1F44';

const PRIMARY_NAV = [
  { path: '/client-portal',       label: 'Dashboard',           icon: Home },
  { path: '/client/products',     label: 'Products & Services', icon: ShoppingCart },
  { path: '/client/invoices',     label: 'Invoices',            icon: FileText,      badgeKey: 'invoices' },
  { path: '/client/contracts',    label: 'Contracts',           icon: FileSignature },
  { path: '/client/messages',     label: 'Messages',            icon: MessageSquare, badgeKey: 'messages' },
  { path: '/client/activity',     label: 'Activity',            icon: Bell,          badgeKey: 'activity' },
  { path: '/client/deliverables', label: 'Deliverables',        icon: CheckCircle }
];

function initials(client, user) {
  const src = client?.business_name || client?.contact_person || user?.full_name || user?.email || '?';
  const parts = String(src).trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join('') || '?';
}

function NavRow({ to, label, Icon, badge = 0, active, onNavigate, color }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="relative flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition"
      style={{
        background: active ? ACTIVE_BG : 'transparent',
        color: color || (active ? '#FFFFFF' : '#0A1F44')
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = HOVER_BG; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {badge > 0 && (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-[#E63946] text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function NavButton({ label, Icon, onClick, color = '#0A1F44' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition text-left"
      style={{ background: 'transparent', color }}
      onMouseEnter={e => { e.currentTarget.style.background = HOVER_BG; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{label}</span>
    </button>
  );
}

export default function ClientSidebar({
  client,
  user,
  unreadCounts = {},
  mobileOpen = false,
  setMobileOpen = () => {},
  onContact = () => {}
}) {
  const location = useLocation();
  const [navSearch, setNavSearch] = useState("");

  const handleSignOut = async () => {
    try {
      await destroySession(user?.id);
    } catch (err) {
      console.error('[ClientSidebar] signout failed:', err);
    }
    window.location.href = '/login';
  };

  const closeOnNav = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg"
        style={{ background: '#FFFFFF', color: '#0A1F44', border: '1px solid #E3E3E3' }}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static`}
        style={{
          width: 240,
          background: SIDEBAR_BG,
          borderRight: '1px solid #E3E3E3'
        }}
      >
        {/* Logo + subtitle */}
        <div
          className="px-5 py-4 flex flex-col gap-3"
          style={{ borderBottom: '1px solid #E3E3E3' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#0A1F44' }}
            >
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate" style={{ color: '#E63946' }}>Marketing iO</p>
              <p className="text-[11px] leading-tight" style={{ color: '#6b7280' }}>Client Portal</p>
            </div>
          </div>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search menu..."
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "#F9FAFB", border: "1px solid #E3E3E3", color: "#0A1F44" }}
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {PRIMARY_NAV.filter(({ label }) =>
            !navSearch || label.toLowerCase().includes(navSearch.toLowerCase())
          ).map(({ path, label, icon: Icon, badgeKey }) => (
            <NavRow
              key={path}
              to={path}
              label={label}
              Icon={Icon}
              badge={badgeKey ? (unreadCounts[badgeKey] || 0) : 0}
              active={location.pathname === path || (path === '/client-portal' && location.pathname === '/')}
              onNavigate={() => { closeOnNav(); setNavSearch(""); }}
            />
          ))}

          <div className="my-3 mx-4" style={{ height: 1, background: '#E3E3E3' }} />

          <NavButton label="Contact us" Icon={Phone} onClick={() => { onContact(); closeOnNav(); }} color="#E63946" />
          <NavRow
            to="/client/settings"
            label="Settings"
            Icon={Settings}
            active={location.pathname === '/client/settings'}
            onNavigate={closeOnNav}
          />
          <NavButton label="Sign out" Icon={LogOut} onClick={handleSignOut} color="#E63946" />
        </nav>

        {/* Profile card */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid #E3E3E3' }}>
          <div
            className="flex items-center gap-3 px-2 py-2 rounded-xl"
            style={{ background: 'rgba(10,31,68,0.04)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
              style={{ background: '#0A1F44' }}
            >
              {initials(client, user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: '#0A1F44' }}>
                {client?.business_name || user?.full_name || user?.email || '—'}
              </p>
              <span className="mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(230,57,70,0.1)', color: '#E63946', border: '1px solid rgba(230,57,70,0.25)' }}>
                {client?.lifecycle_stage || 'lead'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}