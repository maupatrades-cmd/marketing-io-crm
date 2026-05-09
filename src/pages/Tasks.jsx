import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentUser } from '@/lib/customAuth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, CheckSquare, Clock, AlertCircle, Circle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import TaskCheckbox from "@/components/tasks/TaskCheckbox";
import TaskModal from "@/components/tasks/TaskModal";
import { useToast } from "@/components/ui/use-toast";

const PRIORITY_COLORS = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high:   "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low:    "bg-muted/30 text-muted-foreground border-border/30",
};

const STATUS_COLORS = {
  open:        "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  done:        "bg-success/15 text-success border-success/30",
  cancelled:   "bg-muted/30 text-muted-foreground border-border/30",
};

function dueDateColor(dateStr) {
  if (!dateStr) return "text-muted-foreground";
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  if (d < today) return "text-destructive";
  if (d.getTime() === today.getTime()) return "text-warning";
  return "text-success";
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return d < today;
}

function isDueToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return d.getTime() === today.getTime();
}

function completedThisWeek(task) {
  if (task.status !== "done" || !task.completed_at) return false;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  return new Date(task.completed_at) >= weekAgo;
}

export default function Tasks() {
  const { user: authUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showMode, setShowMode] = useState("mine"); // mine | all
  const [statusFilter, setStatusFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const { toast } = useToast();

  const load = () => Promise.all([
    base44.entities.Task.list("-created_date", 300),
    base44.entities.AppUser.list(),
    base44.entities.Client.list("-created_date", 200),
    getCurrentUser(),
  ]).then(([t, u, c, me]) => {
    if (!me) { window.location.href = '/login'; return; }
    setTasks(t);
    setUsers(u.filter(usr => usr.role && usr.role !== "client"));
    setClients(c.filter(cl => cl.status === "active" || cl.status === "lead"));
    setCurrentUser(me);
    setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const isAdminOrOwner = currentUser?.role === "admin" || currentUser?.role === "owner";
  const forceMineMode = authUser?.role !== "admin" && authUser?.role !== "owner";

  const filtered = tasks.filter(t => {
    if (forceMineMode || showMode === "mine") {
      if (currentUser && t.assigned_to !== currentUser.id) return false;
    }
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase()) && !t.client_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const today = new Date(); today.setHours(0,0,0,0);
   const openTasks = tasks.filter(t => t.status === "open" || t.status === "in_progress");
   const myOpen = openTasks.filter(t => !currentUser || t.assigned_to === currentUser.id);
   const dueToday = myOpen.filter(t => isDueToday(t.due_date));
   const overdue = myOpen.filter(t => isOverdue(t.due_date));
   const completedWeek = tasks.filter(completedThisWeek);

   const myTasks = tasks.filter(t => !currentUser || t.assigned_to === currentUser.id);
   const myCompleted = myTasks.filter(t => t.status === "done");
   const completionPct = myTasks.length ? Math.round((myCompleted.length / myTasks.length) * 100) : 0;

  const handleUpdate = (updated) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleSave = (saved) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === saved.id);
      return idx >= 0 ? prev.map(t => t.id === saved.id ? saved : t) : [saved, ...prev];
    });
  };

  const openNew = () => { setEditingTask(null); setShowModal(true); };
  const openEdit = (t) => { setEditingTask(t); setShowModal(true); };

  return (
     <AppLayout title="Tasks" subtitle={`${myOpen.length} open · ${completionPct}% complete`}>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Completion", value: `${completionPct}%`, icon: CheckSquare, color: "bg-success/20", click: () => { setStatusFilter("done"); } },
          { label: "Open Tasks", value: myOpen.length, icon: Circle, color: "bg-primary/20", click: () => { setStatusFilter("open"); setShowMode("mine"); } },
          { label: "Due Today", value: dueToday.length, icon: Clock, color: "bg-warning/20", click: () => { setStatusFilter("open"); setShowMode("mine"); } },
          { label: "Overdue", value: overdue.length, icon: AlertCircle, color: "bg-destructive/20", click: () => { setStatusFilter("open"); setShowMode("mine"); } },
        ].map(card => (
          <button key={card.label} onClick={card.click} className="glass rounded-xl p-4 text-left hover:shadow-card-hover transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-foreground">{loading ? "—" : card.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-4 h-4 text-foreground" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        {/* Show: Mine / All */}
         {!forceMineMode && (
           <div className="flex rounded-lg border border-border/50 overflow-hidden">
             {["mine", "all"].map(m => (
               <button key={m} onClick={() => setShowMode(m)}
                 className={`px-3 py-1.5 text-sm transition-colors capitalize ${showMode === m ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                 {m === "mine" ? "My Tasks" : "All Tasks"}
               </button>
             ))}
           </div>
         )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {["urgent","high","medium","low"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdminOrOwner && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-border/50"><SelectValue placeholder="All assignees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button onClick={openNew} className="gradient-bg text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> Add Task
        </Button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className="glass rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-all">
              <TaskCheckbox task={task} onUpdate={handleUpdate} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[task.client_name, task.assigned_to_name].filter(Boolean).join(" · ")}
                  {task.auto_generated && <span className="ml-2 text-primary/60">auto</span>}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                {task.due_date && (
                  <span className={`text-xs flex items-center gap-1 ${dueDateColor(task.due_date)}`}>
                    <Clock className="w-3 h-3" />
                    {task.due_date}
                    {isOverdue(task.due_date) && task.status !== "done" && <span className="font-semibold">OVERDUE</span>}
                  </span>
                )}
                <Badge className={`border text-xs ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>{task.priority}</Badge>
                <Badge className={`border text-xs ${STATUS_COLORS[task.status] || ""} capitalize`}>{task.status?.replace(/_/g, " ")}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskModal
        open={showModal}
        onClose={() => setShowModal(false)}
        task={editingTask}
        clients={clients}
        users={users}
        currentUserId={currentUser?.id}
        onSave={handleSave}
      />
    </AppLayout>
  );
}