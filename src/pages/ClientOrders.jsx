import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from '@/lib/customAuth';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ChevronRight } from "lucide-react";

const STATUS_COLORS = {
  requested: "bg-warning/15 text-warning border-warning/30",
  under_review: "bg-primary/15 text-primary border-primary/30",
  contract_pending: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  fulfilment_started: "bg-accent/15 text-accent border-accent/30",
  completed: "bg-success/10 text-success border-success/20",
};

export default function ClientOrders() {
  const [orders, setOrders] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getCurrentUser().then(async (me) => {
      if (!me) { setLoading(false); return; }
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = Array.isArray(clients) ? clients[0] : clients;
        setClient(c);
        const ords = await base44.entities.ServiceOrder.filter({ client_id: c.id }, "-requested_at", 50);
        setOrders(Array.isArray(ords) ? ords : ords ? [ords] : []);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">My Orders</h1>
        <p className="text-muted-foreground mb-6">Track your service requests and add-ons.</p>

        {orders.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">You haven't placed any orders yet.</p>
            <p className="text-xs text-muted-foreground mt-2">Visit "Order More" in the sidebar to add services.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id} className="glass rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold text-foreground">{order.product_name || order.order_type.replace(/_/g, " ")}</p>
                      <Badge className={`border text-xs ${STATUS_COLORS[order.status] || "bg-muted/40 text-muted-foreground"}`}>
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.requested_at).toLocaleDateString("en-ZA")} {order.order_type === "addon" && `• R${(order.price_zar_setup || 0).toLocaleString()}`}
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${expanded === order.id ? "rotate-90" : ""}`} />
                </button>

                {expanded === order.id && (
                  <div className="p-4 border-t border-border/40 bg-secondary/10 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Order Type</p>
                        <p className="font-semibold capitalize">{order.order_type.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Status</p>
                        <p className="font-semibold capitalize">{order.status.replace(/_/g, " ")}</p>
                      </div>
                    </div>

                    {order.price_zar_setup > 0 && (
                      <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-border/40">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Setup Fee</p>
                          <p className="font-semibold">R{order.price_zar_setup.toLocaleString()}</p>
                        </div>
                        {order.price_zar_recurring > 0 && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Monthly</p>
                            <p className="font-semibold">R{order.price_zar_recurring.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {order.domain_requested && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-muted-foreground text-xs mb-1">Domain Requested</p>
                        <p className="font-semibold">{order.domain_requested}</p>
                      </div>
                    )}

                    {order.email_addresses_requested && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-muted-foreground text-xs mb-1">Email Addresses</p>
                        <p className="font-semibold text-sm">{order.email_addresses_requested}</p>
                      </div>
                    )}

                    {order.additional_notes && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-muted-foreground text-xs mb-1">Notes</p>
                        <p className="text-sm">{order.additional_notes}</p>
                      </div>
                    )}

                    {order.decline_reason && (
                      <div className="pt-3 border-t border-border/40 bg-destructive/10 p-3 rounded-lg">
                        <p className="text-muted-foreground text-xs mb-1">Decline Reason</p>
                        <p className="text-sm text-destructive">{order.decline_reason}</p>
                      </div>
                    )}

                    {order.status === "contract_pending" && order.contract_id && (
                      <div className="pt-3">
                        <Button asChild variant="outline" className="w-full text-xs">
                          <a href="/client/contracts">View & Sign Contract →</a>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}