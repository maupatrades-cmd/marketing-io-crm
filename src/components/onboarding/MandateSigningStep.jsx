import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, CheckCircle2 } from "lucide-react";

export default function MandateSigningStep({ step, onComplete, isCompleted, submitting }) {
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(isCompleted);

  const handleSign = async () => {
    if (!agreed) return;
    await onComplete();
    setSigned(true);
  };

  if (signed) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-success/10 border border-success/30 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success">Debit Order Mandate Signed</p>
            <p className="text-xs text-success/80">Thank you! We're ready to collect your first payment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-lg p-6 border border-slate-700/40">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Debit Order Mandate</h4>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          We'll collect your monthly retainer via debit order on the {step.debit_order_date || "1st"} of each month.
        </p>

        <div className="space-y-3 mb-6 p-4 bg-secondary/30 rounded-lg border border-slate-700/40 max-h-48 overflow-y-auto">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Mandate Terms</p>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
            <li>You authorize Marketing iO (Pty) Ltd to collect the agreed monthly amount</li>
            <li>Collection date: {step.debit_order_date || "1st"} of each month</li>
            <li>You may cancel with 30 days' notice in writing</li>
            <li>We'll notify you of amount changes 14 days in advance</li>
            <li>If a collection fails, we'll retry within 5 business days</li>
            <li>Your bank details are secure and PCI-compliant</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <Checkbox checked={agreed} onCheckedChange={setAgreed} className="mt-0.5" />
          <span className="text-xs text-muted-foreground">
            I understand and authorize Marketing iO to collect my monthly retainer via debit order
          </span>
        </label>

        <Button
          onClick={handleSign}
          disabled={!agreed || submitting}
          className="gradient-bg text-white w-full"
        >
          {submitting ? "Signing..." : "Sign Mandate"}
        </Button>
      </div>
    </div>
  );
}