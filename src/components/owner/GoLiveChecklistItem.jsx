import { CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

export default function ChecklistItem({ status, label, detail }) {
  const icon =
    status === "pass" ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" /> :
    status === "warn" ? <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" /> :
    <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      </div>
    </div>
  );
}