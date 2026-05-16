import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, DollarSign } from "lucide-react";
import { toast } from "sonner";

function fmtZAR(n) {
  return `R${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ApproveCommissionsModal({ open, onClose, commissions, onDone }) {
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const pending = commissions.filter(c => c.status === "pending");
  const totalSelected = pending.filter(c => selected.has(c.id)).reduce((s, c) => s + Number(c.amount ?? c.commission_amount ?? 0), 0);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map(c => c.id)));
  };

  const handleApprove = async () => {
    if (selected.size === 0) { toast.error("Select at least one commission"); return; }
    setSaving(true);
    await Promise.all([...selected].map(id => base44.entities.Commission.update(id, { status: "approved", approval_note: note })));
    toast.success(`${selected.size} commission(s) approved`);
    setSaving(false);
    setSelected(new Set());
    setNote("");
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gradient-text flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Approve Commissions
          </DialogTitle>
        </DialogHeader>

        {pending.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center">No pending commissions to approve.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.size === pending.length && pending.length > 0} onChange={toggleAll} className="w-4 h-4" />
                Select all ({pending.length})
              </label>
              {selected.size > 0 && (
                <span className="text-sm text-primary font-semibold">{selected.size} selected · {fmtZAR(totalSelected)}</span>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pending.map(c => (
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selected.has(c.id) ? "border-primary/50 bg-primary/5" : "border-border/40 bg-secondary/20"}`}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.staff_name || c.user_name || "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{(c.commission_type || c.type || "").replace(/_/g, " ")} · {c.client_name || c.package_or_addon || "—"}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{fmtZAR(c.amount ?? c.commission_amount)}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Approval note (optional)</label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note for this approval batch…" className="bg-secondary/50 border-border/50 h-16" />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleApprove} disabled={saving || selected.size === 0} className="gradient-bg text-white">
                {saving ? "Approving…" : `Approve ${selected.size > 0 ? selected.size : ""} Commission${selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}