import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, User, TrendingUp, DollarSign, FileText, Zap, Clock, CheckSquare, FileCheck, Users } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const EVENT_ICONS = {
  deal: TrendingUp,
  lead: Zap,
  invoice: FileText,
  commission: DollarSign,
  client: User,
  task: CheckSquare,
  deliverable: FileCheck,
  contract: FileText,
  default: Clock,
};

const EVENT_COLORS = {
  closed_won: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  closed_lost: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#ef4444" },
  pending_verification: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
  verified: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  failed: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#ef4444" },
  paid: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  done: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  in_progress: { bg: "rgba(59,182,246,0.12)", border: "rgba(59,182,246,0.3)", text: "#3b82f6" },
  open: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
  approved: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  default: { bg: "rgba(167,100,230,0.12)", border: "rgba(167,100,230,0.3)", text: "#a764e6" },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getDateRangeFilter(days) {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return start;
}

export default function ActivityLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [daysFilter, setDaysFilter] = useState(7);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const cutoffDate = getDateRangeFilter(daysFilter);
      
      try {
        const [deals, leads, invoices, commissions, tasks, deliverables, contracts, clientActivities, users] = await Promise.all([
          base44.entities.Deal.list("-updated_date", 100),
          base44.entities.Lead.list("-updated_date", 100),
          base44.entities.Invoice.list("-updated_date", 100),
          base44.entities.Commission.list("-updated_date", 100),
          base44.entities.Task.list("-updated_date", 100),
          base44.entities.Deliverable.list("-updated_date", 100),
          base44.entities.Contract.list("-updated_date", 100),
          base44.entities.ClientActivityLog.list("-created_date", 200),
          base44.entities.User.list(),
        ]);

        setStaffList(users || []);

        const all = [
          ...deals
            .filter(d => new Date(d.updated_date || d.created_date) > cutoffDate)
            .map(d => ({
              id: d.id, type: "deal", icon: "deal",
              label: `Deal · ${d.client_name || "Unknown"}`,
              detail: `Stage: ${d.stage?.replace(/_/g, " ")}`,
              status: d.stage, time: d.updated_date || d.created_date,
              actor: d.closer_name, actorId: d.closer_id,
            })),
          ...leads
            .filter(l => new Date(l.updated_date || l.created_date) > cutoffDate)
            .map(l => ({
              id: l.id, type: "lead", icon: "lead",
              label: `Lead · ${l.business_name}`,
              detail: `Status: ${l.status?.replace(/_/g, " ")}`,
              status: l.status, time: l.updated_date || l.created_date,
              actor: l.submitted_by_name, actorId: l.submitted_by,
            })),
          ...invoices
            .filter(i => new Date(i.updated_date || i.created_date) > cutoffDate)
            .map(i => ({
              id: i.id, type: "invoice", icon: "invoice",
              label: `Invoice · ${i.client_name || "Unknown"}`,
              detail: `R${(i.total_amount || i.amount || 0).toLocaleString()} · ${i.status}`,
              status: i.status, time: i.updated_date || i.created_date,
              actor: null,
            })),
          ...commissions
            .filter(c => new Date(c.updated_date || c.created_date) > cutoffDate)
            .map(c => ({
              id: c.id, type: "commission", icon: "commission",
              label: `Commission · ${c.staff_name || c.client_name || "—"}`,
              detail: `R${(c.commission_amount || 0).toLocaleString()} · ${c.status}`,
              status: c.status, time: c.updated_date || c.created_date,
              actor: c.staff_name, actorId: c.staff_id,
            })),
          ...tasks
            .filter(t => new Date(t.updated_date || t.created_date) > cutoffDate)
            .map(t => ({
              id: t.id, type: "task", icon: "task",
              label: `Task · ${t.title}`,
              detail: `Status: ${t.status?.replace(/_/g, " ")}`,
              status: t.status, time: t.updated_date || t.created_date,
              actor: t.assigned_to_name, actorId: t.assigned_to,
            })),
          ...deliverables
            .filter(d => new Date(d.updated_date || d.created_date) > cutoffDate)
            .map(d => ({
              id: d.id, type: "deliverable", icon: "deliverable",
              label: `Deliverable · ${d.title}`,
              detail: `Status: ${d.status?.replace(/_/g, " ")}`,
              status: d.status, time: d.updated_date || d.created_date,
              actor: d.assigned_to_name, actorId: d.assigned_to,
            })),
          ...contracts
            .filter(c => new Date(c.updated_date || c.created_date) > cutoffDate)
            .map(c => ({
              id: c.id, type: "contract", icon: "contract",
              label: `Contract · ${c.client_name || "Unknown"}`,
              detail: `Status: ${c.status?.replace(/_/g, " ")}`,
              status: c.status, time: c.updated_date || c.created_date,
              actor: null,
            })),
          ...clientActivities
            .filter(ca => new Date(ca.created_date) > cutoffDate)
            .map(ca => ({
              id: ca.id, type: "client", icon: "client",
              label: `Client Activity · ${ca.client_name || "Unknown"}`,
              detail: `${ca.event_summary || ca.event_type}`,
              status: ca.event_category || "default", time: ca.created_date,
              actor: ca.logged_by_name || ca.actor_role, actorId: ca.actor_id,
            })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time));

        setEvents(all);
      } catch (err) {
        console.error("Error loading activity:", err);
      }
      setLoading(false);
    };

    loadData();
  }, [daysFilter]);

  const filtered = events.filter(e => {
    const matchesSearch = !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.detail?.toLowerCase().includes(search.toLowerCase()) || e.actor?.toLowerCase().includes(search.toLowerCase());
    const matchesStaff = !selectedStaff || e.actorId === selectedStaff;
    return matchesSearch && matchesStaff;
  });

  return (
    <AppLayout title="Activity Log" subtitle="Recent CRM events across all entities">
      <div className="mb-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search activity…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
          </div>
          <select value={daysFilter} onChange={e => setDaysFilter(parseInt(e.target.value))} className="px-3 py-2 rounded-lg text-sm bg-secondary/50 border border-border/50 text-foreground">
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Staff Tabs */}
        {staffList.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedStaff(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedStaff === null
                  ? "bg-primary text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              All Staff
            </button>
            {staffList.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStaff(s.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedStaff === s.id
                    ? "bg-primary text-white"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3" style={{ color: "#6b6b85" }} />
          <p style={{ color: "#a8a8c0" }}>No activity found</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="space-y-1 pl-12">
            {filtered.map((ev, i) => {
              const Icon = EVENT_ICONS[ev.icon] || EVENT_ICONS.default;
              const col = EVENT_COLORS[ev.status] || EVENT_COLORS.default;
              return (
                <div key={ev.id + i} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-7 top-3.5 w-3 h-3 rounded-full border-2"
                    style={{ background: col.bg, borderColor: col.text }} />
                  <div className="glass rounded-xl p-3.5 flex items-center gap-3 hover:border-white/15 transition-all">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                      <Icon className="w-4 h-4" style={{ color: col.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#f4f4fa" }}>{ev.label}</p>
                      <p className="text-xs" style={{ color: "#a8a8c0" }}>{ev.detail}{ev.actor ? ` · by ${ev.actor}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="text-[10px] px-2 py-0.5 border capitalize" style={{ background: col.bg, color: col.text, borderColor: col.border }}>
                        {ev.status?.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs" style={{ color: "#6b6b85" }}>{ev.time ? timeAgo(ev.time) : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
}