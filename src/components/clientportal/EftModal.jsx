import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export default function EftModal({ invoice, bankDetails, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!invoice || !bankDetails) return null;

  const reference = invoice.invoice_number || (invoice.id ? invoice.id.slice(0, 8) : '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      toast.success('Reference copied');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[EftModal] clipboard write failed:', err);
      toast.error('Could not copy. Please select manually.');
    }
  };

  const Row = ({ label, value }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="bg-slate-900 border-slate-700/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Pay via EFT</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
            <Row label="Bank" value={bankDetails.bank} />
            <Row label="Account holder" value={bankDetails.accountHolder} />
            <Row label="Account type" value={bankDetails.accountType} />
            <Row label="Account number" value={bankDetails.accountNumber} />
            <Row label="Branch code" value={bankDetails.branchCode} />
          </div>

          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Use this reference</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-2xl font-bold text-primary break-all">{reference}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0 gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Your invoice will be marked paid within 1 business day of EFT clearing.
            We'll email confirmation as soon as the funds reflect.
          </p>

          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
