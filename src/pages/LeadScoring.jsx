import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search, Zap, Star, TrendingUp, AlertCircle, RefreshCw,
  Phone, Mail, MessageSquare, ChevronDown, ChevronUp,
  Target, BarChart2, Users, Flame, Snowflake, Flag, Copy, Check
} from "lucide-react";
import { scoreLead, tierConfig, outreachTemplate } from "@/lib/leadScorer";
import { useAuth } from "@/lib/AuthContext";

const TIER_ORDER = { high_value: 0, hot: 1, warm: 2, cold: 3 };

export default function LeadScoring() {
  const { user } = useAuth();

  const [leads, setLeads]             = useState([]);
  const [clients, setClients]         = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [rescoring, setRescoring]     = useState(false);
  const [search, setSearch]           = useState("");
  const [tierFilter, setTierFilter]   = useState("all");
  const [expanded, setExpanded]       = useState(null);
  const [outreachModal, setOutreachModal] = useState(null);
  const [outreachForm, setOutreachForm] = useState({ notes: "", assigned_to: "" });
  const [saving, setSaving]           = useState(false);
  const [copied, setCopied]           = useState(false);

  const load = async () => {
    setLoading(true);
    const [l, c, s, a, u] = await Promise.all([
      base44.entities.Lead.list("-created_date", 500),
      base44.entities.Client.list(),
      base44.entities.ClientOnboardingSubmission.list(),
      base44.entities.ClientActivityLog.list("-created_date", 1000),
      base44.entities.User.list(),
    ]);
    setLeads(Array.isArray(l) ? l : []);
    setClients(Array.isArray(c) ? c : []);
    setSubmissions(Array.isArray(s) ? s : []);
    setActivityLogs(Array.isArray(a) ? a : []);
    setUsers(Array.isArray(u) ? u : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Enrich leads with scores ──────────────────────────────────
  const scoredLeads = useMemo(() => {
    return leads.map(lead => {
      const client = clients.find(c => c.email === lead.email || c.id === lead.converted_to_deal_id);
      const sub    = client ? submissions.find(s => s.client_id === client.id) : null;
      const logs   = client ? activityLogs.filter(a => a.client_id === client.id) : [];
      const { score, tier, breakdown } = scoreLead(lead, client || null, sub || null, logs);
      return { ...lead, _score: score, _tier: tier, _breakdown: breakdown, _client: client, _sub: sub };
    }).sort((a, b) => {
      // Sort by tier first, then score
      const tierDiff = (TIER_ORDER[a._tier] ?? 3) - (TIER_ORDER[b._tier] ?? 3);
      return tierDiff !== 0 ? tierDiff : b._score - a._score;
    });
  }, [leads, clients, submissions, activityLogs]);

  // ── Persist scores back to entity ────────────────────────────
  const rescore = async () => {
    setRescoring(true);
    const updates = scoredLeads.map(l =>
      base44.entities.Lead.update(l.id, {
        lead_score: l._score,
        score_tier: l._tier,
        outreach_flag: tierConfig(l._tier).flag,
        last_scored_at: new Date().toISOString(),
      })
    );
    await Promise.all(updates);
    await load();
    setRescoring(false);
  };

  // ── Filters ───────────────────────────────────────────────────
  const filtered = scoredLeads.filter(l => {
    const matchSearch = !search
      || l.business_name?.toLowerCase().includes(search.toLowerCase())
      || l.contact_person?.toLowerCase().includes(search.toLowerCase())
      || l.industry?.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === "all" || l._tier === tierFilter;
    return matchSearch && matchTier;
  });

  // ── Stats ─────────────────────────────────────────────────────
  const stats = {
    total:      scoredLeads.length,
    high_value: scoredLeads.filter(l => l._tier === "high_value").length,
    hot:        scoredLeads.filter(l => l._tier === "hot").length,
    warm:       scoredLeads.filter(l => l._tier === "warm").length,
    flagged:    scoredLeads.filter(l => l.outreach_flag).length,
    avgScore:   scoredLeads.length ? Math.round(scoredLeads.reduce((s, l) => s + l._score, 0) / scoredLeads.length) : 0,
  };

  // ── Outreach modal ────────────────────────────────────────────
  const openOutreach = (lead) => {
    setOutreachForm({ notes: lead.outreach_notes || outreachTemplate(lead, lead._tier), assigned_to: lead.outreach_assigned_to || "" });
    setOutreachModal(lead);
  };

  const saveOutreach = async () => {
    setSaving(true);
    await base44.entities.Lead.update(outreachModal.id, {
      outreach_flag: true,
      outreach_notes: outreachForm.notes,
      outreach_assigned_to: outreachForm.assigned_to,
      score_tier: outreachModal._tier,
      lead_score: outreachModal._score,
      last_scored_at: new Date().toISOString(),
    });
    setSaving(false);
    setOutreachModal(null);
    await load();
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(outreachForm.notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout title="Lead Scoring" subtitle="Engagement-based prospect intelligence">
      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={Users}    label="Total Leads"    value={stats.total}      color="text-muted-foreground" />
        <StatCard icon={Star}     label="High Value"     value={stats.high_value} color="text-[#f59e0b]" />
        <StatCard icon={Flame}    label="Hot"            value={stats.hot}        color="text-destructive" />
        <StatCard icon={TrendingUp} label="Warm"         value={stats.warm}       color="text-primary" />
        <StatCard icon={Flag}     label="Flagged"        value={stats.flagged}    color="text-accent" />
        <StatCard icon={BarChart2} label="Avg Score"     value={`${stats.avgScore}/100`} color="text-primary" />
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
            <SelectValue placeholder="All tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="high_value">⭐ High Value</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">🌡 Warm</SelectItem>
            <SelectItem value="cold">❄️ Cold</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={rescore} disabled={rescoring} variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 shrink-0">
          <RefreshCw className={`w-4 h-4 mr-2 ${rescoring ? "animate-spin" : ""}`} />
          {rescoring ? "Scoring…" : "Re-Score All"}
        </Button>
      </div>

      {/* ── Lead Cards ── */}
      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No leads match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const cfg  = tierConfig(lead._tier);
            const isExp = expanded === lead.id;
            return (
              <div key={lead.id} className={`glass rounded-xl transition-all border ${lead.outreach_flag ? "border-accent/30" : "border-transparent"}`}>
                {/* ── Row ── */}
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : lead.id)}>
                  {/* Score ring */}
                  <div className="shrink-0 relative w-12 h-12">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={lead._tier === "high_value" ? "#f59e0b" : lead._tier === "hot" ? "#ef4444" : lead._tier === "warm" ? "#a764e6" : "#6b7280"}
                        strokeWidth="3" strokeDasharray={`${(lead._score / 100) * 94} 94`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{lead._score}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{lead.business_name}</p>
                      {lead.outreach_flag && <Flag className="w-3 h-3 text-accent shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.contact_person} · {lead.industry || "—"} · <span className="capitalize">{lead.source?.replace(/_/g, " ")}</span>
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <Badge className={`border text-xs ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dot}`} />
                      {cfg.label}
                    </Badge>
                    <Badge className={`border text-xs capitalize ${
                      lead.status === "verified" ? "bg-success/15 text-success border-success/30" :
                      lead.status === "converted" ? "bg-primary/15 text-primary border-primary/30" :
                      "bg-muted/40 text-muted-foreground border-border/40"
                    }`}>{lead.status?.replace(/_/g, " ")}</Badge>
                  </div>

                  {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>

                {/* ── Expanded Detail ── */}
                {isExp && (
                  <div className="border-t border-border/30 p-4 space-y-4 animate-fade-in">
                    {/* Score breakdown */}
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Score Breakdown</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <ScoreBar label="Warm Criteria" value={lead._breakdown.warmCriteria} max={35} color="bg-primary" />
                        <ScoreBar label="Portal Activity" value={lead._breakdown.portalActivity} max={25} color="bg-[#00CCFF]" />
                        <ScoreBar label="Onboarding" value={lead._breakdown.onboarding} max={25} color="bg-success" />
                        <ScoreBar label="Lead Source" value={lead._breakdown.source} max={15} color="bg-accent" />
                      </div>
                    </div>

                    {/* Warm criteria checklist */}
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Qualification Criteria</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          ["has_business_premises",    "Business premises"],
                          ["has_trading_history",      "Trading history"],
                          ["decision_maker_contacted", "Decision maker"],
                          ["expressed_interest",       "Expressed interest"],
                          ["has_budget_indication",    "Budget indicated"],
                          ["not_existing_client",      "Not existing client"],
                          ["valid_contact_details",    "Valid contacts"],
                        ].map(([k, lbl]) => (
                          <div key={k} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${lead.warm_lead_criteria?.[k] ? "bg-success" : "bg-muted/50"}`} />
                            <span className={`text-xs ${lead.warm_lead_criteria?.[k] ? "text-foreground" : "text-muted-foreground"}`}>{lbl}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contact + outreach */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {lead.phone && (
                        <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10 text-xs gap-1.5">
                            <Phone className="w-3 h-3" /> WhatsApp
                          </Button>
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`}>
                          <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 text-xs gap-1.5">
                            <Mail className="w-3 h-3" /> Email
                          </Button>
                        </a>
                      )}
                      {(lead._tier === "high_value" || lead._tier === "hot") && (
                        <Button size="sm" className="gradient-bg text-white text-xs gap-1.5 hover:opacity-90 ml-auto"
                          onClick={() => openOutreach(lead)}>
                          <MessageSquare className="w-3 h-3" />
                          {lead.outreach_flag ? "Update Outreach" : "Flag & Plan Outreach"}
                        </Button>
                      )}
                      {lead._tier === "warm" && !lead.outreach_flag && (
                        <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 text-xs gap-1.5 ml-auto"
                          onClick={() => openOutreach(lead)}>
                          <Flag className="w-3 h-3" /> Flag for Outreach
                        </Button>
                      )}
                    </div>

                    {lead.outreach_notes && (
                      <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-accent mb-1">Outreach Plan</p>
                        <p className="text-xs text-foreground">{lead.outreach_notes}</p>
                        {lead.outreach_assigned_to && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Assigned to: {users.find(u => u.id === lead.outreach_assigned_to)?.full_name || lead.outreach_assigned_to}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Outreach Modal ── */}
      <Dialog open={!!outreachModal} onOpenChange={() => setOutreachModal(null)}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gradient-text">Plan Outreach — {outreachModal?.business_name}</DialogTitle>
          </DialogHeader>
          {outreachModal && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3 p-3 glass rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  outreachModal._tier === "high_value" ? "bg-[#f59e0b]" : outreachModal._tier === "hot" ? "bg-destructive" : "bg-primary"
                }`}>{outreachModal._score}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{outreachModal.contact_person}</p>
                  <p className="text-xs text-muted-foreground">{outreachModal.business_name} · {tierConfig(outreachModal._tier).label}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Outreach Message / Notes</Label>
                  <button onClick={copyMessage} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <Textarea
                  value={outreachForm.notes}
                  onChange={e => setOutreachForm(f => ({ ...f, notes: e.target.value }))}
                  className="bg-secondary/50 border-border/50 h-28 text-sm"
                  placeholder="Describe the personalized outreach plan or message…"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Assign To</Label>
                <Select value={outreachForm.assigned_to} onValueChange={v => setOutreachForm(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select a sales team member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => ["field_agent", "cpc", "admin", "owner"].includes(u.role)).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.role?.replace(/_/g, " ")})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOutreachModal(null)}>Cancel</Button>
                <Button onClick={saveOutreach} disabled={saving} className="gradient-bg text-white hover:opacity-90">
                  {saving ? "Saving…" : "Flag & Save Outreach"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <Icon className={`w-5 h-5 shrink-0 ${color}`} />
      <div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-muted/40 rounded-full">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}