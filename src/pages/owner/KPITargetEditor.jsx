import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Target, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["field_agent", "cpc", "admin", "head_of_tech", "driver"];
const UNITS = ["count", "ZAR", "%", "hours", "days"];
const PERIODS = ["daily", "weekly", "monthly", "quarterly"];
const DIRECTIONS = ["higher_is_better", "lower_is_better"];

const EMPTY = {
  metric_name: "", metric_code: "", role: "field_agent",
  target_value: "", unit: "count", target_period: "monthly",
  direction: "higher_is_better", is_active: true, is_personal: false,
};

const DEFAULT_KPIS = [
  { metric_name: "Deals Closed", metric_code: "deals_closed_monthly", role: "field_agent", target_value: 3, unit: "count", target_period: "monthly", direction: "higher_is_better", is_active: true },
  { metric_name: "Discovery Visits", metric_code: "discovery_visits_monthly", role: "field_agent", target_value: 15, unit: "count", target_period: "monthly", direction: "higher_is_better", is_active: true },
  { metric_name: "Pipeline Value", metric_code: "pipeline_value", role: "field_agent", target_value: 100000, unit: "ZAR", target_period: "monthly", direction: "higher_is_better", is_active: true },
  { metric_name: "Qualified Leads", metric_code: "qualified_leads_monthly", role: "cpc", target_value: 20, unit: "count", target_period: "monthly", direction: "higher_is_better", is_active: true },
  { metric_name: "Daily Calls", metric_code: "daily_calls", role: "cpc", target_value: 40, unit: "count", target_period: "daily", direction: "higher_is_better", is_active: true },
  { metric_name: "Closure Rate", metric_code: "closure_rate", role: "cpc", target_value: 25, unit: "%", target_period: "monthly", direction: "higher_is_better", is_active: true },
  { metric_name: "Contracts Loaded", metric_code: "contracts_loaded", role: "admin", target_value: 5, unit: "count", target_period: "monthly", direction: "higher_is_better", is_active: true },
  { metric_name: "Failed Debit Follow-ups", metric_code: "failed_debit_followups", role: "admin", target_value: 0, unit: "count", target_period: "monthly", direction: "lower_is_better", is_active: true },
  { metric_name: "Deliverables On Time", metric_code: "bucket_b_on_time", role: "head_of_tech", target_value: 95, unit: "%", target_period: "monthly", direction: "higher_is_better", is_active: true },
  { metric_name: "Tickets Resolved", metric_code: "tickets_resolved", role: "head_of_tech", target_value: 10, unit: "count", target_period: "monthly", direction: "higher_is_better", is_active: true },
];

export default function KPITargetEditor() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");

  const load = async () => {
    const data = await base44.entities.KPITarget.filter({ is_personal: false });
    setTargets(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (t) => { setEditing(t); setForm({ ...EMPTY, ...t }); setShowForm(true); };

  const save = async () => {
    if (!form.metric_name.trim() || !form.target_value) { toast.error("Name and target are required"); return; }
    setSaving(true);
    const data = {
      ...form,
      target_value: Number(form.target_value),
      metric_code: form.metric_code || form.metric_name.toLowerCase().replace(/\s+/g, "_"),
    };
    if (editing) {
      await base44.entities.KPITarget.update(editing.id, data);
      toast.success("KPI target updated");
    } else {
      await base44.entities.KPITarget.create(data);
      toast.success("KPI target created");
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const deleteTarget = async (id) => {
    await base44.entities.KPITarget.delete(id);
    setTargets(prev => prev.filter(t => t.id !== id));
    toast.success("KPI target deleted");
  };

  const toggleActive = async (t) => {
    await base44.entities.KPITarget.update(t.id, { is_active: !t.is_active });
    setTargets(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
  };

  const seedDefaults = async () => {
    setSeeding(true);
    let created = 0;
    for (const kpi of DEFAULT_KPIS) {
      const existing = targets.find(t => t.metric_code === kpi.metric_code);
      if (!existing) {
        await base44.entities.KPITarget.create(kpi);
        created++;
      }
    }
    toast.success(`Seeded ${created} default KPI targets`);
    setSeeding(false);
    load();
  };

  const filtered = targets.filter(t => roleFilter === "all" || t.role === roleFilter);

  return (
    <AppLayout title="KPI Target Editor" subtitle="Set performance targets by role">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {["all", ...ROLES].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all ${roleFilter === r ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                {r.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={seedDefaults} disabled={seeding} className="gap-1">
              <RefreshCw className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Seeding…" : "Seed Defaults"}
            </Button>
            <Button onClick={openCreate} className="gradient-bg text-white gap-1" size="sm">
              <Plus className="w-4 h-4" /> Add KPI Target
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted/20 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No KPI targets yet. Click "Seed Defaults" to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className={`glass rounded-xl p-4 flex items-center gap-4 transition-all ${!t.is_active ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{t.metric_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Target: <span className="text-foreground font-medium">{t.target_value} {t.unit}</span> · {t.target_period} · {t.direction?.replace(/_/g, " ")}
                  </p>
                </div>
                <Badge className="bg-primary/15 text-primary border-primary/30 border text-xs capitalize hidden sm:flex">
                  {t.role?.replace(/_/g, " ")}
                </Badge>
                <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="text-muted-foreground hover:text-foreground">Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteTarget(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gradient-text">{editing ? "Edit KPI Target" : "New KPI Target"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Metric Name *</Label>
              <Input value={form.metric_name} onChange={e => setForm(f => ({ ...f, metric_name: e.target.value }))} placeholder="e.g. Deals closed monthly" className="bg-secondary/50 border-border/50" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Metric Code (slug)</Label>
              <Input value={form.metric_code} onChange={e => setForm(f => ({ ...f, metric_code: e.target.value }))} placeholder="auto-generated from name if blank" className="bg-secondary/50 border-border/50" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Role *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Period *</Label>
              <Select value={form.target_period} onValueChange={v => setForm(f => ({ ...f, target_period: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Target Value *</Label>
              <Input type="number" value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} className="bg-secondary/50 border-border/50" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Unit</Label>
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{DIRECTIONS.map(d => <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Active</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gradient-bg text-white">{saving ? "Saving…" : "Save Target"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}