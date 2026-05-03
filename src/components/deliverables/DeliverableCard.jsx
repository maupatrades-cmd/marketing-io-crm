import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageSquare, X, Eye, FileText } from "lucide-react";

const STATUS_CONFIG = {
  pending_client_review: { color: "bg-warning/15 text-warning", label: "Pending Review", icon: "⏳" },
  client_reviewing: { color: "bg-blue-500/15 text-blue-400", label: "Under Review", icon: "👁️" },
  approved: { color: "bg-success/15 text-success", label: "Approved", icon: "✓" },
  changes_requested: { color: "bg-orange-600/15 text-orange-500", label: "Revision Requested", icon: "✏️" },
  rejected: { color: "bg-destructive/15 text-destructive", label: "Rejected", icon: "✗" },
  completed: { color: "bg-success/15 text-success", label: "Completed", icon: "✓" },
};

export default function DeliverableCard({ deliverable, onApprove, onRequestChanges, onReject, onRate, isRated, isForReview, submitting }) {
  const status = STATUS_CONFIG[deliverable.approval_status] || STATUS_CONFIG.pending_client_review;
  const daysLeft = deliverable.review_deadline ? Math.ceil((new Date(deliverable.review_deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="glass rounded-xl p-4 border border-slate-700/40 hover:border-slate-600/60 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{status.icon}</span>
            <h4 className="font-semibold text-foreground">{deliverable.title}</h4>
            {daysLeft !== null && daysLeft <= 3 && (
              <Badge className={daysLeft <= 0 ? "bg-red-600" : "bg-orange-600"}>
                {daysLeft <= 0 ? "Auto-approving" : `${daysLeft}d left`}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {deliverable.product} • {new Date(deliverable.created_date).toLocaleDateString("en-ZA")}
          </p>

          {/* Preview */}
          {deliverable.file_urls?.[0] && (
            <a
              href={deliverable.file_urls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 mb-2"
            >
              <FileText className="w-3 h-3" /> View deliverable
            </a>
          )}

          {deliverable.preview_image && (
            <img
              src={deliverable.preview_image}
              alt="preview"
              className="mt-2 rounded-lg max-h-32 object-cover w-full"
            />
          )}
        </div>
        <Badge className={status.color}>{status.label}</Badge>
      </div>

      {deliverable.notes && (
        <p className="text-xs text-muted-foreground bg-secondary/30 rounded px-2 py-1 mb-3 italic">
          "{deliverable.notes}"
        </p>
      )}

      {/* Action Buttons */}
      {isForReview && (
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            size="sm"
            onClick={() => onApprove(deliverable.id)}
            className="gradient-bg text-white text-xs"
            disabled={submitting}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => onRequestChanges(deliverable)}
            disabled={submitting}
          >
            <MessageSquare className="w-3 h-3 mr-1" /> Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs text-destructive hover:text-destructive"
            onClick={() => onReject(deliverable)}
            disabled={submitting}
          >
            <X className="w-3 h-3 mr-1" /> Reject
          </Button>
        </div>
      )}

      {deliverable.approval_status === "approved" && !isRated && (
        <Button
          size="sm"
          variant="outline"
          className="text-xs text-warning border-warning/40 hover:bg-warning/10 mt-3 w-full"
          onClick={() => onRate(deliverable)}
        >
          ★ Rate this work
        </Button>
      )}

      {isRated && (
        <p className="text-xs text-success mt-3">★ Rated — thank you!</p>
      )}
    </div>
  );
}