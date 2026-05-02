import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, AlertCircle, Clock, ArrowRight } from "lucide-react";
import TaskCheckbox from "./TaskCheckbox";

const PRIORITY_COLORS = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high:   "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low:    "bg-muted/30 text-muted-foreground border-border/30",
};

function dueDateColor(dateStr) {
  if (!dateStr) return "text-muted-foreground";
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  if (d < today) return "text-destructive";
  if (d.getTime() === today.getTime()) return "text-warning";
  return "text-success";
}

/**
 * Reusable task widget for dashboards.
 * Props:
 *  - userId: if set, filters to tasks assigned to this user
 *  - clientId: if set, filters to tasks for this client
 *  - limit: max items to show (default 5)
 *  - title: widget title
 */
export default function TaskWidget({ userId, clientId, limit = 5, title = "My Tasks" }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    let all;
    if (clientId) {
      all = await base44.entities.Task.filter({ client_id: clientId });
    } else {
      all = await base44.entities.Task.list("-created_date", 100);
    }
    const open = all.filter(t => t.status !== "done" && t.status !== "cancelled");
    const filtered = userId ? open.filter(t => t.assigned_to === userId) : open;
    setTasks(filtered.slice(0, limit));
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId, clientId]);

  const handleUpdate = (updated) => {
    setTasks(prev => prev.filter(t => t.id !== updated.id || updated.status !== "done"
      ? updated.id === t.id ? updated : t
      : false
    ).filter(t => t.status !== "done"));
  };

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <Link to="/tasks" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted/20 rounded-lg animate-pulse" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-6">
          <CheckSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No open tasks</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/40 transition-colors">
              <TaskCheckbox task={task} onUpdate={handleUpdate} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
                {task.client_name && <p className="text-xs text-muted-foreground truncate">{task.client_name}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.priority === "urgent" && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                {task.due_date && (
                  <span className={`text-xs flex items-center gap-1 ${dueDateColor(task.due_date)}`}>
                    <Clock className="w-3 h-3" />
                    {task.due_date}
                  </span>
                )}
                <Badge className={`text-xs border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium} hidden sm:inline-flex`}>
                  {task.priority}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}