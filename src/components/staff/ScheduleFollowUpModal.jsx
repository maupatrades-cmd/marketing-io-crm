import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ScheduleFollowUpModal({ user, onClose }) {
  const [form, setForm] = useState({
    title: "",
    notes: "",
    due_date: new Date().toISOString().split("T")[0],
    follow_up_type: "call",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title) { toast.error("Please add a title"); return; }
    setSaving(true);
    await base44.entities.Task.create({
      title: form.title,
      description: `Follow-up type: ${form.follow_up_type}${form.notes ? "\n" + form.notes : ""}`,
      due_date: form.due_date,
      assigned_to: user?.id,
      assigned_to_name: user?.full_name,
      status: "open",
      priority: "medium",
    });
    toast.success("Follow-up scheduled!");
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="e.g. Call back ABC Butchery"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Follow-up type</label>
            <div className="flex flex-wrap gap-2">
              {["call", "visit", "email", "whatsapp"].map(t => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, follow_up_type: t })}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                    form.follow_up_type === t
                      ? "gradient-bg text-white"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Due date</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={e => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes..."
              className="w-full p-3 rounded-md border border-input bg-transparent text-sm h-20 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}