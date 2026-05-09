import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { XCircle, MessageSquare, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_COLORS = {
  draft: "bg-muted/40 text-muted-foreground border-border/40",
  sent: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  paid: "bg-success/15 text-success border-success/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted/40 text-muted-foreground border-border/40",
  partial: "bg-warning/15 text-warning border-warning/30",
};

export default function CancelInvoiceModal({ invoice, open, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast({ title: "Please provide a cancellation reason", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const me = await base44.auth.me();
      await base44.entities.Invoice.update(invoice.id, {
        status: "cancelled",
        cancellation_reason: reason.trim(),
        cancelled_by_id: me?.id || "",
        cancelled_by_name: me?.full_name || me?.email || "Admin",
        cancelled_at: new Date().toISOString(),
      });
      toast({ title: "Invoice cancelled", description: `Invoice ${invoice.invoice_number || ""} has been cancelled.` });
      setReason("");
      onCancelled?.();
    } catch (err) {
      toast({ title: "Failed to cancel invoice", description: err?.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (!invoice) return null;

  const amount = invoice.total_amount || invoice.amount || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" /> Cancel Invoice
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cancel">
          <TabsList className="w-full bg-secondary/50 mb-4">
            <TabsTrigger value="cancel" className="flex-1 gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Cancel
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Comments
            </TabsTrigger>
          </TabsList>

          {/* ── Cancel Tab ── */}
          <TabsContent value="cancel" className="space-y-4">
            {/* Invoice summary */}
            <div className="glass rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{invoice.client_name}</p>
                <Badge className={`border text-xs ${STATUS_COLORS[invoice.status] || ""}`}>{invoice.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground capitalize">
                {invoice.invoice_number ? `${invoice.invoice_number} · ` : ""}
                {invoice.invoice_type?.replace(/_/g, " ")}
              </p>
              <p className="text-lg font-bold text-foreground">R{amount.toLocaleString()}</p>
            </div>

            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-xs text-destructive">
              This will permanently mark the invoice as <strong>cancelled</strong>. It will be logged and visible in owner reports.
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Cancellation Reason *</Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Client requested cancellation, duplicate invoice, billing error…"
                className="bg-secondary/50 border-border/50 h-24 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Back</Button>
              <Button
                onClick={handleCancel}
                disabled={saving || !reason.trim()}
                className="bg-destructive/80 hover:bg-destructive text-white gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                {saving ? "Cancelling…" : "Confirm Cancellation"}
              </Button>
            </div>
          </TabsContent>

          {/* ── Comments Tab — shows existing cancellation info ── */}
          <TabsContent value="comments" className="space-y-3">
            {invoice.status === "cancelled" && invoice.cancellation_reason ? (
              <div className="space-y-3">
                <div className="glass rounded-lg p-3 border border-destructive/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-destructive">Cancellation Note</span>
                    <span className="text-[10px] text-muted-foreground">
                      {invoice.cancelled_at ? new Date(invoice.cancelled_at).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-snug">{invoice.cancellation_reason}</p>
                  {invoice.cancelled_by_name && (
                    <p className="text-xs text-muted-foreground mt-1">By: {invoice.cancelled_by_name}</p>
                  )}
                </div>
                {invoice.notes && (
                  <div className="glass rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Invoice Notes</p>
                    <p className="text-sm text-foreground">{invoice.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No cancellation comments yet.
                {invoice.status !== "cancelled" && (
                  <p className="text-xs mt-1">Cancel the invoice first to add a reason.</p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}