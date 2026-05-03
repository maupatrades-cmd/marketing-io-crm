import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle2 } from 'lucide-react';

export default function FeedbackSurveyModal({ deliverable, client, onDone }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setSaving(true);
    await base44.entities.DeliverableFeedback.create({
      deliverable_id: deliverable.id,
      deliverable_title: deliverable.title,
      client_id: client?.id,
      client_name: client?.business_name,
      staff_id: deliverable.assigned_to || null,
      staff_name: deliverable.assigned_to_name || null,
      phase: deliverable.phase || 'setup',
      rating,
      comment: comment.trim() || null,
      submitted_at: new Date().toISOString(),
    });
    setSaving(false);
    setDone(true);
    setTimeout(onDone, 1500);
  };

  const LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' };

  return (
    <Dialog open onOpenChange={onDone}>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <p className="text-lg font-semibold text-foreground">Thank you for your feedback!</p>
            <p className="text-sm text-muted-foreground">Your rating helps us improve.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">How did we do?</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Rate this deliverable: <span className="text-foreground font-medium">{deliverable.title}</span></p>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Stars */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHover(star)}
                      onMouseLeave={() => setHover(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-9 h-9 transition-colors ${
                          star <= (hover || rating)
                            ? 'fill-warning text-warning'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {(hover || rating) > 0 && (
                  <p className="text-sm font-medium text-warning">{LABELS[hover || rating]}</p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="text-sm font-medium block mb-1.5">Any comments? <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Tell us what you thought…"
                  rows={3}
                  className="bg-secondary/50 border-border/50"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onDone}>Skip</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!rating || saving}
                  className="gradient-bg text-white"
                >
                  {saving ? 'Submitting…' : 'Submit Rating'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}