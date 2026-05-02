import { formatDistanceToNow, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const EVENT_TYPE_LABELS = {
  all: "All actions",
  status_change: "Status changes",
  milestone: "Milestones",
  note: "Notes",
  task_completed: "Tasks completed",
};

export default function TeamActivityFeed({ activityLog, staff, filterStaff, setFilterStaff, filterType, setFilterType }) {
  const filtered = activityLog.filter(entry => {
    const matchStaff = filterStaff === "all" || entry.logged_by === filterStaff || entry.logged_by_name === filterStaff;
    const matchType = filterType === "all" || entry.event_type === filterType;
    return matchStaff && matchType;
  }).slice(0, 50);

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Team Activity Feed</h3>
          <span className="text-xs text-muted-foreground">({filtered.length} entries)</span>
        </div>
        <div className="flex gap-2">
          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="bg-secondary/50 border-border/50 h-8 text-xs w-[160px]">
              <SelectValue placeholder="All staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staff.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="bg-secondary/50 border-border/50 h-8 text-xs w-[160px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No activity to show</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filtered.map(entry => {
            const staffMember = staff.find(s => s.id === entry.logged_by);
            const name = staffMember?.full_name || entry.logged_by_name || "System";
            const ini = initials(name);
            const timeAgo = entry.created_date
              ? formatDistanceToNow(parseISO(entry.created_date), { addSuffix: true })
              : "";

            return (
              <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-all">
                <div className="w-8 h-8 rounded-full gradient-bg-subtle border border-border/30 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                  {ini}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{name}</span>
                    {" — "}
                    <span className="text-muted-foreground">{entry.event_label}</span>
                    {entry.client_name && (
                      <span className="text-primary/80"> · {entry.client_name}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                  entry.event_type === "milestone" ? "bg-success/10 text-success border-success/20" :
                  entry.event_type === "task_completed" ? "bg-primary/10 text-primary border-primary/20" :
                  entry.event_type === "status_change" ? "bg-warning/10 text-warning border-warning/20" :
                  "bg-muted/20 text-muted-foreground border-border/30"
                }`}>
                  {(entry.event_type || "note").replace(/_/g, " ")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}