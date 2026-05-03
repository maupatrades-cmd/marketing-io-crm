import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OnboardingProgress({ completed, total, status }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const statusColors = {
    not_started: "bg-slate-600",
    in_progress: "bg-gradient-to-r from-purple-500 to-pink-500",
    completed: "bg-green-500",
    archived: "bg-slate-700"
  };

  const statusLabels = {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
    archived: "Archived"
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Onboarding Progress</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {completed} of {total} steps complete
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">{percentage}%</p>
          <Badge className={cn(
            "text-xs mt-1",
            status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
            status === 'in_progress' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
            'bg-slate-600/20 text-slate-400 border-slate-600/30'
          )}>
            {statusLabels[status]}
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500", statusColors[status])}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Milestone Indicators */}
      <div className="grid grid-cols-5 gap-2">
        {[...Array(5)].map((_, i) => {
          const milestonePercentage = (i + 1) * 20;
          const isMilestoneReached = percentage >= milestonePercentage;
          return (
            <div key={i} className="text-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 transition-colors",
                isMilestoneReached
                  ? "bg-green-500/20 text-green-400"
                  : "bg-slate-700/50 text-slate-500"
              )}>
                {isMilestoneReached ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <p className="text-xs text-muted-foreground">{milestonePercentage}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ className, children }) {
  return <span className={`inline-block px-2 py-1 rounded border ${className}`}>{children}</span>;
}