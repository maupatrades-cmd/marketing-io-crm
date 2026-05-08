/**
 * CancelReactivatePanel
 * Admin/Owner UI for cancelling or reactivating a client.
 * Shown in OwnerClientDetail header area.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, XCircle, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

function getToken() {
  try { return localStorage.getItem("mio_session_token") || ""; } catch { return ""; }
}

const CANCELLABLE_STATUSES = ["active", "onboarding", "lead", "prospect", "suspended"];

export default function CancelReactivatePanel({ client, viewerRole, onRefresh }) {
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCancel = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("cancel-client", {
        token: getToken(),
        client_id: client.id,
        reason: reason.trim(),
      });
      const payload = res?.data ?? res;
      if (payload?.success || payload?.skipped) {
        toast({ title: payload.skipped ? "Already cancelled" : "Client cancelled", description: payload.skipped ? `Status is already ${payload.current_status}` : `${payload.cancelled_invoices?.length || 0} invoice(s) also cancelled.` });
        setCancelOpen(false);
        setReason("");
        onRefresh?.();
      } else {
        toast({ title: "Cancel failed", description: payload?.error || "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("reactivate-client", {
        token: getToken(),
        client_id: client.id,
      });
      const payload = res?.data ?? res;
      if (payload?.success || payload?.skipped) {
        toast({ title: payload.skipped ? "Already active" : "Client reactivated" });
        setReactivateOpen(false);
        onRefresh?.();
      } else {
        toast({ title: "Reactivation failed", description: payload?.error || "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Reactivation failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!client) return null;

  const isCancelled = client.status === "cancelled";
  const isChurned = client.status === "churned";
  const canCancel = CANCELLABLE_STATUSES.includes(client.status) && ["admin", "owner"].includes(viewerRole);
  const canReactivate = isCancelled && viewerRole === "owner";

  return (
    <>
      {/* Status banner for cancelled/churned */}
      {(isCancelled || isChurned) && (
        <div className={`rounded-xl p-4 mb-4 border ${isChurned ? "bg-muted/20 border-muted/40" : "bg-destructive/10 border-destructive/30"}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-destructive">
                {isChurned ? "Client churned" : "Client cancelled"}
              </p>
              {client.deactivated_at && (
                <p className="text-muted-foreground text-xs">
                  Deactivated: {new Date(client.deactivated_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {client.cancellation_reason && (
                <p className="text-muted-foreground text-xs">Reason: {client.cancellation_reason}</p>
              )}
              {isChurned && client.archived_at && (
                <p className="text-muted-foreground text-xs">
                  Archived: {new Date(client.archived_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {canCancel && (
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} className="border-destructive/40 text-destructive hover:bg-destructive/10">
            <XCircle className="w-4 h-4 mr-1" /> Cancel Client
          </Button>
        )}
        {canReactivate && (
          <Button variant="outline" size="sm" onClick={() => setReactivateOpen(true)} className="border-success/40 text-success hover:bg-success/10">
            <RefreshCw className="w-4 h-4 mr-1" /> Reactivate
          </Button>
        )}
      </div>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Cancel {client.business_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs">
              <p>This will:</p>
              <ul className="list-disc ml-4 mt-1 space-y-1">
                <li>Set client status to <strong>cancelled</strong></li>
                <li>Cancel all unpaid (sent) invoices</li>
                <li>Notify all admins</li>
                <li>Start 30-day grace period (reactivation still possible)</li>
              </ul>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Cancellation reason *</label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Client requested cancellation, moved to competitor..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={submitting || !reason.trim()}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</> : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate dialog */}
      <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-success flex items-center gap-2">
              <RefreshCw className="w-5 h-5" /> Reactivate {client.business_name}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <p>This will restore the client to <strong>active</strong> status and clear the cancellation record.</p>
            <p className="mt-2 text-xs">Note: You will need to manually reissue any invoices that were cancelled.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleReactivate} disabled={submitting} className="bg-success text-white hover:bg-success/90">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reactivating…</> : "Confirm Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}