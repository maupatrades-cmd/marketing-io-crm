import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Search, Clock, ChevronDown } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const EVENT_COLORS = {
  invoice: { bg: "rgba(59,182,246,0.12)", border: "rgba(59,182,246,0.3)", text: "#3b82f6" },
  contract: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
  payment: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
  onboarding: { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.3)", text: "#ec4899" },
  default: { bg: "rgba(167,100,230,0.12)", border: "rgba(167,100,230,0.3)", text: "#a764e6" },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-ZA", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function groupByDate(events) {
  const grouped = {};
  events.forEach(ev => {
    const dateKey = formatDate(ev.time);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(ev);
  });
  return Object.entries(grouped).reverse();
}

export default function AdminActivityLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [daysFilter, setDaysFilter] = useState(7);
  const [expandedDate, setExpandedDate] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const cutoffDate = new Date(Date.now() - daysFilter * 24 * 60 * 60 * 1000);

      try {
        const [invoices, contracts, tasks] = await Promise.all([
          base44.entities.Invoice.list("-updated_date", 100),
          base44.entities.Contract.list("-updated_date", 100),
          base44.entities.Task.list("-updated_date", 100),
        ]);

        const all = [
          ...invoices
            .filter(i => new Date(i.updated_date || i.created_date) > cutoffDate)
            .map(i => ({
              id: i.id,
              type: "invoice",
              label: `Invoice #${i.invoice_number || i.id.slice(0, 8)}`,
              detail: `${i.client_name || "Unknown"} · R${(i.total_amount || i.amount || 0).toLocaleString()} · ${i.status}`,
              category: "invoice",
              time: i.updated_date || i.created_date,
            })),
          ...contracts
            .filter(c => new Date(c.updated_date || c.created_date) > cutoffDate)
            .map(c => ({
              id: c.id,
              type: "contract",
              label: `Contract · ${c.client_name || "Unknown"}`,
              detail: `${c.package} · ${c.status}`,
              category: "contract",
              time: c.updated_date || c.created_date,
            })),
          ...tasks
            .filter(t => new Date(t.updated_date || t.created_date) > cutoffDate && t.title)
            .map(t => ({
              id: t.id,
              type: "task",
              label: `Task · ${t.title}`,
              detail: `${t.client_name || "—"} · ${t.status}`,
              category: "onboarding",
              time: t.updated_date || t.created_date,
            })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time));

        setEvents(all);
      } catch (err) {
        console.error("Error loading admin activity:", err);
      }
      setLoading(false);
    };

    loadData();
  }, [daysFilter]);

  const filtered = events.filter(e =>
    !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.detail.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = groupByDate(filtered);

  return (
    <AppLayout title="Admin Activity" subtitle="Invoices, contracts, and administrative tasks">
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
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3" style={{ color: "#6b6b85" }} />
          <p style={{ color: "#a8a8c0" }}>No admin activity found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([dateKey, dateEvents]) => (
            <div key={dateKey}>
              <Button
                variant="ghost"
                className="w-full justify-between px-4 py-3 h-auto text-left hover:bg-white/5"
                onClick={() => setExpandedDate(expandedDate === dateKey ? null : dateKey)}
              >
                <span className="font-medium text-sm">{dateKey}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] border-border/50">{dateEvents.length} activities</Badge>
                  <ChevronDown className="w-4 h-4 transition-transform" style={{ transform: expandedDate === dateKey ? "rotate(180deg)" : "rotate(0)" }} />
                </div>
              </Button>

              {expandedDate === dateKey && (
                <div className="space-y-1 pl-4 mt-2 border-l border-border/50">
                  {dateEvents.map((ev, i) => {
                    const col = EVENT_COLORS[ev.category] || EVENT_COLORS.default;
                    return (
                      <div key={ev.id + i} className="glass rounded-lg p-3 flex items-center gap-3 hover:border-white/15 transition-all">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                          <Clock className="w-3.5 h-3.5" style={{ color: col.text }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: "#f4f4fa" }}>{ev.label}</p>
                          <p className="text-xs" style={{ color: "#a8a8c0" }}>{ev.detail}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="text-[10px] px-2 py-0.5 border capitalize" style={{ background: col.bg, color: col.text, borderColor: col.border }}>
                            {ev.category}
                          </Badge>
                          <span className="text-xs" style={{ color: "#6b6b85" }}>{timeAgo(ev.time)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}