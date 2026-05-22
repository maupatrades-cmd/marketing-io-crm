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
  visit: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  default: { bg: "rgba(167,100,230,0.12)", border: "rgba(167,100,230,0.3)", text: "#a764e6" },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function FieldActivityLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [daysFilter, setDaysFilter] = useState(7);
  const [fieldAgents, setFieldAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const cutoffDate = new Date(Date.now() - daysFilter * 24 * 60 * 60 * 1000);

      try {
        const [deals, leads, tasks, commissions, visits, users] = await Promise.all([
          base44.entities.Deal.list("-updated_date", 100),
          base44.entities.Lead.list("-updated_date", 100),
          base44.entities.Task.list("-updated_date", 100),
          base44.entities.Commission.list("-updated_date", 100),
          base44.entities.FAVisitLog.list("-visit_date", 100),
          base44.entities.User.filter({ role: "field_agent" }),
        ]);

        setFieldAgents(users || []);

        const all = [
          ...deals
            .filter(d => new Date(d.updated_date || d.created_date) > cutoffDate && (!selectedAgent || d.closer_id === selectedAgent))
            .map(d => ({
              id: d.id,
              agentId: d.closer_id,
              type: "deal",
              label: `Deal · ${d.client_name || "Unknown"}`,
              detail: `${d.package} · ${d.stage?.replace(/_/g, " ")}`,
              category: "deal",
              time: d.updated_date || d.created_date,
              actor: d.closer_name,
            })),
          ...leads
            .filter(l => new Date(l.updated_date || l.created_date) > cutoffDate && (!selectedAgent || l.submitted_by === selectedAgent))
            .map(l => ({
              id: l.id,
              agentId: l.submitted_by,
              type: "lead",
              label: `Lead · ${l.business_name}`,
              detail: `${l.status?.replace(/_/g, " ")}`,
              category: "lead",
              time: l.updated_date || l.created_date,
              actor: l.submitted_by_name,
            })),
          ...tasks
            .filter(t => new Date(t.updated_date || t.created_date) > cutoffDate && (!selectedAgent || t.assigned_to === selectedAgent) && t.title)
            .map(t => ({
              id: t.id,
              agentId: t.assigned_to,
              type: "task",
              label: `Task · ${t.title}`,
              detail: `${t.client_name || "—"} · ${t.status}`,
              category: "task",
              time: t.updated_date || t.created_date,
              actor: t.assigned_to_name,
            })),
          ...commissions
            .filter(c => new Date(c.updated_date || c.created_date) > cutoffDate && (!selectedAgent || c.staff_id === selectedAgent))
            .map(c => ({
              id: c.id,
              agentId: c.staff_id,
              type: "commission",
              label: `Commission · ${c.staff_name || "—"}`,
              detail: `R${(c.commission_amount || 0).toLocaleString()}`,
              category: "commission",
              time: c.updated_date || c.created_date,
              actor: c.staff_name,
            })),
          ...visits
            .filter(v => new Date(v.visit_date) > cutoffDate && (!selectedAgent || v.field_agent_id === selectedAgent))
            .map(v => ({
              id: v.id,
              agentId: v.field_agent_id,
              type: "visit",
              label: `Visit · ${v.prospect_name || "Client"}`,
              detail: `${v.visit_type?.replace(/_/g, " ")} · ${v.outcome?.replace(/_/g, " ")}`,
              category: "visit",
              time: v.visit_date,
            })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time));

        setEvents(all);
      } catch (err) {
        console.error("Error loading field activity:", err);
      }
      setLoading(false);
    };

    loadData();
  }, [daysFilter, selectedAgent]);

  const filtered = events.filter(e =>
    !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.detail.toLowerCase().includes(search.toLowerCase()) || e.actor?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Field Agent Activity" subtitle="Visits, deals, and tasks from field agents">
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

        {fieldAgents.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedAgent(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedAgent === null ? "bg-primary text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              All Agents
            </button>
            {fieldAgents.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAgent(a.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedAgent === a.id ? "bg-primary text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {a.full_name}
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
          <p className="text-muted-foreground">No field agent activity found</p>
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