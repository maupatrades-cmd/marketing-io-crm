import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import TaskCheckbox from "./TaskCheckbox";
import { useToast } from "@/components/ui/use-toast";

const PRIORITY_COLORS = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high:   "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low:    "bg-muted/30 text-muted-foreground border-border/30",
};

const EMPTY = {
  title: "", description: "", assigned_to: "", assigned_to_name: "",
  due_date: "", priority: "medium", status: "open",
  client_id: "", client_name: "", deal_id: "",
};

export default function TaskModal({ open, onClose, task, clients, users, currentUserId, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isEditing = !!task?.id;

  useEffect(() => {
    if (task) setForm({ ...EMPTY, ...task });
    else setForm({ ...EMPTY, assigned_to: currentUserId || "" });
  }, [task, open]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const data = { ...form, created_by: currentUserId };

    let saved;
    if (isEditing) {
      await base44.entities.Task.update(task.id, data);
      saved = { ...task, ...data };
      // Log status change if changed
      if (task.status !== data.status && data.client_id) {
        base44.entities.ClientActivityLog.create({
          client_id: data.client_id,
          client_name: data.client_name,
          event_type: "task_completed",
          event_label: `Task status changed to "${data.status}": ${data.title}`,
        }).catch(() => {});
      }
    } else {
      saved = await base44.entities.Task.create(data);
      // Log task creation
      if (data.client_id && saved?.id) {
        base44.entities.ClientActivityLog.create({
          client_id: data.client_id,
          client_name: data.client_name,
          event_type: "note",
          event_label: `Task created: ${data.title}`,
        }).catch(() => {});
      }
    }
    toast({ title: isEditing ? "Task updated" : "Task created" });
    setSaving(false);
    onSave?.(saved);
    onClose();
  };

  const handleTaskDone = (updated) => {
    setForm(f => ({ ...f, status: updated.status, completed_at: updated.completed_at }));
    onSave?.(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gradient-text flex items-center gap-2">
            {isEditing ? (
              <>
                <TaskCheckbox task={form} onUpdate={handleTaskDone} />
                Edit Task
              </>
            ) : "New Task"}
          </DialogTitle>
        </DialogHeader>

        {isEditing && form.status === "done" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-sm text-success">Completed {form.completed_at ? new Date(form.completed_at).toLocaleDateString() : ""}</span>
          </div>
        )}

        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-secondary/50 border-border/50" placeholder="What needs to be done?" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
            <Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary/50 border-border/50 h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Assigned To</Label>
              <Select value={form.assigned_to || ""} onValueChange={v => {
                const u = users?.find(u => u.id === v);
                setForm(f => ({ ...f, assigned_to: v, assigned_to_name: u?.full_name || u?.email || "" }));
              }}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["urgent","high","medium","low"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
              <Input type="date" value={form.due_date || ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary/50 border-border/50" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["open","in_progress","done","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {clients && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Related Client (optional)</Label>
              <Select value={form.client_id || "none"} onValueChange={v => {
                if (v === "none") { setForm(f => ({ ...f, client_id: "", client_name: "" })); return; }
                const c = clients.find(c => c.id === v);
                setForm(f => ({ ...f, client_id: v, client_name: c?.business_name || "" }));
              }}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="No client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()} className="gradient-bg text-white hover:opacity-90">
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}