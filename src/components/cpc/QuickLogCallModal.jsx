import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Square, Play } from "lucide-react";
import { toast } from "sonner";

const OUTCOMES = [
  { value: "connected_qualified",         label: "Qualified ✓" },
  { value: "connected_unqualified",       label: "Unqualified" },
  { value: "connected_callback_scheduled",label: "Callback set" },
  { value: "voicemail",                   label: "Voicemail" },
  { value: "no_answer",                   label: "No answer" },
  { value: "busy",                        label: "Busy" },
  { value: "disconnected",               label: "Disconnected" },
  { value: "wrong_number",               label: "Wrong number" },
  { value: "do_not_call",                label: "Do not call" },
];

export default function QuickLogCallModal({ open, onClose, user }) {
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState({
    prospect_phone: "",
    prospect_business_name: "",
    lead_id: "",
    outcome: "",
    notes: "",
    led_to_warm_lead: false,
    manual_duration_seconds: "",
  });
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    base44.entities.Lead.list("-created_date", 100).then(d => setLeads(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const formatElapsed = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSave = async () => {
    if (!form.prospect_phone.trim()) { toast.error("Phone number is required"); return; }
    if (!form.outcome) { toast.error("Select a call outcome"); return; }
    setSaving(true);

    const duration = timerRunning || elapsed > 0 ? elapsed : (Number(form.manual_duration_seconds) || undefined);

    await base44.entities.CPCCallLog.create({
      cpc_id: user?.id,
      prospect_phone: form.prospect_phone,
      prospect_business_name: form.prospect_business_name || undefined,
      lead_id: form.lead_id || undefined,
      call_started_at: new Date().toISOString(),
      call_duration_seconds: duration,
      outcome: form.outcome,
      notes: form.notes,
      led_to_warm_lead: form.led_to_warm_lead,
    });

    toast.success("Call logged!");
    setSaving(false);

    if (form.led_to_warm_lead) {
      toast.info("Opening lead form…");
      onClose();
      // Navigate to leads page to create warm lead
      window.location.href = "/leads";
      return;
    }

    // Reset for next call
    setForm({ prospect_phone: "", prospect_business_name: "", lead_id: "", outcome: "", notes: "", led_to_warm_lead: false, manual_duration_seconds: "" });
    setElapsed(0);
    setTimerRunning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gradient-text flex items-center gap-2">
            <Phone className="w-5 h-5" /> Log a Call
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Timer */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
            <span className="text-2xl font-mono font-bold text-foreground">{formatElapsed(elapsed)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant={timerRunning ? "destructive" : "outline"} onClick={() => setTimerRunning(r => !r)} className="gap-1">
                {timerRunning ? <><Square className="w-3.5 h-3.5" /> Stop</> : <><Play className="w-3.5 h-3.5" /> Start</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setElapsed(0); setTimerRunning(false); }}>Reset</Button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Phone number *</Label>
            <Input value={form.prospect_phone} onChange={e => setForm(f => ({ ...f, prospect_phone: e.target.value }))}
              placeholder="e.g. 082 123 4567" className="bg-secondary/50 border-border/50" type="tel" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Business name (optional)</Label>
            <Input value={form.prospect_business_name} onChange={e => setForm(f => ({ ...f, prospect_business_name: e.target.value }))}
              placeholder="e.g. ABC Butchery" className="bg-secondary/50 border-border/50" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Existing lead (optional)</Label>
            <select value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-input bg-secondary/50 text-sm">
              <option value="">Not linked to a lead</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.business_name} — {l.phone}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Outcome *</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {OUTCOMES.map(o => (
                <button key={o.value} onClick={() => setForm(f => ({ ...f, outcome: o.value }))}
                  className={`px-2 py-1.5 rounded-lg text-xs transition-all ${form.outcome === o.value ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notes (max 200 chars)</Label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value.slice(0, 200) }))}
              placeholder="Key points from the call…"
              className="w-full p-3 rounded-md border border-input bg-secondary/50 text-sm h-16 resize-none" />
            <p className="text-xs text-muted-foreground text-right">{form.notes.length}/200</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-success/30 bg-success/5">
            <input type="checkbox" checked={form.led_to_warm_lead} onChange={e => setForm(f => ({ ...f, led_to_warm_lead: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm font-medium text-success">Convert to warm lead after saving</span>
          </label>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gradient-bg text-white">
              {saving ? "Saving…" : "Save & Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}