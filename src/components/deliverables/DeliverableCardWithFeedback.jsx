import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, MessageSquare, Calendar, Download } from 'lucide-react';
import GranularFeedbackModal from './GranularFeedbackModal';

export default function DeliverableCardWithFeedback({
  deliverable,
  client,
  user,
  onStatusChange
}) {
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  const statusBadges = {
    not_started: { color: 'bg-slate-500/10 text-slate-400', label: 'Not Started' },
    in_progress: { color: 'bg-blue-500/10 text-blue-400', label: 'In Progress' },
    awaiting_client: { color: 'bg-yellow-500/10 text-yellow-400', label: 'Awaiting Your Review' },
    client_reviewing: { color: 'bg-orange-500/10 text-orange-400', label: 'Reviewing' },
    approved: { color: 'bg-green-500/10 text-green-400', label: 'Approved' },
    deemed_approved: { color: 'bg-green-500/10 text-green-400', label: 'Auto-Approved' },
    completed: { color: 'bg-success/10 text-success', label: 'Completed' },
    blocked: { color: 'bg-destructive/10 text-destructive', label: 'Blocked' }
  };

  const status = statusBadges[deliverable.status] || statusBadges.not_started;
  const daysAgo = Math.floor((Date.now() - new Date(deliverable.submitted_date)) / (1000 * 60 * 60 * 24));

  return (
    <>
      <div className="glass rounded-lg p-4 border border-border/30 hover:border-primary/30 transition">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              {deliverable.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {deliverable.phase?.replace(/_/g, ' ') || 'Once off'}
            </p>
          </div>
          <Badge className={status.color}>{status.label}</Badge>
        </div>

        {/* Status details */}
        {deliverable.status === 'awaiting_client' && (
          <div className="mb-3 p-2 bg-yellow-500/5 rounded border border-yellow-500/20">
            <p className="text-xs text-yellow-600 font-medium">
              ⏱️ Submitted {daysAgo} day{daysAgo !== 1 ? 's' : ''} ago · Review by {new Date(deliverable.review_deadline).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Files */}
        {deliverable.file_urls && deliverable.file_urls.length > 0 && (
          <div className="mb-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Files ({deliverable.file_urls.length})</p>
            <div className="flex flex-wrap gap-2">
              {deliverable.file_urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 bg-secondary/30 hover:bg-secondary/50 rounded text-primary transition truncate flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  File {idx + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {deliverable.notes && (
          <div className="mb-3 p-2 bg-secondary/20 rounded border border-border/30">
            <p className="text-xs text-muted-foreground">{deliverable.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-border/30">
          {deliverable.status === 'awaiting_client' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFeedbackModalOpen(true)}
                className="flex-1 gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Leave Detailed Feedback
              </Button>
              <Button
                size="sm"
                onClick={() => onStatusChange?.(deliverable, 'approved')}
                className="flex-1 bg-success/20 hover:bg-success/30 text-success border-success/30"
              >
                Approve ✓
              </Button>
            </>
          )}
          {deliverable.status === 'in_progress' && (
            <p className="text-xs text-muted-foreground italic">Coming soon...</p>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      <GranularFeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        deliverable={deliverable}
        client={client}
        user={user}
      />
    </>
  );
}