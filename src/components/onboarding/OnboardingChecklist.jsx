import { CheckCircle2, Circle, Upload, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OnboardingChecklist({ steps, onStepClick }) {
  const categoryLabels = {
    brand_assets: "🎨 Brand Assets",
    business_info: "📋 Business Info",
    content_plan: "📝 Content Plan",
    access_credentials: "🔐 Access",
    approval: "✅ Approval"
  };

  const categoryColors = {
    brand_assets: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    business_info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    content_plan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    access_credentials: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    approval: "bg-green-500/10 text-green-400 border-green-500/20"
  };

  const groupedSteps = {};
  steps.forEach(step => {
    if (!groupedSteps[step.category]) {
      groupedSteps[step.category] = [];
    }
    groupedSteps[step.category].push(step);
  });

  const categoryOrder = ["brand_assets", "business_info", "content_plan", "access_credentials", "approval"];

  return (
    <div className="space-y-6">
      {categoryOrder.map(category => {
        const categorySteps = groupedSteps[category];
        if (!categorySteps) return null;

        const completedInCategory = categorySteps.filter(s => s.is_completed).length;

        return (
          <div key={category} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{categoryLabels[category]}</h3>
              <span className="text-xs text-muted-foreground">
                {completedInCategory} of {categorySteps.length}
              </span>
            </div>

            {/* Steps in Category */}
            <div className="space-y-2">
              {categorySteps.map(step => (
                <button
                  key={step.id}
                  onClick={() => onStepClick(step)}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all text-left",
                    "hover:border-primary/30 hover:bg-secondary/50",
                    step.is_completed
                      ? "bg-secondary/30 border-slate-700/40"
                      : "bg-secondary/10 border-slate-700/60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox Icon */}
                    <div className="mt-0.5">
                      {step.is_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-medium",
                          step.is_completed ? "text-slate-400 line-through" : "text-foreground"
                        )}>
                          {step.title}
                        </p>
                        {step.required && !step.is_completed && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                            Required
                          </Badge>
                        )}
                        {step.file_url && (
                          <FileText className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      {step.file_name && (
                        <p className="text-xs text-green-400 mt-1">✓ {step.file_name}</p>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="text-slate-600 mt-0.5">→</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}