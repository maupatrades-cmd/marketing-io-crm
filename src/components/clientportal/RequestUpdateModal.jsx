import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function RequestUpdateModal({ 
  isOpen, 
  onClose, 
  deliverable, 
  client, 
  user 
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please add a message');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('mio_session_token');
      if (!token) {
        setError('Session expired. Please refresh.');
        return;
      }

      // Create internal message to head of marketing
      const internalMessage = await base44.entities.InternalMessage.create({
        client_id: client.id,
        client_name: client.business_name,
        deliverable_id: deliverable.id,
        deliverable_title: deliverable.title,
        from_user_id: user.id,
        from_user_name: user.full_name,
        from_user_email: user.email,
        recipient_role: 'head_of_tech',
        priority: 'high',
        subject: `Client Update Request: ${deliverable.title}`,
        message: `${client.contact_person} (${client.business_name}) is requesting an update on "${deliverable.title}"\n\nMessage: ${message}`,
        message_type: 'client_update_request',
        status: 'new',
        requires_escalation: true,
        escalate_to_owner: false // Will be escalated internally first
      });

      setSuccess(true);
      setTimeout(() => {
        setMessage('');
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('[RequestUpdateModal] Error:', err);
      setError(err.message || 'Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setMessage('');
        setError(null);
        setSuccess(false);
        onClose();
      }
    }}>
      <DialogContent className="bg-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Request Update</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Send a message to your Marketing iO team requesting an update on this deliverable.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Deliverable Info */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Deliverable</p>
            <p className="text-sm text-foreground font-medium">{deliverable.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Due: {new Date(deliverable.due_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
            </p>
          </div>

          {/* Message textarea */}
          <div>
            <label className="text-sm font-semibold block mb-2">What would you like to know?</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="E.g., What's the current status? Will it be ready by Friday?"
              rows={4}
              className="bg-secondary/50 border-border/50"
              disabled={loading || success}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your team will respond within 24 hours.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <p className="text-xs text-success">Request sent! Your team will get back to you soon.</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || success || !message.trim()}
              className="flex-1 gradient-bg text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Sent!
                </>
              ) : (
                'Send Request'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}