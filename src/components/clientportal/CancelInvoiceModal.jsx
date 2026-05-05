import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CancelInvoiceModal({ invoice, isOpen, onClose, onCancelled }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!invoice) return null;

  const reset = () => {
    setReason('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose?.();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const session_token = localStorage.getItem('mio_session_token');
      if (!session_token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      const res = await base44.functions.invoke('cancel-invoice', {
        invoice_id: invoice.id,
        reason: reason.trim(),
        session_token
      });
      const data = res?.data ?? res;
      if (data?.success) {
        toast.success('Invoice cancelled. Owner has been notified.');
        reset();
        onCancelled?.();
        onClose?.();
      } else {
        const msg = data?.detail || data?.error || 'Could not cancel invoice.';
        toast.error(msg);
      }
    } catch (err) {
      console.error('[CancelInvoiceModal]', err);
      toast.error('Could not cancel invoice. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const invNumber = invoice.invoice_number || (invoice.id || '').slice(0, 8);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-400" />
            Cancel invoice {invNumber}?
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Cancelling this invoice means you don't owe this amount. If this is a mistake,
            click <strong>Keep invoice</strong>. Otherwise tell us why so we can improve.
          </p>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Reason — optional but helpful
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={4}
              placeholder="Tell us briefly why you're cancelling"
              disabled={submitting}
              className="w-full bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
            />
            <p className="text-[10px] text-slate-500 text-right mt-1">{reason.length}/500</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              Keep invoice
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-rose-600 hover:bg-rose-500 text-white gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {submitting ? 'Cancelling…' : 'Cancel invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
