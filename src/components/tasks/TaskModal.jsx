import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CalendarIcon, Send, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
  due_date: "", follow_up_date: "", priority: "medium", status: "open",
  client_id: "", client_name: "", deal_id: "", notes: "", comments: [],
};

function DatePicker({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal bg-secondary/50 border-border/50">
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {value ? format(new Date(value), "d MMM yyyy") : <span className="text-muted-foreground">Pick a date…</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(date) => onChange(date ? date.toISOString().slice(0, 10) : "")}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function TaskModal({ open, onClose, task, clients, users, currentUserId, currentUser, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { toast } = useToast();
  const isEditing = !!task?.id;

  // Determine if current user is the assignee or admin/owner
  const isAssignee = currentUserId && form.assigned_to === currentUserId;
  const isAdminOrOwner = currentUser?.role === "admin" || currentUser?.role === "owner";
  const canComment = isAssignee || isAdminOrOwner;
  const canMarkDone = isAssignee || isAdminOrOwner;

  useEffect(() => {
    if (task) setForm({ ...EMPTY, ...task, comments: Array.isArray(task.comments) ? task.comments : [] });
    else setForm({ ...EMPTY, assigned_to: currentUserId || "" });
    setCommentText("");
  }, [task, open]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const data = { ...form, created_by: currentUserId };

    let saved;
    if (isEditing) {
      await base44.entities.Task.update(task.id, data);
      saved = { ...task, ...data };
      if (task.status !== data.status && data.client_id) {
        base44.functions.invoke('log-client-activity', {
          client_id: data.client_id,
          client_name: data.client_name,
          title: `Task status changed to "${data.status}": ${data.title}`,
          source: 'system',
          event_type: 'task_completed',
        }).catch(() => {});
      }
    } else {
      saved = await base44.entities.Task.create(data);
      if (data.client_id && saved?.id) {
        base44.functions.invoke('log-client-activity', {
          client_id: data.client_id,
          client_name: data.client_name,
          title: `Task created: ${data.title}`,
          source: 'system',
          event_type: 'note',
        }).catch(() => {});
      }
    }
    toast({ title: isEditing ? "Task updated" : "Task created" });
    setSaving(false);
    onSave?.(saved);
    onClose();
  };

  const addComment = async () => {
    if (!commentText.trim() || !task?.id) return;
    setAddingComment(true);
    const userName = currentUser?.full_name || currentUser?.email || "User";
    const newComment = {
      id: crypto.randomUUID(),
      user_id: currentUserId,
      user_name: userName,
      text: commentText.trim(),
      created_at: new Date().toISOString(),
    };
    const updatedComments = [...(form.comments || []), newComment];
    await base44.entities.Task.update(task.id, { comments: updatedComments });
    setForm(f => ({ ...f, comments: updatedComments }));
    onSave?.({ ...task, ...form, comments: updatedComments });
    setCommentText("");
    setAddingComment(false);
  };

  const markComplete = async () => {
    if (!task?.id) return;
    setCompleting(true);
    const now = new Date().toISOString();
    const updated = { status: "done", completed_at: now };
    await base44.entities.Task.update(task.id, updated);
    const saved = { ...task, ...form, ...updated };
    setForm(f => ({ ...f, ...updated }));
    onSave?.(saved);
    toast({ title: "Task marked complete!" });
    setCompleting(false);
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
          {/* Title & Description */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-secondary/50 border-border/50" placeholder="What needs to be done?" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
            <Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary/50 border-border/50 h-20" />
          </div>

          {/* Assigned To + Priority */}
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
          </div>

          {/* Due Date + Follow-up Date */}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Due Date"
              value={form.due_date}
              onChange={v => setForm(f => ({ ...f, due_date: v }))}
            />
            <DatePicker
              label="Follow-up Date"
              value={form.follow_up_date}
              onChange={v => setForm(f => ({ ...f, follow_up_date: v }))}
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["open","in_progress","done","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Related Client */}
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

        {/* ── Comments section (only on existing tasks) ── */}
        {isEditing && (
          <div className="mt-5 border-t border-border/30 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comments</h4>

            {/* Existing comments */}
            {form.comments?.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {form.comments.map(c => (
                  <div key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.user_id === currentUserId ? "bg-primary/10 border border-primary/20 ml-4" : "bg-secondary/50 border border-border/30 mr-4"}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-primary">{c.user_name}</span>
                      <span className="text-[10px] text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                    </div>
                    <p className="text-foreground leading-snug">{c.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            )}

            {/* Add comment input — visible to assignee + admin/owner */}
            {canComment && (
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  className="bg-secondary/50 border-border/50 h-16 text-sm resize-none flex-1"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); }}}
                />
                <Button size="icon" onClick={addComment} disabled={addingComment || !commentText.trim()} className="gradient-bg text-white shrink-0 self-end">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div className="flex justify-between items-center gap-2 mt-4">
          {/* Mark Complete button — shown to assignee + admin/owner when task not done */}
          {isEditing && canMarkDone && form.status !== "done" ? (
            <Button onClick={markComplete} disabled={completing} className="bg-success/20 text-success border border-success/30 hover:bg-success/30 gap-2">
              <CheckCheck className="w-4 h-4" />
              {completing ? "Completing…" : "Mark Complete"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()} className="gradient-bg text-white hover:opacity-90">
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}