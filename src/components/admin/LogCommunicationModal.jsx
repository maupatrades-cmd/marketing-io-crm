import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const COMM_TYPES = ["phone", "email", "whatsapp", "in_person", "sms"];
const DIRECTIONS = ["outbound", "inbound"];

export default function LogCommunicationModal({ open, onClose, preselectedClientId = null, currentUser }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    client_id: preselectedClientId || "",
    communication_type: "phone",
    direction: "outbound",
    subject: "",
    body: "",
    occurred_at: new Date().toISOString().slice(0, 16),
    duration_minutes: "",
    follow_up_required: false,
    follow_up_date: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Client.list("-created_date", 200).then(d => setClients(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (preselectedClientId) setForm(f => ({ ...f, client_id: preselectedClientId }));
  }, [preselectedClientId]);

  const handleSave = async () => {
    if (!form.client_id) { toast.error("Select a client"); return; }
    if (!form.subject.trim()) { toast.error("Subject is required"); return; }
    if (!form.body.trim()) { toast.error("Notes are required"); return; }

    setSaving(true);
    const client = clients.find(c => c.id === form.client_id);

    await base44.entities.ClientCommunication.create({
      client_id: form.client_id,
      client_name: client?.business_name || "",
      communication_type: form.communication_type,
      direction: form.direction,
      subject: form.subject,
      body: form.body,
      occurred_at: form.occurred_at,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      logged_by_id: currentUser?.id,
      logged_by_name: currentUser?.full_name || currentUser?.email,
    });

    await base44.entities.ClientActivityLog.create({
      client_id: form.client_id,
      client_name: client?.business_name || "",
      actor_id: currentUser?.id,
      actor_role: currentUser?.role || "admin",
      event_type: "communication_logged",
      event_category: "communication",
      event_label: `${form.direction} ${form.communication_type}: ${form.subject}`,
      event_summary: form.body.slice(0, 200),
    });

    if (form.follow_up_required && form.follow_up_date) {
      await base44.entities.Task.create({
        title: `Follow-up: ${form.subject}`,
        client_id: form.client_id,
        client_name: client?.business_name || "",
        due_date: form.follow_up_date,
        assigned_to: currentUser?.id,
        assigned_to_name: currentUser?.full_name,
        status: "open",
        priority: "medium",
      });
    }

    toast.success("Communication logged");
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gradient-text">Log Communication</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {!preselectedClientId && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Client *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select client…" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Type *</Label>
              <div className="flex flex-wrap gap-1.5">
                {COMM_TYPES.map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, communication_type: t }))}
                    className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-all ${form.communication_type === t ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Direction *</Label>
              <div className="flex gap-1.5">
                {DIRECTIONS.map(d => (
                  <button key={d} onClick={() => setForm(f => ({ ...f, direction: d }))}
                    className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-all ${form.direction === d ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Subject *</Label>
            <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Monthly check-in call" className="bg-secondary/50 border-border/50" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notes *</Label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="What was discussed, key decisions, next steps…"
              className="w-full p-3 rounded-md border border-input bg-secondary/50 text-sm h-24 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Date & time</Label>
              <Input type="datetime-local" value={form.occurred_at} onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))} className="bg-secondary/50 border-border/50" />
            </div>
            {(form.communication_type === "phone" || form.communication_type === "in_person") && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Duration (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="e.g. 15" className="bg-secondary/50 border-border/50" />
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg border border-border/40 bg-secondary/20 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input type="checkbox" checked={form.follow_up_required} onChange={e => setForm(f => ({ ...f, follow_up_required: e.target.checked }))} className="w-4 h-4" />
              Schedule follow-up
            </label>
            {form.follow_up_required && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Follow-up date *</Label>
                <Input type="date" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} className="bg-secondary/50 border-border/50" />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-bg text-white">
              {saving ? "Saving…" : "Save & Log Activity"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}