import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";

function fmtZAR(n) {
  return `R${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MarkCommissionsPaidModal({ open, onClose, commissions, onDone }) {
  const [selected, setSelected] = useState(new Set());
  const [paymentMethod, setPaymentMethod] = useState("eft");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const approved = commissions.filter(c => c.status === "approved");
  const totalSelected = approved.filter(c => selected.has(c.id)).reduce((s, c) => s + Number(c.amount ?? c.commission_amount ?? 0), 0);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === approved.length) setSelected(new Set());
    else setSelected(new Set(approved.map(c => c.id)));
  };

  const handleMarkPaid = async () => {
    if (selected.size === 0) { toast.error("Select at least one commission"); return; }
    if (!reference.trim()) { toast.error("Payment reference is required"); return; }
    setSaving(true);
    await Promise.all([...selected].map(id => base44.entities.Commission.update(id, {
      status: "paid",
      paid_date: paidDate,
      payment_method: paymentMethod,
      payment_reference: reference,
    })));
    toast.success(`${selected.size} commission(s) marked as paid`);
    setSaving(false);
    setSelected(new Set());
    setReference("");
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="gradient-text flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Mark Commissions Paid
          </DialogTitle>
        </DialogHeader>

        {approved.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center">No approved commissions to pay. Approve first.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.size === approved.length && approved.length > 0} onChange={toggleAll} className="w-4 h-4" />
                Select all ({approved.length} approved)
              </label>
              {selected.size > 0 && (
                <span className="text-sm text-success font-semibold">{selected.size} selected · {fmtZAR(totalSelected)}</span>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {approved.map(c => (
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selected.has(c.id) ? "border-success/50 bg-success/5" : "border-border/40 bg-secondary/20"}`}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.staff_name || c.user_name || "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{(c.commission_type || c.type || "").replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-sm font-bold text-success shrink-0">{fmtZAR(c.amount ?? c.commission_amount)}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Payment method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eft">EFT</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Paid date *</Label>
                <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="bg-secondary/50 border-border/50" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Payment reference *</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Bank reference / payslip number" className="bg-secondary/50 border-border/50" />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleMarkPaid} disabled={saving || selected.size === 0} className="bg-success text-white hover:bg-success/90">
                {saving ? "Saving…" : `Mark ${selected.size > 0 ? selected.size : ""} as Paid`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}