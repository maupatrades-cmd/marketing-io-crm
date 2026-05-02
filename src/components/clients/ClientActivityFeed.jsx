import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRight, CheckCircle2, MessageSquare, Loader2, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TYPE_CONFIG = {
  status_change: { icon: ArrowRight, color: "#a764e6", bg: "rgba(167,100,230,0.12)", border: "rgba(167,100,230,0.3)" },
  milestone:     { icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  task_completed:{ icon: ListChecks, color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
  note:          { icon: MessageSquare, color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
};

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function ClientActivityFeed({ clientId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ClientActivityLog
      .filter({ client_id: clientId }, "-created_date", 50)
      .then(d => { setLogs(d); setLoading(false); });
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading activity…
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <MessageSquare className="w-3 h-3" /> No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-3.5 top-2 bottom-2 w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="space-y-2 pl-9">
        {logs.map((log, i) => {
          const cfg = TYPE_CONFIG[log.event_type] || TYPE_CONFIG.note;
          const Icon = cfg.icon;
          return (
            <div key={log.id || i} className="relative">
              <div className="absolute -left-5 top-2.5 w-2.5 h-2.5 rounded-full border-2 shrink-0"
                style={{ background: cfg.bg, borderColor: cfg.color }} />
              <div className="glass rounded-xl p-3 flex items-start gap-3 hover:border-white/15 transition-all">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-snug">{log.event_label}</p>
                  {log.from_value && log.to_value && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="capitalize">{log.from_value.replace(/_/g, " ")}</span>
                      {" → "}
                      <span className="capitalize">{log.to_value.replace(/_/g, " ")}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(log.created_date)}</p>
                </div>
                <Badge className="text-[10px] border capitalize shrink-0 mt-0.5"
                  style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                  {log.event_type.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}