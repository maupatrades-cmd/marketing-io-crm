import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, User, TrendingUp, DollarSign, FileText, Zap, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const EVENT_ICONS = {
  deal: TrendingUp,
  lead: Zap,
  invoice: FileText,
  commission: DollarSign,
  client: User,
  default: Clock,
};

const EVENT_COLORS = {
  closed_won: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  closed_lost: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#ef4444" },
  pending_verification: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
  verified: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  failed: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#ef4444" },
  paid: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  default: { bg: "rgba(167,100,230,0.12)", border: "rgba(167,100,230,0.3)", text: "#a764e6" },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivityLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      base44.entities.Deal.list("-updated_date", 50),
      base44.entities.Lead.list("-updated_date", 50),
      base44.entities.Invoice.list("-updated_date", 50),
      base44.entities.Commission.list("-updated_date", 50),
    ]).then(([deals, leads, invoices, commissions]) => {
      const all = [
        ...deals.map(d => ({
          id: d.id, type: "deal", icon: "deal",
          label: `Deal · ${d.client_name || "Unknown"}`,
          detail: `Stage: ${d.stage?.replace(/_/g, " ")}`,
          status: d.stage, time: d.updated_date || d.created_date,
          actor: d.closer_name,
        })),
        ...leads.map(l => ({
          id: l.id, type: "lead", icon: "lead",
          label: `Lead · ${l.business_name}`,
          detail: `Status: ${l.status?.replace(/_/g, " ")}`,
          status: l.status, time: l.updated_date || l.created_date,
          actor: l.submitted_by_name,
        })),
        ...invoices.map(i => ({
          id: i.id, type: "invoice", icon: "invoice",
          label: `Invoice · ${i.client_name || "Unknown"}`,
          detail: `R${(i.total_amount || i.amount || 0).toLocaleString()} · ${i.status}`,
          status: i.status, time: i.updated_date || i.created_date,
          actor: null,
        })),
        ...commissions.map(c => ({
          id: c.id, type: "commission", icon: "commission",
          label: `Commission · ${c.staff_name || c.client_name || "—"}`,
          detail: `R${(c.commission_amount || 0).toLocaleString()} · ${c.status}`,
          status: c.status, time: c.updated_date || c.created_date,
          actor: c.staff_name,
        })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 120);
      setEvents(all);
      setLoading(false);
    });
  }, []);

  const filtered = events.filter(e =>
    !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.detail?.toLowerCase().includes(search.toLowerCase()) || e.actor?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Activity Log" subtitle="Recent CRM events across deals, leads & invoices">
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Filter activity…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
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