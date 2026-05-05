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
  Bell
} from 'lucide-react';
import { destroySession } from '@/lib/customAuth';

const SIDEBAR_BG = '#0f172a';
const HOVER_BG = 'rgba(255,255,255,0.04)';
const ACTIVE_GRADIENT = 'linear-gradient(90deg, rgba(167,100,230,0.18), rgba(236,72,153,0.18))';

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
      className="relative flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm transition"
      style={{
        background: active ? ACTIVE_GRADIENT : 'transparent',
        color: color || (active ? '#f4f4fa' : '#a8a8c0')
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = HOVER_BG; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {badge > 0 && (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-rose-500 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function NavButton({ label, Icon, onClick, color = '#a8a8c0' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm transition text-left"
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

  const handleSignOut = async () => {
    try {
      await destroySession(user?.id);
    } catch (err) {
      console.error('[ClientSidebar] signout failed:', err);
    }
    window.location.href = '/login';
  };

  const stage = client?.lifecycle_stage || 'lead';
  const stageColor = stage === 'active'
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : stage === 'qualified'
      ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
      : 'bg-slate-700/50 text-slate-300 border-slate-600/40';

  const closeOnNav = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg"
        style={{ background: SIDEBAR_BG, color: '#f4f4fa', border: '1px solid rgba(255,255,255,0.07)' }}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/70"
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
          borderRight: '1px solid rgba(255,255,255,0.07)'
        }}
      >
        {/* Logo + subtitle */}
        <div
          className="px-5 py-5 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#a764e6 0%,#ec4899 100%)' }}
          >
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Marketing iO</p>
            <p className="text-[11px] text-slate-400 leading-tight">Client Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {PRIMARY_NAV.map(({ path, label, icon: Icon, badgeKey }) => (
            <NavRow
              key={path}
              to={path}
              label={label}
              Icon={Icon}
              badge={badgeKey ? (unreadCounts[badgeKey] || 0) : 0}
              active={location.pathname === path || (path === '/client-portal' && location.pathname === '/')}
              onNavigate={closeOnNav}
            />
          ))}

          <div className="my-3 mx-4" style={{ height: 0.5, background: 'rgba(255,255,255,0.08)' }} />

          <NavButton label="Contact us" Icon={Phone} onClick={() => { onContact(); closeOnNav(); }} />
          <NavRow
            to="/client/settings"
            label="Settings"
            Icon={Settings}
            active={location.pathname === '/client/settings'}
            onNavigate={closeOnNav}
          />
          <NavButton label="Sign out" Icon={LogOut} onClick={handleSignOut} color="#f87171" />
        </nav>

        {/* Profile card */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div
            className="flex items-center gap-3 px-2 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#a764e6,#ec4899)' }}
            >
              {initials(client, user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {client?.business_name || user?.full_name || user?.email || '—'}
              </p>
              <span className={`mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${stageColor}`}>
                {stage}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
