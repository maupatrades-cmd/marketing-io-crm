import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ClipboardList, CheckCircle2, Circle, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import OnboardingDetail from "@/components/onboarding/OnboardingDetail";

const PHASE_LABELS = {
  phase1_contract_signed:   "Phase 1 · Contract",
  phase2_welcome_invoicing: "Phase 2 · Welcome",
  phase3_pre_onboarding:    "Phase 3 · Pre-Onboard",
  phase4_onboarding_call:   "Phase 4 · Call",
  phase5_asset_collection:  "Phase 5 · Assets",
  phase6_delivery_start:    "Phase 6 · Delivery",
};

const PHASE_COLORS = {
  phase1_contract_signed:   "bg-warning/15 text-warning border-warning/30",
  phase2_welcome_invoicing: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  phase3_pre_onboarding:    "bg-primary/15 text-primary border-primary/30",
  phase4_onboarding_call:   "bg-accent/15 text-accent border-accent/30",
  phase5_asset_collection:  "bg-warning/15 text-warning border-warning/30",
  phase6_delivery_start:    "bg-success/15 text-success border-success/30",
};

const STATUS_COLORS = {
  in_progress: "bg-primary/15 text-primary border-primary/30",
  blocked:     "bg-destructive/15 text-destructive border-destructive/30",
  completed:   "bg-success/15 text-success border-success/30",
};

const TRIGGERS = [
  { field: "trigger_setup_fee_paid",            short: "Fee" },
  { field: "trigger_onboarding_form_returned",  short: "Form" },
  { field: "trigger_debit_mandate_signed",      short: "Debit" },
  { field: "trigger_brand_assets_received",     short: "Assets" },
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

export default function ClientOnboarding() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = () =>
    base44.entities.ClientOnboarding.list("-created_date", 200)
      .then(r => { setRecords(r); setLoading(false); });

  useEffect(() => { load(); }, []);

  const filtered = records.filter(r => {
    const matchSearch = !search || r.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.overall_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleUpdate = (updated) => {
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (selected?.id === updated.id) setSelected(updated);
  };

  const counts = {
    all: records.length,
    in_progress: records.filter(r => r.overall_status === "in_progress").length,
    blocked: records.filter(r => r.overall_status === "blocked").length,
    completed: records.filter(r => r.overall_status === "completed").length,
  };

  return (
    <AppLayout title="Client Onboarding" subtitle={`${counts.in_progress} in progress`}>
      {/* Summary strip */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
        {[
          { key: "all", label: "All", count: counts.all },
          { key: "in_progress", label: "In Progress", count: counts.in_progress },
          { key: "blocked", label: "Blocked", count: counts.blocked },
          { key: "completed", label: "Completed", count: counts.completed },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`flex-shrink-0 glass rounded-lg px-4 py-2 text-center border transition-all ${statusFilter === s.key ? "border-primary/60 shadow-glow-purple" : "border-border/30 hover:border-border/60"}`}>
            <p className="text-lg font-bold text-foreground">{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search client…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No onboarding records found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Onboardings are created automatically when a deal is logged as closed-won.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const days = daysSince(r.deal_won_date || r.created_date);
            const allTriggers = TRIGGERS.every(t => r[t.field]);
            return (
              <div key={r.id} onClick={() => setSelected(r)}
                className="glass rounded-xl p-4 cursor-pointer hover:shadow-card-hover transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{r.client_name?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{r.client_name}</p>
                      <Badge className={`border text-xs ${PHASE_COLORS[r.current_phase] || "bg-muted/40"}`}>
                        {PHASE_LABELS[r.current_phase] || r.current_phase}
                      </Badge>
                      <Badge className={`border text-xs ${STATUS_COLORS[r.overall_status] || ""} capitalize`}>
                        {r.overall_status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Admin: {r.assigned_admin_name || "Unassigned"}
                      {days !== null && <span className="ml-2 flex items-center gap-1 inline-flex"><Clock className="w-3 h-3" /> Day {days}</span>}
                    </p>
                  </div>
                  {/* 4-trigger dots */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {TRIGGERS.map(t => (
                      <div key={t.field} title={t.short}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${r[t.field] ? "bg-success/20 border-success/50 text-success" : "bg-muted/30 border-border/30 text-muted-foreground"}`}>
                        {r[t.field] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      </div>
                    ))}
                    {allTriggers && (
                      <Badge className="ml-1 text-xs border bg-success/15 text-success border-success/30">Gate ✓</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <OnboardingDetail
          record={selected}
          onUpdate={handleUpdate}
          onClose={() => setSelected(null)}
        />
      )}
    </AppLayout>
  );
}