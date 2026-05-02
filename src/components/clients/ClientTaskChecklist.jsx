import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Loader2 } from "lucide-react";

const ONBOARDING_TASKS = [
  { title: "Send welcome email & onboarding pack to client", priority: "high" },
  { title: "Collect signed onboarding form", priority: "high" },
  { title: "Collect signed debit order mandate", priority: "high" },
  { title: "Receive brand assets (logo, colours, photos)", priority: "high" },
  { title: "Confirm setup fee payment cleared", priority: "high" },
  { title: "Set up client accounts (social media, tools)", priority: "medium" },
  { title: "Schedule kick-off call / discovery session", priority: "medium" },
  { title: "Brief internal team on client package", priority: "medium" },
  { title: "Create content calendar for first month", priority: "medium" },
  { title: "Confirm go-live date with client", priority: "medium" },
  { title: "Deliver first deliverables and get client sign-off", priority: "low" },
  { title: "Mark client go-live acknowledged", priority: "low" },
];

export default function ClientTaskChecklist({ client }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Task.filter({ client_id: client.id });
    setTasks(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [client.id]);

  const toggle = async (task) => {
    setToggling(task.id);
    const isDone = task.status !== "done";
    await base44.entities.Task.update(task.id, {
      status: isDone ? "done" : "todo",
      completed_date: isDone ? new Date().toISOString().split("T")[0] : null,
    });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: isDone ? "done" : "todo" } : t));
    setToggling(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading tasks…
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <ClipboardList className="w-3 h-3" /> No onboarding tasks yet.
      </div>
    );
  }

  const done = tasks.filter(t => t.status === "done").length;
  const total = tasks.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
          <div
            className="h-full gradient-bg rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{done}/{total} done</span>
        {done === total && <Badge className="text-xs border bg-success/15 text-success border-success/30">Complete</Badge>}
      </div>

      {/* Task list */}
      <div className="space-y-1.5">
        {tasks.map(task => {
          const isDone = task.status === "done";
          const isToggling = toggling === task.id;
          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg transition-all ${isDone ? "opacity-50" : "hover:bg-white/5"}`}
            >
              {isToggling
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-0.5 shrink-0" />
                : <Checkbox
                    checked={isDone}
                    onCheckedChange={() => toggle(task)}
                    className="mt-0.5 shrink-0"
                  />
              }
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </p>
              </div>
              <Badge
                className={`text-[10px] border shrink-0 ${
                  task.priority === "high" ? "bg-destructive/10 text-destructive border-destructive/20" :
                  task.priority === "medium" ? "bg-warning/10 text-warning border-warning/20" :
                  "bg-muted/40 text-muted-foreground border-border/40"
                }`}
              >
                {task.priority}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ONBOARDING_TASKS };