import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Clock, CheckCircle2, AlertCircle } from "lucide-react";

const STATUS_COLORS = {
  requested: "bg-warning/15 text-warning border-warning/30",
  under_review: "bg-primary/15 text-primary border-primary/30",
  contract_pending: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  fulfilment_started: "bg-accent/15 text-accent border-accent/30",
  completed: "bg-success/10 text-success border-success/20",
};

export default function AdminServiceOrders() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [detailMode, setDetailMode] = useState(null); // "view", "approve", "reject"
  const [actionNotes, setActionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [ords, cls, usr] = await Promise.all([
        base44.entities.ServiceOrder.list(),
        base44.entities.Client.list(),
        base44.entities.User.list(),
      ]);

      setOrders(Array.isArray(ords) ? ords : ords ? [ords] : []);
      
      const clientMap = {};
      (Array.isArray(cls) ? cls : [cls]).forEach(c => {
        clientMap[c.id] = c;
      });
      setClients(clientMap);

      const userMap = {};
      (Array.isArray(usr) ? usr : [usr]).forEach(u => {
        userMap[u.id] = u;
      });
      setUsers(userMap);

      setLoading(false);
    })();
  }, []);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      // Create deal
      const deal = await base44.entities.Deal.create({
        client_id: selected.client_id,
        client_name: clients[selected.client_id]?.business_name,
        deal_type: "add_on",
        package: selected.order_type === "addon" ? selected.product_code : "none",
        stage: "contract_pending",
        setup_fee: selected.price_zar_setup || 0,
        monthly_retainer: selected.price_zar_recurring || 0,
        probability: 100,
        source: "self_service",
      });

      // Update service order
      await base44.entities.ServiceOrder.update(selected.id, {
        status: "approved",
        deal_id: deal.id,
        reviewed_at: new Date().toISOString(),
      });

      // Create task for head of tech to generate contract
      const headOfTech = Object.values(users).find(u => u.role === "head_of_tech");
      if (headOfTech) {
        await base44.entities.Task.create({
          title: `Generate contract addendum for ${selected.product_name} — ${clients[selected.client_id]?.business_name}`,
          client_id: selected.client_id,
          deal_id: deal.id,
          assigned_to: headOfTech.id,
          priority: "high",
          status: "open",
        });
      }

      // Create notification for client
      await base44.entities.ClientNotification.create({
        client_id: selected.client_id,
        notification_type: "contract_to_sign",
        title: "Order Approved",
        body: `Your order for ${selected.product_name} has been approved. Please sign the contract addendum.`,
      });

      // Update orders list
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: "approved" } : o));
      setSelected(null);
      setDetailMode(null);
      setActionNotes("");
    } catch (err) {
      console.error("Approval error:", err);
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await base44.entities.ServiceOrder.update(selected.id, {
        status: "rejected",
        decline_reason: actionNotes,
        reviewed_at: new Date().toISOString(),
      });

      // Create notification for client
      await base44.entities.ClientNotification.create({
        client_id: selected.client_id,
        notification_type: "system_update",
        title: "Order Declined",
        body: `Unfortunately, we're unable to proceed with your order for ${selected.product_name}. Reason: ${actionNotes}`,
      });

      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: "rejected" } : o));
      setSelected(null);
      setDetailMode(null);
      setActionNotes("");
    } catch (err) {
      console.error("Rejection error:", err);
    }
    setSubmitting(false);
  };

  const filtered = orders.filter(o => filter === "all" || o.status === filter);
  const requestedCount = orders.filter(o => o.status === "requested").length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold gradient-text">Service Orders</h1>
          {requestedCount > 0 && <Badge className="bg-destructive/20 text-destructive">{requestedCount} new</Badge>}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {["all", "requested", "under_review", "contract_pending", "approved", "rejected", "fulfilment_started", "completed"].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
                filter === f 
                  ? "gradient-bg text-white" 
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">No service orders</p>
            </div>
          ) : (
            filtered.map(order => {
              const client = clients[order.client_id];
              return (
                <div
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className="glass rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-semibold text-foreground">{order.product_name || order.order_type.replace(/_/g, " ")}</p>
                        <Badge className={`border text-xs ${STATUS_COLORS[order.status] || "bg-muted/40"}`}>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p><strong>Client:</strong> {client?.business_name} ({client?.contact_person})</p>
                        <p><strong>Type:</strong> {order.order_type.replace(/_/g, " ")}</p>
                        {order.price_zar_setup > 0 && (
                          <p><strong>Pricing:</strong> R{order.price_zar_setup.toLocaleString()} setup {order.price_zar_recurring > 0 && `+ R${order.price_zar_recurring.toLocaleString()}/mo`}</p>
                        )}
                        <p className="text-xs"><strong>Requested:</strong> {new Date(order.requested_at).toLocaleDateString("en-ZA")}</p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    {order.status === "requested" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); setDetailMode("approve"); }} className="gradient-bg text-white text-xs">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setDetailMode("reject"); }} className="text-xs text-destructive">
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setDetailMode(null); setActionNotes(""); } }}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.product_name || "Service Order"}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 mt-4">
              {detailMode === null ? (
                // View mode
                <>
                  <div className="glass rounded-lg p-4 border border-white/10 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client:</span>
                      <span className="font-semibold">{clients[selected.client_id]?.business_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact:</span>
                      <span className="font-semibold">{clients[selected.client_id]?.contact_person}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Type:</span>
                      <span className="font-semibold capitalize">{selected.order_type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={`border text-xs ${STATUS_COLORS[selected.status]}`}>
                        {selected.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>

                  {selected.price_zar_setup > 0 && (
                    <div className="glass rounded-lg p-4 border border-white/10">
                      <p className="text-sm font-semibold mb-2">Pricing</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Setup:</span>
                          <span className="font-semibold">R{selected.price_zar_setup.toLocaleString()}</span>
                        </div>
                        {selected.price_zar_recurring > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Monthly:</span>
                            <span className="font-semibold">R{selected.price_zar_recurring.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selected.domain_requested && (
                    <div className="glass rounded-lg p-4 border border-white/10">
                      <p className="text-sm font-semibold mb-1">Domain Requested</p>
                      <p className="text-sm">{selected.domain_requested}</p>
                    </div>
                  )}

                  {selected.email_addresses_requested && (
                    <div className="glass rounded-lg p-4 border border-white/10">
                      <p className="text-sm font-semibold mb-1">Email Addresses</p>
                      <p className="text-sm">{selected.email_addresses_requested}</p>
                    </div>
                  )}

                  {selected.additional_notes && (
                    <div className="glass rounded-lg p-4 border border-white/10">
                      <p className="text-sm font-semibold mb-1">Notes</p>
                      <p className="text-sm">{selected.additional_notes}</p>
                    </div>
                  )}

                  {selected.status === "requested" && (
                    <div className="flex gap-2 pt-4 border-t border-border/40">
                      <Button variant="outline" className="flex-1" onClick={() => setDetailMode("reject")}>
                        Reject
                      </Button>
                      <Button className="flex-1 gradient-bg text-white" onClick={() => setDetailMode("approve")}>
                        Approve
                      </Button>
                    </div>
                  )}
                </>
              ) : detailMode === "approve" ? (
                // Approve mode
                <>
                  <p className="text-sm">Ready to approve {selected.product_name} for {clients[selected.client_id]?.business_name}?</p>
                  <p className="text-xs text-muted-foreground">A deal will be created in the pipeline and the client will receive a contract addendum.</p>
                  <div className="flex gap-2 pt-4 border-t border-border/40">
                    <Button variant="outline" className="flex-1" onClick={() => setDetailMode(null)}>
                      Cancel
                    </Button>
                    <Button className="flex-1 gradient-bg text-white" onClick={handleApprove} disabled={submitting}>
                      {submitting ? "Processing..." : "Approve Order"}
                    </Button>
                  </div>
                </>
              ) : (
                // Reject mode
                <>
                  <p className="text-sm">Decline this order?</p>
                  <Textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Reason for decline (client will see this)..."
                    rows={3}
                    className="bg-secondary/50 border-border/50"
                  />
                  <div className="flex gap-2 pt-4 border-t border-border/40">
                    <Button variant="outline" className="flex-1" onClick={() => setDetailMode(null)}>
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-destructive hover:bg-destructive/90" onClick={handleReject} disabled={submitting || !actionNotes.trim()}>
                      {submitting ? "Declining..." : "Decline Order"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}