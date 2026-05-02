import { formatDistanceToNow } from "date-fns";

const ROLE_COLORS = {
  admin: "bg-primary/15 text-primary border-primary/30",
  field_agent: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  cpc: "bg-warning/15 text-warning border-warning/30",
  head_of_tech: "bg-accent/15 text-accent border-accent/30",
};

function getActivityStatus(user) {
  if (!user.last_login) return "inactive";
  const last = new Date(user.last_login);
  const now = new Date();
  const diffMin = (now - last) / 60000;
  if (diffMin < 15) return "active";
  const diffHours = diffMin / 60;
  if (diffHours < 24) return "today";
  return "inactive";
}

const STATUS_DOT = {
  active: "bg-success animate-pulse",
  today: "bg-warning",
  inactive: "bg-muted-foreground/40",
};
const STATUS_LABEL = {
  active: "Active now",
  today: "Active today",
  inactive: "Inactive",
};

export default function TeamSnapshotBar({ staff }) {
  if (!staff.length) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 mb-6">
      {staff.map(member => {
        const status = getActivityStatus(member);
        const initials = (member.full_name || member.email || "?")
          .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        const lastLoginText = member.last_login
          ? formatDistanceToNow(new Date(member.last_login), { addSuffix: true })
          : "Never";

        return (
          <div key={member.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3 shrink-0 min-w-[180px]">
            <div className="relative">
              <div className="w-10 h-10 rounded-full gradient-bg-subtle border border-border/40 flex items-center justify-center text-sm font-bold text-foreground">
                {initials}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${STATUS_DOT[status]}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{member.full_name || member.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${ROLE_COLORS[member.role] || "bg-muted/20 text-muted-foreground border-border/30"}`}>
                  {(member.role || "staff").replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{STATUS_LABEL[status]} · {lastLoginText}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}