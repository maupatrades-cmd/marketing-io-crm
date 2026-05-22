import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const EVENT_COLORS = {
  deal: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  lead: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
  commission: { bg: "rgba(59,182,246,0.12)", border: "rgba(59,182,246,0.3)", text: "#3b82f6" },
  task: { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.3)", text: "#ec4899" },
  default: { bg: "rgba(167,100,230,0.12)", border: "rgba(167,100,230,0.3)", text: "#a764e6" },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function CPCActivityLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [daysFilter, setDaysFilter] = useState(7);
  const [cpcs, setCpcs] = useState([]);
  const [selectedCpc, setSelectedCpc] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const cutoffDate = new Date(Date.now() - daysFilter * 24 * 60 * 60 * 1000);

      try {
        const [deals, leads, commissions, tasks, users] = await Promise.all([
          base44.entities.Deal.list("-updated_date", 100),
          base44.entities.Lead.list("-updated_date", 100),
          base44.entities.Commission.list("-updated_date", 100),
          base44.entities.Task.list("-updated_date", 100),
          base44.entities.User.filter({ role: "cpc" }),
        ]);

        setCpcs(users || []);

        const all = [
          ...deals
            .filter(d => new Date(d.updated_date || d.created_date) > cutoffDate && (!selectedCpc || d.cpc_id === selectedCpc))
            .map(d => ({
              id: d.id,
              cpcId: d.cpc_id,
              type: "deal",
              label: `Deal · ${d.client_name || "Unknown"}`,
              detail: `${d.package} · ${d.stage?.replace(/_/g, " ")} · R${d.setup_fee || 0}`,
              category: "deal",
              time: d.updated_date || d.created_date,
              actor: d.closer_name,
            })),
          ...leads
            .filter(l => new Date(l.updated_date || l.created_date) > cutoffDate && (!selectedCpc || l.submitted_by === selectedCpc))
            .map(l => ({
              id: l.id,
              cpcId: l.submitted_by,
              type: "lead",
              label: `Lead · ${l.business_name}`,
              detail: `${l.status?.replace(/_/g, " ")} · ${l.source}`,
              category: "lead",
              time: l.updated_date || l.created_date,
              actor: l.submitted_by_name,
            })),
          ...commissions
            .filter(c => new Date(c.updated_date || c.created_date) > cutoffDate && (!selectedCpc || c.staff_id === selectedCpc))
            .map(c => ({
              id: c.id,
              cpcId: c.staff_id,
              type: "commission",
              label: `Commission · ${c.staff_name || "—"}`,
              detail: `R${(c.commission_amount || 0).toLocaleString()} · ${c.status}`,
              category: "commission",
              time: c.updated_date || c.created_date,
              actor: c.staff_name,
            })),
          ...tasks
            .filter(t => new Date(t.updated_date || t.created_date) > cutoffDate && t.title)
            .map(t => ({
              id: t.id,
              type: "task",
              label: `Task · ${t.title}`,
              detail: `${t.client_name || "—"} · ${t.status}`,
              category: "task",
              time: t.updated_date || t.created_date,
              actor: t.assigned_to_name,
            })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time));

        setEvents(all);
      } catch (err) {
        console.error("Error loading CPC activity:", err);
      }
      setLoading(false);
    };

    loadData();
  }, [daysFilter, selectedCpc]);

  const filtered = events.filter(e =>
    !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.detail.toLowerCase().includes(search.toLowerCase()) || e.actor?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="CPC Activity" subtitle="Leads, deals, and commissions from CPC team">
      <div className="mb-6 space-y-4">
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

        {cpcs.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCpc(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedCpc === null ? "bg-primary text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              All CPCs
            </button>
            {cpcs.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCpc(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCpc === c.id ? "bg-primary text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">No CPC activity found</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: "#E5E7EB" }} />
          <div className="space-y-1 pl-12">
            {filtered.map((ev, i) => {
              const col = EVENT_COLORS[ev.category] || EVENT_COLORS.default;
              return (
                <div key={ev.id + i} className="relative">
                  <div className="absolute -left-7 top-3.5 w-3 h-3 rounded-full border-2" style={{ background: col.bg, borderColor: col.text }} />
                  <div className="glass rounded-xl p-3.5 flex items-center gap-3 hover:border-border transition-all">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                      <Clock className="w-4 h-4" style={{ color: col.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{ev.label}</p>
                      <p className="text-xs text-muted-foreground">{ev.detail}{ev.actor ? ` · by ${ev.actor}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="text-[10px] px-2 py-0.5 border capitalize" style={{ background: col.bg, color: col.text, borderColor: col.border }}>
                        {ev.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground/70">{timeAgo(ev.time)}</span>
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