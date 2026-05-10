import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

export default function LogVisitModal({ user, onClose }) {
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [prospectMode, setProspectMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    lead_id: "",
    prospect_name: "",
    visit_date: new Date().toISOString().slice(0, 16),
    location_address: "",
    visit_type: "discovery",
    outcome: "interested",
    notes: "",
    next_step: "",
    next_step_due_date: "",
  });

  useEffect(() => {
    Promise.all([
      base44.entities.Client.list("-created_date", 100).catch(() => []),
      base44.entities.Lead.list("-created_date", 100).catch(() => []),
    ]).then(([c, l]) => {
      setClients(Array.isArray(c) ? c : []);
      setLeads(Array.isArray(l) ? l : []);
    });
  }, []);

  const handleGPS = () => {
    if (!navigator.geolocation) { toast.error("GPS not available"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, location_address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` })),
      () => toast.error("Could not get location")
    );
  };

  const handleSave = async () => {
    if (!prospectMode && !form.client_id && !form.lead_id) {
      toast.error("Please select a client, lead, or use New Prospect");
      return;
    }
    if (prospectMode && !form.prospect_name) {
      toast.error("Please enter prospect name");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.FAVisitLog.create({
        field_agent_id: user?.id,
        client_id: form.client_id || undefined,
        lead_id: form.lead_id || undefined,
        prospect_name: prospectMode ? form.prospect_name : undefined,
        visit_date: form.visit_date,
        location_address: form.location_address,
        visit_type: form.visit_type,
        outcome: form.outcome,
        notes: form.notes,
        next_step: form.next_step,
        next_step_due_date: form.next_step_due_date || undefined,
      });

      if (form.next_step_due_date) {
        await base44.entities.Task.create({
          title: form.next_step || "Follow-up from visit",
          due_date: form.next_step_due_date,
          assigned_to: user?.id,
          assigned_to_name: user?.full_name,
          status: "open",
          priority: "medium",
        });
      }

      toast.success("Visit logged!");
      onClose();
    } catch (err) {
      toast.error("Failed to log visit");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const VISIT_TYPES = ["discovery", "follow_up", "signing", "support", "cold"];
  const OUTCOMES = ["interested", "not_interested", "signed", "deferred", "no_show"];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a Visit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Visit Type */}
          <div>
            <label className="text-sm font-medium mb-1 block">Visit type</label>
            <div className="flex flex-wrap gap-2">
              {VISIT_TYPES.map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, visit_type: t }))}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all ${
                    form.visit_type === t ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  }`}>
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Client / Lead / Prospect */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Who did you visit?</label>
              <button onClick={() => setProspectMode(m => !m)}
                className="text-xs text-primary hover:underline">
                {prospectMode ? "← Pick existing" : "New prospect →"}
              </button>
            </div>
            {prospectMode ? (
              <Input placeholder="Prospect business name" value={form.prospect_name}
                onChange={e => setForm(f => ({ ...f, prospect_name: e.target.value }))} />
            ) : (
              <div className="space-y-2">
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, lead_id: "" }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm">
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
                <select value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value, client_id: "" }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm">
                  <option value="">Or select lead…</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.business_name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium mb-1 block">Date & time</label>
            <Input type="datetime-local" value={form.visit_date}
              onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} />
          </div>

          {/* Location */}
          <div>
            <label className="text-sm font-medium mb-1 block">Location</label>
            <div className="flex gap-2">
              <Input placeholder="Address or area" value={form.location_address}
                onChange={e => setForm(f => ({ ...f, location_address: e.target.value }))} />
              <Button variant="outline" size="icon" onClick={handleGPS} title="Use GPS">
                <MapPin className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="text-sm font-medium mb-1 block">Outcome</label>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map(o => (
                <button key={o} onClick={() => setForm(f => ({ ...f, outcome: o }))}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all ${
                    form.outcome === o ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  }`}>
                  {o.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="What happened, key points discussed..."
              className="w-full p-3 rounded-md border border-input bg-transparent text-sm h-20 resize-none" />
          </div>

          {/* Next Step */}
          <div>
            <label className="text-sm font-medium mb-1 block">Next step</label>
            <Input placeholder="e.g. Send proposal, Call back Thursday"
              value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))} />
          </div>

          {/* Next step due date */}
          <div>
            <label className="text-sm font-medium mb-1 block">Next step due date</label>
            <Input type="date" value={form.next_step_due_date}
              onChange={e => setForm(f => ({ ...f, next_step_due_date: e.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">A task will be auto-created if you set a date</p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save & Log"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}